import { createSteelSession, releaseSteelSession, type SteelSessionInfo } from "./steel"
import { chromium } from "playwright-core"

export interface FormFieldDescriptor {
  name: string
  label: string
  type: "text" | "email" | "phone" | "file" | "textarea" | "select"
  required: boolean
  profileKey?: string // e.g. 'fullName', 'email', 'phone', 'location', 'resume', 'linkedin', 'github'
}

export interface DetectionResult {
  platform: string
  detectedFields: FormFieldDescriptor[]
  requiredFields: string[] // List of required profileKey values
  sessionId?: string
  debugUrl?: string
}

export function detectPlatformFromUrl(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes("greenhouse.io")) return "greenhouse"
  if (lower.includes("lever.co")) return "lever"
  if (lower.includes("workable.com")) return "workable"
  if (lower.includes("wellfound.com")) return "wellfound"
  return "general"
}

/**
 * Get hardcoded field definitions for known platforms — zero browser sessions.
 * Returns null for unknown/generic platforms that need live browser detection.
 */
export function getKnownPlatformFields(platform: string): FormFieldDescriptor[] | null {
  switch (platform) {
    case "greenhouse":
      return [
        { name: "first_name", label: "First Name", type: "text", required: true, profileKey: "fullName" },
        { name: "last_name", label: "Last Name", type: "text", required: true, profileKey: "fullName" },
        { name: "email", label: "Email", type: "email", required: true, profileKey: "email" },
        { name: "phone", label: "Phone", type: "phone", required: true, profileKey: "phone" },
        { name: "resume", label: "Resume/CV", type: "file", required: true, profileKey: "resume" },
        { name: "linkedin", label: "LinkedIn URL", type: "text", required: false, profileKey: "linkedin" },
      ]
    case "lever":
      return [
        { name: "name", label: "Full Name", type: "text", required: true, profileKey: "fullName" },
        { name: "email", label: "Email", type: "email", required: true, profileKey: "email" },
        { name: "phone", label: "Phone", type: "phone", required: true, profileKey: "phone" },
        { name: "resume", label: "Resume", type: "file", required: true, profileKey: "resume" },
        { name: "org", label: "Current Company", type: "text", required: false, profileKey: "currentCompany" },
        { name: "urls[LinkedIn]", label: "LinkedIn URL", type: "text", required: false, profileKey: "linkedin" },
        { name: "urls[GitHub]", label: "GitHub URL", type: "text", required: false, profileKey: "github" },
      ]
    case "workable":
      return [
        { name: "firstname", label: "First Name", type: "text", required: true, profileKey: "fullName" },
        { name: "lastname", label: "Last Name", type: "text", required: true, profileKey: "fullName" },
        { name: "email", label: "Email", type: "email", required: true, profileKey: "email" },
        { name: "phone", label: "Phone", type: "phone", required: true, profileKey: "phone" },
        { name: "resume", label: "Resume", type: "file", required: true, profileKey: "resume" },
      ]
    case "wellfound":
      // Wellfound is profile-first — only a note/cover letter field in the apply modal
      return [
        { name: "fullName", label: "Full Name", type: "text", required: true, profileKey: "fullName" },
        { name: "email", label: "Email", type: "email", required: true, profileKey: "email" },
        { name: "resume", label: "Resume/CV", type: "file", required: true, profileKey: "resume" },
      ]
    default:
      return null // Needs live browser detection
  }
}

/**
 * Map a label/name string to a profileKey using regex matching.
 */
function mapToProfileKey(label: string, name: string): string | undefined {
  const combined = `${label} ${name}`.toLowerCase()

  if (/name|full.?name|first.?name|last.?name/i.test(combined)) return "fullName"
  if (/email|e.?mail/i.test(combined)) return "email"
  if (/phone|tel|mobile|cell/i.test(combined)) return "phone"
  if (/location|city|address/i.test(combined)) return "location"
  if (/resume|cv|curriculum|upload.*file|attach/i.test(combined)) return "resume"
  if (/linkedin/i.test(combined)) return "linkedin"
  if (/github/i.test(combined)) return "github"
  if (/linkedin.*url|urls\[linkedin\]/i.test(combined)) return "linkedin"
  if (/portfolio|website|personal.*site/i.test(combined)) return "website"

  return undefined
}

/**
 * Detect form fields for a job application URL using Playwright DOM extraction.
 *
 * Optimization: For known platforms (Lever, Greenhouse, Workable, Wellfound),
 * returns hardcoded fields WITHOUT creating a Steel session.
 *
 * When `existingPage` is provided, reuses the active session instead of creating a new one.
 * The caller is responsible for cleanup.
 */
