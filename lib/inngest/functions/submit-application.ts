import { inngest } from "../client"
import { submitJobApplication } from "@/lib/automation/applicant"
import { createSteelSession, releaseSteelSession } from "@/lib/automation/steel"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeProfile, type ResumeProfile } from "@/lib/resume/schema"
import { chromium } from "playwright-core"

export const submitJobApplicationFunction = inngest.createFunction(
  {
    id: "submit-job-application",
    triggers: [{ event: "job/application.submit" }],
    concurrency: {
      limit: 1, // Execute application tasks one by one to avoid conflicts or rate-limit issues
    },
    onFailure: async ({ error, event }) => {
      const jobId = (event.data as any)?.event?.data?.jobId as string | undefined
      if (!jobId) return
      const supabase = createAdminClient()
      await supabase
        .from("jobs")
        .update({
          application_status: "failed",
          application_error: error?.message ?? "Application submission failed after all retries",
        })
        .eq("id", jobId)
    },
  },
  async ({ event, step }) => {
    const { jobId, userId, jobUrl, platform, steelSessionId, steelWebsocketUrl } = event.data as any

    // Step 1: Set status to applying
    await step.run("update-status-applying", async () => {
      const supabase = createAdminClient()
      await supabase
        .from("jobs")
        .update({
          application_status: "applying",
          application_error: null,
        })
        .eq("id", jobId)
    })

    // Step 2: Fetch user profile & resume file from Supabase Storage
    const { profile, resumeBuffer, resumeFileName } = await step.run("load-user-data", async () => {
      const supabase = createAdminClient()
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("parsed_data")
        .eq("id", userId)
        .single()

      const userProfile: ResumeProfile = normalizeProfile(profileRow?.parsed_data as any)

      let fileBuffer: Buffer | null = null
      let fileName: string | null = null

      const { data: resumeRows } = await supabase
        .from("resumes")
        .select("file_name, storage_path")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)

      if (resumeRows && resumeRows.length > 0) {
        const row = resumeRows[0]
        fileName = row.file_name
        const { data: fileData, error: downloadErr } = await supabase.storage
          .from("resumes")
          .download(row.storage_path)

        if (fileData && !downloadErr) {
          const arrayBuffer = await fileData.arrayBuffer()
          fileBuffer = Buffer.from(arrayBuffer)
        }
      }

      return {
        profile: userProfile,
        resumeBuffer: fileBuffer ? fileBuffer.toString("base64") : null,
        resumeFileName: fileName,
      }
    })

    // Step 3: Run Steel form filler & submitter via Playwright
    const submission = await step.run("execute-steel-submission", async () => {
      const buffer = resumeBuffer ? Buffer.from(resumeBuffer, "base64") : null

      // ── Load unknown_field_answers + job context from DB (retry flow) ──
      const supabase = createAdminClient()
      const { data: jobRow } = await supabase
        .from("jobs")
        .select("unknown_field_answers, title, company, description")
        .eq("id", jobId)
        .single()
      const unknownFieldAnswers = (jobRow?.unknown_field_answers as Record<string, string>) || undefined
      const jobContext = jobRow ? { title: jobRow.title, company: jobRow.company, description: jobRow.description || undefined } : undefined

      // Create Steel session for the submission

      let sessionInfo
      let ownsSession = false

      if (steelSessionId && steelWebsocketUrl) {
        console.log(`[SubmitApp] Reusing pre-created session: ${steelSessionId}`)
        sessionInfo = { sessionId: steelSessionId, websocketUrl: steelWebsocketUrl }
      } else {
        // Fallback for retries: try to get session from DB, otherwise create new
        const { data: jobRow } = await supabase
          .from("jobs")
          .select("browserbase_session_id, steel_websocket_url")
          .eq("id", jobId)
          .single()
        if (jobRow?.browserbase_session_id && jobRow?.steel_websocket_url) {
          sessionInfo = { sessionId: jobRow.browserbase_session_id, websocketUrl: jobRow.steel_websocket_url }
        } else {
          sessionInfo = await createSteelSession()
          ownsSession = true
        }
      }

      if (!sessionInfo) {
        throw new Error("Failed to create Steel browser session. Check STEEL_API_KEY.")
      }

      let browser: any = null
      let submissionResult: any = null
      try {
        browser = await chromium.connectOverCDP(sessionInfo.websocketUrl)
        const context = browser.contexts()[0]
        const page = context.pages()[0] || (await context.newPage())

        const result = await submitJobApplication({
          jobUrl,
          platform: platform || "general",
          profile,
          resumeFileBuffer: buffer,
          resumeFileName,
          page,
          unknownFieldAnswers,
          jobContext,
        })

        const needsHuman = result.needsHumanVerification || false

        submissionResult = result
        return {
          ...result,
          sessionId: result.sessionId || sessionInfo.sessionId,
          debugUrl: result.debugUrl || sessionInfo.debugUrl,
          needsHumanVerification: needsHuman,
        }
      } finally {
        // DON'T close the session if human verification is needed!
        if (submissionResult?.needsHumanVerification) {
          console.log("[SubmitApp] ⚠️  Keeping Steel session alive for human intervention.")
        } else {
          if (browser) {
            try { await browser.close() } catch {}
          }
          if (ownsSession) {
            await releaseSteelSession(sessionInfo?.sessionId).catch(() => {})
          }
        }
      }
    })

    // Step 4: Update database status based on result
    await step.run("save-submission-result", async () => {
      const supabase = createAdminClient()

      if (submission.status === "success" || submission.success) {
        await supabase
          .from("jobs")
          .update({
            applied_status: true,
            application_status: "applied",
            browserbase_session_id: submission.sessionId || null,
            browserbase_debug_url: submission.debugUrl || null,
            steel_websocket_url: submission.websocketUrl || null,
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
            browserbase_session_id: submission.sessionId || null,
            browserbase_debug_url: submission.debugUrl || null,
            steel_websocket_url: submission.websocketUrl || null,
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
            browserbase_session_id: submission.sessionId || null,
            browserbase_debug_url: submission.debugUrl || null,
            steel_websocket_url: submission.websocketUrl || null,
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
            browserbase_session_id: submission.sessionId || null,
            browserbase_debug_url: submission.debugUrl || null,
            steel_websocket_url: submission.websocketUrl || null,
            application_error: submission.error || "Submission failed",
            unknown_form_fields: submission.unknownFields || [],
            application_screenshot_url: submission.screenshot || null,
            application_final_url: submission.finalUrl || null,
            application_final_title: submission.finalTitle || null,
          })
          .eq("id", jobId)
      }
    })

    return {
      success: submission.success,
      sessionId: submission.sessionId,
      error: submission.error,
    }
  }
)
