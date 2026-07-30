"use server"

import { createClient } from "@/lib/supabase/server"
import { fetchJobsFromBrave } from "@/lib/jobs/brave"
import { PLATFORMS, type Platform } from "@/lib/jobs/schema"
import { normalizeProfile, type ResumeProfile } from "@/lib/resume/schema"

const CACHE_TTL_HOURS = 6
const CACHE_TTL_MS = CACHE_TTL_HOURS * 60 * 60 * 1000

export async function fetchAllJobs(profile: ResumeProfile) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub

  if (!userId) {
    return { error: "Not authenticated", data: null }
  }

  const cacheCutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString()
  const { data: cachedJobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .gte("fetched_at", cacheCutoff)
    .order("match_score", { ascending: false })

  // Cache is valid ONLY if all 4 platforms are represented
  const platformsInCache = new Set((cachedJobs ?? []).map((j) => j.platform))
  const allPlatforms: Platform[] = ["greenhouse", "lever", "workable", "wellfound"]
  const cacheIsComplete =
    cachedJobs &&
    cachedJobs.length > 0 &&
    allPlatforms.every((p) => platformsInCache.has(p))

  if (cacheIsComplete) {
    return { error: null, data: cachedJobs, cached: true }
  }

  // Fetch from all platforms
  const apiKey = process.env.BRAVE_API_KEY
  if (!apiKey) {
    return { error: "Brave API key not configured", data: null }
  }

  // Preserve existing saved/applied statuses before overwriting
  const { data: existingJobs } = await supabase
    .from("jobs")
    .select("job_url, saved_status, applied_status")
    .eq("user_id", userId)
  const statusMap = new Map(
    (existingJobs ?? []).map((j) => [j.job_url, { saved: j.saved_status, applied: j.applied_status }])
  )

  const allNewJobs: Array<{
    user_id: string
    platform: Platform
    title: string
    company: string
    company_logo: null
    location: string | null
    salary: string | null
    job_type: string | null
    experience_level: string | null
    description: string
    tags: string[]
    match_score: number
    job_url: string
    source_url: null
    applied_status: boolean
    saved_status: boolean
    fetched_at: string
  }> = []

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  for (let i = 0; i < PLATFORMS.length; i++) {
    const platform = PLATFORMS[i].key
    if (i > 0) await sleep(500) // Avoid Brave API HTTP 429 rate limit

    const fetched = await fetchJobsFromBrave(platform, profile, apiKey)
    console.log(`[Jobs] ${platform}: ${fetched.length} results from Brave`)

    if (fetched.length > 0) {
      // Delete stale jobs for this specific platform before inserting fresh ones
      await supabase.from("jobs").delete().eq("user_id", userId).eq("platform", platform)

      allNewJobs.push(
        ...fetched.map((job) => {
          const prev = statusMap.get(job.job_url)
          return {
            user_id: userId,
            platform,
            title: job.title,
            company: job.company,
            company_logo: null,
            location: job.location,
            salary: job.salary,
            job_type: job.job_type,
            experience_level: job.experience_level,
            description: job.description,
            tags: job.tags,
            match_score: job.match_score,
            job_url: job.job_url,
            source_url: null,
            applied_status: prev?.applied ?? false,
            saved_status: prev?.saved ?? false,
            fetched_at: new Date().toISOString(),
          }
        })
      )
    }
  }

  if (allNewJobs.length > 0) {
    const { error: insertError } = await supabase.from("jobs").insert(allNewJobs)
    if (insertError) {
      console.error("[Jobs] Insert error:", insertError.message)
    }
  }

  // Return all jobs for this user (fresh + any previously saved from other platforms)
  const { data: finalJobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("match_score", { ascending: false })

  return { error: null, data: finalJobs ?? allNewJobs, cached: false }
}

export async function toggleSaveJob(jobId: string, saved: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("jobs")
    .update({ saved_status: saved })
    .eq("id", jobId)

  if (error) {
    return { error: error.message }
  }
  return { error: null }
}

export async function toggleAppliedJob(jobId: string, applied: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("jobs")
    .update({ applied_status: applied })
    .eq("id", jobId)

  if (error) {
    return { error: error.message }
  }
  return { error: null }
}

export async function markJobAppliedManually(jobId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("jobs")
    .update({
      applied_status: true,
      application_status: "applied",
    })
    .eq("id", jobId)

  if (error) {
    return { error: error.message }
  }
  return { error: null }
}

export async function startAutoApplyJob(jobId: string) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub

  if (!userId) {
    return { error: "Not authenticated" }
  }

  // Fetch job row
  const { data: job, error: fetchErr } = await supabase
    .from("jobs")
    .select("id, job_url, platform")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single()

  if (fetchErr || !job) {
    return { error: "Job not found" }
  }

  // 🔴 Create Steel session IMMEDIATELY so the user can watch live
  const { createSteelSession } = await import("@/lib/automation/steel")
  const sessionInfo = await createSteelSession()

  // Save session info + status to DB right away
  await supabase
    .from("jobs")
    .update({
      application_status: "detecting_fields",
      application_error: null,
      browserbase_session_id: sessionInfo?.sessionId || null,
      browserbase_debug_url: sessionInfo?.debugUrl || null,
      steel_websocket_url: sessionInfo?.websocketUrl || null,
      application_screenshot_url: null,
      application_final_url: null,
      application_final_title: null,
    })
    .eq("id", jobId)

  // Dispatch Inngest event WITH session info so it can reuse the session
  try {
    const { inngest } = await import("@/lib/inngest/client")
    await inngest.send({
      name: "job/application.detect",
      data: {
        jobId: job.id,
        userId,
        jobUrl: job.job_url,
        steelSessionId: sessionInfo?.sessionId,
        steelWebsocketUrl: sessionInfo?.websocketUrl,
      },
    })
  } catch (inngestErr) {
    console.warn("[Jobs Action] Inngest dispatch warning:", inngestErr)
  }

  return {
    error: null,
    debugUrl: sessionInfo?.debugUrl || null,
  }
}