export async function detectFormFields(
  jobUrl: string,
  existingPage?: any
): Promise<DetectionResult> {
  const platform = detectPlatformFromUrl(jobUrl)
  console.log(`[Detector] Detecting fields for platform: ${platform}, URL: ${jobUrl}`)

  // ── Known platforms: no browser needed ──────────────────────────────────
  const knownFields = getKnownPlatformFields(platform)
  if (knownFields) {
    const requiredFields = Array.from(
      new Set(
        knownFields
          .filter((f) => f.required && f.profileKey)
          .map((f) => f.profileKey!)
      )
    )
    return {
      platform,
      detectedFields: knownFields,
      requiredFields,
    }
  }

  // ── Unknown platform: need live browser detection ───────────────────────
  let ownsSession = !existingPage
  let sessionInfo: SteelSessionInfo | null = null
  let page = existingPage ?? null

  try {
    if (!page) {
      sessionInfo = await createSteelSession()
      if (!sessionInfo) {
        throw new Error("Failed to create Steel session")
      }

      const browser = await chromium.connectOverCDP(sessionInfo.websocketUrl)
      const context = browser.contexts()[0]
      page = context.pages()[0] || (await context.newPage())
    }

    await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 30000 })
    await page.waitForTimeout(2000)

    // Extract form fields via DOM inspection
    const detectedFields: FormFieldDescriptor[] = []

    try {
      const extracted = await page.evaluate(() => {
        const fields: Array<{
          name: string
          label: string
          type: string
          required: boolean
        }> = []

        const inputs = document.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
        )

        inputs.forEach((el) => {
          const input = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
          const name = input.getAttribute("name") || input.getAttribute("id") || ""
          const required = input.hasAttribute("required") || input.getAttribute("aria-required") === "true"

          // Find associated label
          let label = ""
          const id = input.getAttribute("id")
          if (id) {
            const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`)
            if (labelEl) {
              label = (labelEl.textContent || "").trim()
            }
          }
          if (!label) {
            // Try parent label
            const parentLabel = input.closest("label")
            if (parentLabel) {
              label = (parentLabel.textContent || "").replace(/\s+/g, " ").trim()
            }
          }
          if (!label) {
            // Try preceding sibling or aria-label
            label = input.getAttribute("aria-label") || input.getAttribute("placeholder") || ""
          }

          let type = input.getAttribute("type") || "text"
          if (input.tagName === "SELECT") type = "select"
          if (input.tagName === "TEXTAREA") type = "textarea"
          if (type === "tel") type = "phone"

          fields.push({ name, label, type, required })
        })

        return fields
      })

      for (const field of extracted) {
        const profileKey = mapToProfileKey(field.label, field.name)
        detectedFields.push({
          name: field.name,
          label: field.label || field.name || "Unknown",
          type: field.type as FormFieldDescriptor["type"],
          required: field.required,
          profileKey,
        })
      }
    } catch (err) {
      console.warn("[Detector] DOM extraction failed, using fallback:", err)
    }

    // Ensure at least basic fields are present
    if (detectedFields.length === 0) {
      detectedFields.push(
        { name: "fullName", label: "Full Name", type: "text", required: true, profileKey: "fullName" },
        { name: "email", label: "Email", type: "email", required: true, profileKey: "email" },
        { name: "phone", label: "Phone", type: "phone", required: true, profileKey: "phone" },
        { name: "resume", label: "Resume/CV", type: "file", required: true, profileKey: "resume" },
      )
    }

    const requiredFields = Array.from(
      new Set(
        detectedFields
          .filter((f) => f.required && f.profileKey)
          .map((f) => f.profileKey!)
      )
    )

    return {
      platform,
      detectedFields,
      requiredFields,
      sessionId: sessionInfo?.sessionId,
      debugUrl: sessionInfo?.debugUrl,
    }
  } catch (error) {
    console.error("[Detector] Field detection error:", error)
    return {
      platform,
      detectedFields: [
        { name: "fullName", label: "Full Name", type: "text", required: true, profileKey: "fullName" },
        { name: "email", label: "Email", type: "email", required: true, profileKey: "email" },
        { name: "phone", label: "Phone", type: "phone", required: true, profileKey: "phone" },
        { name: "resume", label: "Resume/CV", type: "file", required: true, profileKey: "resume" },
      ],
      requiredFields: ["fullName", "email", "phone", "resume"],
      sessionId: sessionInfo?.sessionId,
      debugUrl: sessionInfo?.debugUrl,
    }
  } finally {
    // Only clean up if we created the session ourselves
    if (ownsSession && sessionInfo) {
      if (page) {
        try {
          const browser = page.context().browser()
          if (browser) await browser.close()
        } catch { /* ignore */ }
      }
      await releaseSteelSession(sessionInfo.sessionId).catch(() => {})
    }
  }
}
