import { inngest } from "../client"
import {
  detectFormFields,
  detectPlatformFromUrl,
  getKnownPlatformFields,
} from "@/lib/automation/detector"
import { submitJobApplication } from "@/lib/automation/applicant"
import { createSteelSession, releaseSteelSession } from "@/lib/automation/steel"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeProfile, type ResumeProfile } from "@/lib/resume/schema"
import { chromium } from "playwright-core"

export const detectJobFieldsFunction = inngest.createFunction(
  {
    id: "detect-job-fields",
    triggers: [{ event: "job/application.detect" }],
    onFailure: async ({ error, event }) => {
      const jobId = (event.data as any)?.event?.data?.jobId as string | undefined
      if (!jobId) return
      const supabase = createAdminClient()
      await supabase
        .from("jobs")
        .update({
          application_status: "failed",
          application_error: error?.message ?? "Application processing failed after all retries",
        })
        .eq("id", jobId)
    },
  },
  async ({ event, step }) => {
    const { jobId, userId, jobUrl, steelSessionId, steelWebsocketUrl } = event.data as any

    // Step 1: Set status to detecting_fields
    await step.run("update-status-detecting", async () => {
      const supabase = createAdminClient()
      await supabase
        .from("jobs")
        .update({
          application_status: "detecting_fields",
          application_error: null,
        })
        .eq("id", jobId)
    })

    // Step 2: Validate user profile (no browser needed)
    const validationResult = await step.run("validate-user-profile", async () => {
      const supabase = createAdminClient()
      const { data: profileData } = await supabase
        .from("profiles")
        .select("parsed_data")
        .eq("id", userId)
        .single()

      const profile: ResumeProfile = normalizeProfile(profileData?.parsed_data as any)

      // Determine which fields are required based on the platform
      const platform = detectPlatformFromUrl(jobUrl)
      const knownFields = getKnownPlatformFields(platform)
      const requiredProfileKeys = knownFields
        ? knownFields.filter((f) => f.required && f.profileKey).map((f) => f.profileKey!)
        : ["fullName", "email", "phone", "resume"] // generic fallback

      const missing: string[] = []

      for (const key of requiredProfileKeys) {
        if (key === "fullName" && !profile.fullName) missing.push("Full Name")
        if (key === "email" && !profile.email) missing.push("Email")
        if (key === "phone" && !profile.phone) missing.push("Phone")
        if (key === "location" && !profile.location) missing.push("Location")
        if (key === "linkedin") {
          const hasLinkedin = profile.links?.some(
            (l) => l.label?.toLowerCase().includes("linkedin") || l.url?.includes("linkedin.com")
          )
          if (!hasLinkedin) missing.push("LinkedIn URL")
        }
        if (key === "resume") {
          const { data: resumeRow } = await supabase
            .from("resumes")
            .select("id")
            .eq("user_id", userId)
            .limit(1)
          if (!resumeRow || resumeRow.length === 0) {
            missing.push("Resume PDF File")
          }
        }
      }

      return {
        isComplete: missing.length === 0,
        missingFields: missing,
        profile,
        platform,
      }
    })

    // Step 3: If profile incomplete, save and exit (0 sessions burned for known platforms!)
    if (!validationResult.isComplete) {
      await step.run("save-missing-fields", async () => {
        const supabase = createAdminClient()
        await supabase
          .from("jobs")
          .update({
            application_status: "missing_profile_info",
            missing_fields: validationResult.missingFields,
            detected_fields: getKnownPlatformFields(validationResult.platform) || [],
            application_error: null,
          })
          .eq("id", jobId)
      })

      return {
        status: "missing_profile_info",
        missingFields: validationResult.missingFields,
      }
    }

    // Step 4: Profile complete → Detect fields + Submit in ONE session
    const result = await step.run("detect-and-submit", async () => {
      const { profile, platform } = validationResult

      // Load resume for submission
      let resumeBuffer: Buffer | null = null
      let resumeFileName: string | null = null
      {
        const supabase = createAdminClient()
        const { data: resumeRows } = await supabase
          .from("resumes")
          .select("file_name, storage_path")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)

        if (resumeRows && resumeRows.length > 0) {
          const row = resumeRows[0]
          resumeFileName = row.file_name
          const { data: fileData } = await supabase.storage
            .from("resumes")
            .download(row.storage_path)

          if (fileData) {
            const arrayBuffer = await fileData.arrayBuffer()
            resumeBuffer = Buffer.from(arrayBuffer)
          }
        }
      }

      // ── Load unknown_field_answers + job context from DB (retry flow) ──
      const { unknownFieldAnswers, jobContext } = await (async () => {
        const supabase = createAdminClient()
        const { data: jobRow } = await supabase
          .from("jobs")
          .select("unknown_field_answers, title, company, description")
          .eq("id", jobId)
          .single()
        return {
          unknownFieldAnswers: (jobRow?.unknown_field_answers as Record<string, string>) || undefined,
          jobContext: jobRow ? { title: jobRow.title, company: jobRow.company, description: jobRow.description || undefined } : undefined,
        }
      })()

      // OPTIMIZATION: For known platforms, skip browser-based detection entirely.
      const isGeneric = !getKnownPlatformFields(platform)

      // 🔴 Reuse pre-created Steel session from server action (live view!)
      // If no pre-created session, create one (fallback for retries/restarts)
      let sessionInfo
      let ownsSession = false

      if (steelSessionId && steelWebsocketUrl) {
        console.log(`[DetectFields] Reusing pre-created session: ${steelSessionId}`)
        sessionInfo = { sessionId: steelSessionId, websocketUrl: steelWebsocketUrl }
      } else {
        sessionInfo = await createSteelSession()
        ownsSession = true
      }

      if (!sessionInfo) {
        throw new Error("Failed to create Steel browser session. Check STEEL_API_KEY.")
      }

      let browser: any = null
      let page: any = null
      let needsHuman = false

      try {
        browser = await chromium.connectOverCDP(sessionInfo.websocketUrl)
        const context = browser.contexts()[0]
        page = context.pages()[0] || (await context.newPage())

        // ── Detect fields (only needed for generic platforms) ──────────────
        let detectedFields: any[] = []
        let finalPlatform = platform

        if (isGeneric) {
          console.log(`[DetectFields] Generic platform — detecting fields in shared session`)
          const detection = await detectFormFields(jobUrl, page)
          detectedFields = detection.detectedFields
          finalPlatform = detection.platform
        } else {
          detectedFields = getKnownPlatformFields(platform)!
          console.log(`[DetectFields] Known platform '${platform}' — using hardcoded fields`)
        }

        // Update DB with detection results before submitting
        {
          const supabase = createAdminClient()
          await supabase
            .from("jobs")
            .update({
              application_status: "applying",
              missing_fields: [],
              detected_fields: detectedFields,
              browserbase_session_id: sessionInfo.sessionId || null,
              browserbase_debug_url: sessionInfo.debugUrl || null,
              application_error: null,
            })
            .eq("id", jobId)
        }

        // ── Submit application in the SAME session ─────────────────────────
        console.log(`[DetectFields] Submitting application in shared Steel session`)
        const submission = await submitJobApplication({
          jobUrl,
          platform: finalPlatform,
          profile,
          resumeFileBuffer: resumeBuffer,
          resumeFileName,
          page,
          unknownFieldAnswers,
          jobContext,
        })

        // ── Save final result ──────────────────────────────────────────────
        {
          const supabase = createAdminClient()
          if (submission.status === "success" || submission.success) {
            await supabase
              .from("jobs")
              .update({
                applied_status: true,
                application_status: "applied",
                browserbase_session_id: submission.sessionId || sessionInfo.sessionId || null,
                browserbase_debug_url: submission.debugUrl || sessionInfo.debugUrl || null,
                steel_websocket_url: submission.websocketUrl || sessionInfo.websocketUrl || null,
                application_error: null,
                application_screenshot_url: submission.screenshot || null,
                application_final_url: submission.finalUrl || null,
                application_final_title: submission.finalTitle || null,
              })
              .eq("id", jobId)
          } else if (submission.needsHumanVerification) {
            await supabase
              .from("jobs")
              .update({
                application_status: "needs_human_verification",
                browserbase_session_id: submission.sessionId || sessionInfo.sessionId || null,
                browserbase_debug_url: submission.debugUrl || sessionInfo.debugUrl || null,
                steel_websocket_url: submission.websocketUrl || sessionInfo.websocketUrl || null,
                application_error: submission.error || "Human verification required",
                unknown_form_fields: submission.unknownFields || [],
                application_screenshot_url: submission.screenshot || null,
                application_final_url: submission.finalUrl || null,
                application_final_title: submission.finalTitle || null,
              })
              .eq("id", jobId)
          } else if (submission.status === "uncertain") {
            await supabase
              .from("jobs")
              .update({
                application_status: "uncertain",
                browserbase_session_id: submission.sessionId || sessionInfo.sessionId || null,
                browserbase_debug_url: submission.debugUrl || sessionInfo.debugUrl || null,
                steel_websocket_url: submission.websocketUrl || sessionInfo.websocketUrl || null,
                application_error: submission.error || "Submission status is uncertain — please review the recording.",
                unknown_form_fields: submission.unknownFields || [],
                application_screenshot_url: submission.screenshot || null,
                application_final_url: submission.finalUrl || null,
                application_final_title: submission.finalTitle || null,
              })
              .eq("id", jobId)
          } else {
            await supabase
              .from("jobs")
              .update({
                application_status: submission.unknownFields?.length ? "unknown_form_fields" : "failed",
                browserbase_session_id: submission.sessionId || sessionInfo.sessionId || null,
                browserbase_debug_url: submission.debugUrl || sessionInfo.debugUrl || null,
                steel_websocket_url: submission.websocketUrl || sessionInfo.websocketUrl || null,
                application_error: submission.error || "Submission failed",
                unknown_form_fields: submission.unknownFields || [],
                application_screenshot_url: submission.screenshot || null,
                application_final_url: submission.finalUrl || null,
                application_final_title: submission.finalTitle || null,
              })
              .eq("id", jobId)
          }
        }

        needsHuman = submission.needsHumanVerification || false

        return {
          success: submission.success,
          sessionId: submission.sessionId || sessionInfo.sessionId,
          debugUrl: submission.debugUrl || sessionInfo.debugUrl,
          error: submission.error,
          needsHumanVerification: needsHuman,
        }
      } finally {
        // DON'T close the session if human verification is needed!
        if (needsHuman) {
          console.log("[DetectFields] ⚠️  Keeping Steel session alive for human intervention.")
        } else {
          if (browser) {
            try { await browser.close() } catch {}
          }
          // Only release if we created the session (session from server action stays alive)
          if (ownsSession) {
            await releaseSteelSession(sessionInfo.sessionId).catch(() => {})
          }
        }
      }
    })

    return {
      status: result.success ? "applied" : "failed",
      error: result.error,
    }
  }
)