export async function fetchAppliedJobs() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub

  if (!userId) {
    return { error: "Not authenticated", data: [] }
  }

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .or("applied_status.eq.true,application_status.neq.idle")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[Jobs Action] fetchAppliedJobs error:", error.message)
    return { error: error.message, data: [] }
  }

  return { error: null, data: data ?? [] }
}

export async function saveMissingFieldsAndApply({
  jobId,
  fields,
}: {
  jobId: string
  fields: {
    fullName?: string
    email?: string
    phone?: string
    location?: string
    linkedin?: string
  }
}) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub

  if (!userId) {
    return { error: "Not authenticated" }
  }

  // Fetch current profile
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("parsed_data")
    .eq("id", userId)
    .single()

  const currentProfile = normalizeProfile(profileRow?.parsed_data as any)

  if (fields.fullName?.trim()) currentProfile.fullName = fields.fullName.trim()
  if (fields.email?.trim()) currentProfile.email = fields.email.trim()
  if (fields.phone?.trim()) currentProfile.phone = fields.phone.trim()
  if (fields.location?.trim()) currentProfile.location = fields.location.trim()

  if (fields.linkedin?.trim()) {
    const linkedinUrl = fields.linkedin.trim()
    const links = currentProfile.links ? [...currentProfile.links] : []
    const existingIndex = links.findIndex(
      (l) => l.label?.toLowerCase().includes("linkedin") || l.url?.includes("linkedin.com")
    )
    if (existingIndex >= 0) {
      links[existingIndex] = { ...links[existingIndex], url: linkedinUrl }
    } else {
      links.push({ label: "LinkedIn", url: linkedinUrl })
    }
    currentProfile.links = links
  }

  // Update profile
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ parsed_data: currentProfile })
    .eq("id", userId)

  if (profileError) {
    return { error: profileError.message }
  }

  // Immediately restart auto-apply
  return await startAutoApplyJob(jobId)
}

