"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { parseResumeBuffer } from "@/lib/resume/gemini"
import {
  ResumeProfileSchema,
  type ResumeProfile,
  normalizeProfile,
} from "@/lib/resume/schema"
import { calculateProfileCompleteness } from "@/lib/profile/completeness"

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
]

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function isValidStoragePath(path: string, userId: string) {
  // Path format: {userId}/{uuid}.{ext}
  const pattern = new RegExp(
    `^${escapeRegExp(userId)}/[a-zA-Z0-9-_]+\\.[a-zA-Z0-9]+$`
  )
  return pattern.test(path)
}

export async function parseAndSaveResume({
  storagePath,
  fileName,
  fileSize,
  mimeType,
}: {
  storagePath: string
  fileName: string
  fileSize: number
  mimeType: string
}) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub

  if (!userId) {
    return { error: "Unauthorized" }
  }

  // Ensure the storage path belongs to the current user
  if (!isValidStoragePath(storagePath, userId)) {
    return { error: "Invalid storage path" }
  }

  if (!ALLOWED_TYPES.includes(mimeType)) {
    return { error: "Unsupported file type. Please upload a PDF or DOCX file." }
  }

  if (fileSize > MAX_SIZE) {
    return { error: "File size exceeds 5MB limit" }
  }

  try {
    // Download the uploaded file from Supabase Storage
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(storagePath)

    if (downloadError || !fileBlob) {
      console.error("Storage download error:", downloadError)
      return { error: "Failed to retrieve uploaded resume" }
    }

    const arrayBuffer = await fileBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Use the actual content type from storage in case the client reported it differently
    const actualMimeType = fileBlob.type || mimeType

    // Parse the resume with Gemini
    const parsedData = await parseResumeBuffer(buffer, actualMimeType)

    // Insert resume record
    const { data: resumeRecord, error: resumeError } = await supabase
      .from("resumes")
      .insert({
        user_id: userId,
        file_name: fileName,
        storage_path: storagePath,
        file_size: fileSize,
        mime_type: actualMimeType,
        extracted_data: parsedData,
      })
      .select("id")
      .single()

    if (resumeError) {
      console.error("Resume insert error:", resumeError)
      // Clean up the uploaded file since we couldn't save metadata
      await supabase.storage.from("resumes").remove([storagePath])
      return { error: "Failed to save resume metadata" }
    }

    // Update profile with parsed data and mark onboarding complete
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        parsed_data: parsedData,
        onboarded: true,
      })
      .eq("id", userId)

    if (profileError) {
      console.error("Profile update error:", profileError)
      return { error: "Failed to update profile" }
    }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/profile")
    revalidatePath("/dashboard/resume")

    return { success: true, resumeId: resumeRecord.id }
  } catch (err) {
    console.error("Parse and save error:", err)
    // Best-effort cleanup of the uploaded file on unexpected errors
    await supabase.storage.from("resumes").remove([storagePath]).catch((removeErr) => {
      console.error("Failed to clean up uploaded file:", removeErr)
    })
    const message = err instanceof Error ? err.message : "Failed to process resume"
    return { error: message }
  }
}

export async function updateProfile(data: ResumeProfile) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub

  if (!userId) {
    return { error: "Unauthorized" }
  }

  const normalized = normalizeProfile(data)
  const parsed = ResumeProfileSchema.safeParse(normalized)
  if (!parsed.success) {
    return { error: "Invalid profile data", issues: parsed.error.issues }
  }

  const { error } = await supabase
    .from("profiles")
    .update({ parsed_data: parsed.data })
    .eq("id", userId)

  if (error) {
    console.error("Profile update error:", error)
    return { error: "Failed to update profile" }
  }

  revalidatePath("/dashboard/profile")

  return { success: true }
}

export type SectionKey =
  | "personal"
  | "skills"
  | "workExperience"
  | "education"
  | "projects"
  | "certifications"
  | "links"

/**
 * Use Gemini AI to generate missing profile sections based on the existing data.
 * Returns a complete profile with existing data preserved and missing sections filled.
 * If `sectionKey` is provided, only that section will be generated.
 */
