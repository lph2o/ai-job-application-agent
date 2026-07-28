"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { parseResumeBuffer } from "@/lib/resume/gemini"
import {
  ResumeProfileSchema,
  type ResumeProfile,
  normalizeProfile,
} from "@/lib/resume/schema"

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