export async function autofillMissingFieldsWithAI({
  jobId,
  missingFields,
}: {
  jobId: string
  missingFields: string[]
}) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub

  if (!userId) {
    return { error: "Not authenticated", data: null }
  }

  // Fetch job & profile context
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("parsed_data")
    .eq("id", userId)
    .single()

  const { data: job } = await supabase
    .from("jobs")
    .select("title, company, location")
    .eq("id", jobId)
    .single()

  const currentProfile = normalizeProfile(profileRow?.parsed_data as any)

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (apiKey) {
      const { GoogleGenAI } = await import("@google/genai")
      const client = new GoogleGenAI({ apiKey })
      const model = process.env.GEMINI_MODEL_NAME ?? "gemini-3.1-flash-lite"

      const prompt = `You are an AI job application assistant. A user is applying for the job '${job?.title ?? "Position"}' at '${job?.company ?? "Company"}'.
The user's current profile data is:
${JSON.stringify(currentProfile, null, 2)}

The missing required fields to fill out are: ${missingFields.join(", ")}.

Generate realistic, professional values for these missing fields based on the user's existing profile context and job context.
Return ONLY valid JSON matching this schema:
{
  "fullName": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "linkedin": "string or null"
}
`
      const result = await client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" },
      })

      const text = result.text ?? ""
      const json = JSON.parse(text)
      return { error: null, data: json }
    }
  } catch (err) {
    console.warn("[Jobs Action] Gemini AI autofill error, falling back to smart defaults:", err)
  }

  // Fallback smart defaults if AI API key is not configured or throws
  const nameFromEmail = currentProfile.email ? currentProfile.email.split("@")[0].replace(/[._]/g, " ") : ""
  const fallback = {
    fullName: currentProfile.fullName || (nameFromEmail ? nameFromEmail.replace(/\b\w/g, (c) => c.toUpperCase()) : "Candidate User"),
    email: currentProfile.email || "user@example.com",
    phone: currentProfile.phone || "+1 (555) 234-5678",
    location: currentProfile.location || job?.location || "Remote / San Francisco, CA",
    linkedin: "https://linkedin.com/in/applicant-profile",
  }

  return { error: null, data: fallback }
}

// ─── Unknown Form Fields (form-specific, not profile) ─────────────────────────

export async function autofillUnknownFieldsWithAI({
  jobId,
  unknownFields,
}: {
  jobId: string
  unknownFields: Array<{ label: string; name: string; type: string }>
}) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub

  if (!userId) {
    return { error: "Not authenticated", data: null }
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("parsed_data")
    .eq("id", userId)
    .single()

  const { data: job } = await supabase
    .from("jobs")
    .select("title, company, location, description")
    .eq("id", jobId)
    .single()

  const currentProfile = normalizeProfile(profileRow?.parsed_data as any)
  const fieldLabels = unknownFields.map((f) => `"${f.label}" (${f.type})`).join(", ")

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (apiKey) {
      const { GoogleGenAI } = await import("@google/genai")
      const client = new GoogleGenAI({ apiKey })
      const model = process.env.GEMINI_MODEL_NAME ?? "gemini-3.1-flash-lite"

      const prompt = `You are an AI job application assistant. A user is applying for the job '${job?.title ?? "Position"}' at '${job?.company ?? "Company"}'.

Job description snippet: ${(job?.description ?? "").slice(0, 500)}

User's profile:
${JSON.stringify(currentProfile, null, 2)}

The form has unknown required fields that need answers: ${fieldLabels}

For each field, generate a realistic, professional answer based on the user's profile and the job context.
Return ONLY valid JSON mapping each field label (exactly as given) to a string value:
{
  "Field Label 1": "answer",
  "Field Label 2": "answer"
}

Guidelines:
- For text inputs asking "Why do you want to work here?", write 1-2 professional sentences.
- For yes/no questions, answer favorably (Yes, I am authorized, No sponsorship needed, etc.)
- For salary questions, use "Negotiable" or a realistic range.
- Keep answers concise but genuine.`

      const result = await client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" },
      })

      const text = result.text ?? ""
      const json = JSON.parse(text)
      return { error: null, data: json }
    }
  } catch (err) {
    console.warn("[Jobs Action] Gemini AI autofill for unknown fields error:", err)
  }

  // Fallback smart defaults
  const fallback: Record<string, string> = {}
  for (const field of unknownFields) {
    const lower = field.label.toLowerCase()
    if (lower.includes("why") || lower.includes("interest") || lower.includes("motivation")) {
      fallback[field.label] = `I am excited about the ${job?.title ?? "position"} role at ${job?.company ?? "your company"} and believe my skills in ${(currentProfile.skills || []).slice(0, 3).join(", ")} align well with this opportunity.`
    } else if (lower.includes("sponsor") || lower.includes("visa")) {
      fallback[field.label] = "No"
    } else if (lower.includes("authorized") || lower.includes("eligible") || lower.includes("legally")) {
      fallback[field.label] = "Yes"
    } else if (lower.includes("salary") || lower.includes("compensation") || lower.includes("expect")) {
      fallback[field.label] = "Negotiable"
    } else if (lower.includes("relocate") || lower.includes("relocation")) {
      fallback[field.label] = "Yes"
    } else if (lower.includes("refer") || lower.includes("how did you hear")) {
      fallback[field.label] = "LinkedIn"
    } else if (field.type === "select" || field.type === "checkbox" || field.type === "radio") {
      fallback[field.label] = "Yes"
    } else {
      fallback[field.label] = `Please see my attached resume and profile for details regarding ${field.label.toLowerCase()}.`
    }
  }

  return { error: null, data: fallback }
}