export async function generateMissingProfileSections(
  currentProfile: ResumeProfile,
  sectionKey?: SectionKey
): Promise<{ data?: ResumeProfile; error?: string }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { error: "AI generation is not configured. Please add GEMINI_API_KEY." }
  }

  try {
    const { GoogleGenAI } = await import("@google/genai")
    const client = new GoogleGenAI({ apiKey })
    const model = process.env.GEMINI_MODEL_NAME ?? "gemini-3.1-flash-lite"

    const completeness = calculateProfileCompleteness(currentProfile)
    const incompleteSections = completeness.sections
      .filter((s) => s.percentage < 100)
      .map((s) => s.key)

    if (incompleteSections.length === 0) {
      return { data: currentProfile }
    }

    const targetSectionText = sectionKey
      ? `Focus ONLY on the "${sectionKey}" section. Generate or improve realistic content for this section based on the existing profile context.`
      : `Sections that need to be completed or improved: ${incompleteSections.join(", ")}`

    const modifyRule = sectionKey
      ? `You MAY rewrite or expand existing values WITHIN the "${sectionKey}" section to make them professional and complete. Do NOT modify any other sections.`
      : "Do NOT modify existing values. Only generate content for empty/missing fields."

    const prompt = `You are an AI career assistant. The user has a partially filled profile and wants to reach 100% completeness.

Current profile (JSON):
${JSON.stringify(currentProfile, null, 2)}

${targetSectionText}

${modifyRule}

Rules:
1. Keep the same overall structure as the input profile.
2. Generate content that fits the user's existing title, skills, and experience context.
3. If no existing context is available, generate a generic but professional profile for a software developer.
4. Do not invent specific companies, schools, or certifications that could be misleading; use plausible placeholders if needed.
5. For array sections (workExperience, education, projects, certifications, skills, links), keep all existing items and append new ones to reach 100% completeness.
6. Return ONLY valid JSON matching the ResumeProfile schema. Do not include markdown or explanations.

ResumeProfile schema:
{
  "fullName": "string",
  "email": "string",
  "phone": "string",
  "location": "string",
  "title": "string",
  "summary": "string",
  "skills": ["skill1", "skill2"],
  "workExperience": [
    {
      "company": "string",
      "title": "string",
      "duration": "string",
      "location": "string",
      "responsibilities": ["string"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "fieldOfStudy": "string",
      "duration": "string",
      "location": "string",
      "gpa": "string"
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string",
      "link": "string"
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string",
      "date": "string",
      "link": "string"
    }
  ],
  "links": [
    {
      "label": "string",
      "url": "string"
    }
  ]
}`

    const result = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    })

    const text = result.text || "{}"
    const generated = JSON.parse(text) as ResumeProfile

    const sectionFields: Record<SectionKey, (keyof ResumeProfile)[]> = {
      personal: ["fullName", "email", "phone", "location", "title", "summary"],
      skills: ["skills"],
      workExperience: ["workExperience"],
      education: ["education"],
      projects: ["projects"],
      certifications: ["certifications"],
      links: ["links"],
    }

    // Merge generated data with current profile
    const merged: ResumeProfile = { ...currentProfile }
    const keysToApply = sectionKey ? sectionFields[sectionKey] : Object.keys(generated)

    for (const key of keysToApply) {
      const generatedValue = (generated as Record<string, unknown>)[key]
      if (generatedValue === undefined) continue

      const existing = (currentProfile as Record<string, unknown>)[key]
      const isArraySection = ["skills", "links", "workExperience", "education", "projects", "certifications"].includes(key)

      if (sectionKey) {
        // For per-section generation, use generated content but append arrays to preserve existing items
        if (isArraySection && Array.isArray(existing) && existing.length > 0 && Array.isArray(generatedValue)) {
          ;(merged as Record<string, unknown>)[key] = [...existing, ...generatedValue]
        } else {
          ;(merged as Record<string, unknown>)[key] = generatedValue
        }
      } else {
        // For full generation, prefer existing non-empty values
        if (isArraySection && Array.isArray(existing) && existing.length > 0) {
          ;(merged as Record<string, unknown>)[key] = existing
        } else if (!isArraySection && existing && existing !== "") {
          ;(merged as Record<string, unknown>)[key] = existing
        } else {
          ;(merged as Record<string, unknown>)[key] = generatedValue
        }
      }
    }

    const parsed = ResumeProfileSchema.safeParse(merged)
    if (!parsed.success) {
      console.error("AI generated invalid profile:", parsed.error.issues)
      return { error: "AI generated invalid profile data. Please try again." }
    }

    return { data: parsed.data }
  } catch (err) {
    console.error("Profile AI generation error:", err)
    return { error: "Failed to generate profile sections. Please try again." }
  }
}