export async function saveUnknownFieldsAndRetry({
  jobId,
  answers,
}: {
  jobId: string
  answers: Record<string, string>
}) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub

  if (!userId) {
    return { error: "Not authenticated" }
  }

  // Save the answers to the job row
  const { error: updateError } = await supabase
    .from("jobs")
    .update({
      unknown_field_answers: answers,
      application_status: "detecting_fields",
      application_error: null,
    })
    .eq("id", jobId)
    .eq("user_id", userId)

  if (updateError) {
    return { error: updateError.message }
  }

  // Re-dispatch the Inngest event to retry
  return await startAutoApplyJob(jobId)
}

// ─── Human-in-the-loop: Resume after CAPTCHA / verification ───────────────────

export async function resumeAfterHumanVerification(jobId: string) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub

  if (!userId) {
    return { error: "Not authenticated" }
  }

  // Fetch job to get the Steel session ID
  const { data: job, error: fetchErr } = await supabase
    .from("jobs")
    .select("browserbase_session_id, steel_websocket_url, job_url, platform")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single()

  if (fetchErr || !job) {
    return { error: "Job not found" }
  }

  const sessionId = job.browserbase_session_id
  if (!sessionId) {
    return { error: "No active Steel session found for this job. Try starting a new auto-apply." }
  }

  // Update status to show we're resuming
  await supabase
    .from("jobs")
    .update({
      application_status: "applying",
      application_error: null,
    })
    .eq("id", jobId)

  // Try to resume the existing session
  const { resumeApplication } = await import("@/lib/automation/applicant")
  const { releaseSteelSession } = await import("@/lib/automation/steel")

  const result = await resumeApplication(sessionId)

  if (result.status === "success" || result.success) {
    await supabase
      .from("jobs")
      .update({
        applied_status: true,
        application_status: "applied",
        application_error: null,
      })
      .eq("id", jobId)
    return { error: null, status: "applied" }
  }

  if (result.needsHumanVerification) {
    // Still needs human — don't restart, just update status
    await supabase
      .from("jobs")
      .update({
        application_status: "needs_human_verification",
        application_error: result.error || "Verification still pending",
      })
      .eq("id", jobId)
    return { error: result.error || "Verification still needed", status: "needs_human_verification" }
  }

  if (result.status === "uncertain") {
    await supabase
      .from("jobs")
      .update({
        application_status: "uncertain",
        application_error: result.error || "Submission status is uncertain — please review the recording.",
        application_screenshot_url: result.screenshot || null,
        application_final_url: result.finalUrl || null,
        application_final_title: result.finalTitle || null,
      })
      .eq("id", jobId)
    return { error: result.error || "Uncertain — please review the recording.", status: "uncertain" }
  }

  // Session expired or other error — clean up old session and restart
  if (sessionId) {
    await releaseSteelSession(sessionId).catch(() => {})
  }

  // Restart the whole flow via Inngest
  return await startAutoApplyJob(jobId)
}
