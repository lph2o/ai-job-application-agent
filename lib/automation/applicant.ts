import { createSteelSession, getSteelSession, releaseSteelSession, type SteelSessionInfo } from "./steel"
import { solveCaptchaAuto } from "./captcha-solver"
import { chromium } from "playwright-core"
// Platforms supported: lever | greenhouse | wellfound | workable (adaptive) | generic (adaptive)
import type { ResumeProfile } from "@/lib/resume/schema"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"

export interface UnknownFormField {
  label: string
  name: string
  type: "text" | "email" | "phone" | "textarea" | "select" | "checkbox" | "radio"
}

export interface ApplicationSubmissionParams {
  jobUrl: string
  platform: string
  profile: ResumeProfile
  resumeFileBuffer?: Buffer | null
  resumeFileName?: string | null
  page?: any
  unknownFieldAnswers?: Record<string, string>
  /** Job context for AI-powered smart field filling. */
  jobContext?: {
    title: string
    company: string
    description?: string
  }
}

export type SubmissionStatus = "success" | "failed" | "uncertain"

export interface SubmissionResult {
  /** @deprecated Use `status` instead. Kept for backwards compatibility. */
  success: boolean
  status?: SubmissionStatus
  sessionId?: string
  debugUrl?: string
  websocketUrl?: string
  error?: string
  /** Unknown required fields that blocked the submission. */
  unknownFields?: UnknownFormField[]
  /** When true, the Steel session is kept alive for human intervention. */
  needsHumanVerification?: boolean
  /** Base64 PNG screenshot of the final page state (for debugging). */
  screenshot?: string
  /** Final page URL at the time of verification. */
  finalUrl?: string
  /** Final page title at the time of verification. */
  finalTitle?: string
}

// ─── Overlay Dismissal (Cookie Banners, GDPR, Popups) ────────────────────────

async function dismissOverlays(page: any): Promise<void> {
  console.log("[Applicant] 🔍 Scanning for overlays (cookies/modals)...")

  // ── 1. Cookie Banners & GDPR Consent Walls ───────────────────────────────
  try {
    const cookieSelectors = [
      // OneTrust (enterprise cookie system)
      "#onetrust-accept-btn-handler",
      "#onetrust-reject-all-handler",
      // Generic cookie consent buttons
      'button:has-text("Accept All Cookies")',
      'button:has-text("Accept All")',
      'button:has-text("Allow All Cookies")',
      'button:has-text("Allow All")',
      'button:has-text("Accept Cookies")',
      'button:has-text("Accept")',
      'button:has-text("I Accept")',
      'button:has-text("Accept & Close")',
      'button:has-text("Allow Cookies")',
      'button:has-text("Allow")',
      'button:has-text("OK")',
      'button:has-text("Okay")',
      'button:has-text("Got it")',
      'button:has-text("Got It")',
      'button:has-text("Agree")',
      'button:has-text("I Agree")',
      'button:has-text("Agree & Continue")',
      'button:has-text("Consent")',
      'button:has-text("I Consent")',
      'button:has-text("Continue")',
      'button:has-text("Continue to Site")',
      'button:has-text("Yes, I Accept")',
      'button:has-text("Confirm")',
      'button:has-text("Confirm Choices")',
      'button:has-text("Save Settings")',
      'button:has-text("Save & Accept")',
      'button:has-text("Close")',
      'button:has-text("Dismiss")',
      'a:has-text("Accept Cookies")',
      'a:has-text("Accept")',
      'a:has-text("Got it")',
      // Generic cookie banner containers with accept button
      '[id*="cookie" i] button:has-text("Accept")',
      '[class*="cookie" i] button:has-text("Accept")',
      '[id*="cookie" i] button:has-text("Allow")',
      '[class*="cookie" i] button:has-text("Allow")',
      '[aria-label*="cookie" i] button, [aria-label*="cookie" i] a',
      '[id*="consent" i] button:has-text("Accept")',
      '[class*="consent" i] button:has-text("Accept")',
      '[id*="gdpr" i] button:has-text("Accept")',
      '[class*="gdpr" i] button:has-text("Accept")',
      '[id*="notice" i] button:has-text("Accept")',
      '[class*="notice" i] button:has-text("Accept")',
      // Floating cookie bar accept buttons
      '[class*="cookie-bar"] button',
      '[class*="cookie-banner"] button',
    ]

    let dismissedCookie = false
    for (const sel of cookieSelectors) {
      try {
        const loc = page.locator(sel)
        const count = await loc.count().catch(() => 0)
        if (count > 0) {
          const btn = loc.first()
          if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
            await btn.click({ timeout: 2000, force: true })
            console.log(`[Applicant] ✅ Dismissed cookie/conset overlay: ${sel}`)
            dismissedCookie = true
            await page.waitForTimeout(800)
            break
          }
        }
      } catch { /* try next */ }
    }

    // Semantic fallback: use Playwright's getByRole with regex
    if (!dismissedCookie) {
      try {
        const btn = page.getByRole("button", {
          name: /accept all|allow all|accept cookies|i accept|got it|consent|agree|ok\b|continue|akzeptieren|accepter|aceptar|accetta|同意|承認/i
        })
        const count = await btn.count().catch(() => 0)
        if (count > 0 && await btn.first().isVisible({ timeout: 500 }).catch(() => false)) {
          await btn.first().click({ timeout: 2000, force: true })
          console.log("[Applicant] ✅ Dismissed cookie overlay via getByRole")
        }
      } catch {}
    }
  } catch { /* non-fatal */ }

  // ── 2. Newsletter / Promotional Popups / Generic Modals ──────────────────
  try {
    const modalCloseSelectors = [
      'button:has-text("No thanks")',
      'button:has-text("No, thanks")',
      'button:has-text("Maybe later")',
      'button:has-text("Not now")',
      'button:has-text("Not right now")',
      'button:has-text("Skip")',
      'button:has-text("Remind me later")',
      'button[aria-label="Close"]',
      'button[aria-label="Dismiss"]',
      'button[aria-label="Close modal"]',
      'button[aria-label="Close dialog"]',
      '[aria-label="Close modal"]',
      '[aria-label="Close dialog"]',
      '[aria-label="Close"]',
      '.modal-close',
      '.modal__close',
      '.popup-close',
      '.popup__close',
      '.close-button',
      '.close-btn',
      'button[class*="close" i]',
      'button[class*="dismiss" i]',
      'a[aria-label="Close"]',
      'a[aria-label="Dismiss"]',
      'svg[aria-label="Close"]',
      '[data-testid="close-button"]',
      '[data-dismiss="modal"]',
    ]

    for (const sel of modalCloseSelectors) {
      try {
        const loc = page.locator(sel)
        const count = await loc.count().catch(() => 0)
        if (count > 0 && await loc.first().isVisible({ timeout: 500 }).catch(() => false)) {
          await loc.first().click({ timeout: 1500, force: true })
          console.log(`[Applicant] ✅ Dismissed modal/popup: ${sel}`)
          await page.waitForTimeout(500)
        }
      } catch { /* try next */ }
    }
  } catch { /* non-fatal */ }

  // ── 3. Fallback: Press Escape to clear any remaining overlays ────────────
  try {
    await page.keyboard.press("Escape")
  } catch {}

  console.log("[Applicant] Overlay scan complete.")
}

/**
 * Check if a select value looks like a placeholder (not actually filled).
 */
function isPlaceholderValue(val: string): boolean {
  const trimmed = val.trim()
  if (!trimmed) return true
  const lower = trimmed.toLowerCase()
  const patterns = [
    /^select[.…]*$/, /^choose[.…]*$/, /^pick[.…]*$/,
    /^--/, /^please select/i, /^select one/i, /^make a selection/i,
    /^- select -/i, /^none$/i, /^n\/a$/i,
  ]
  return patterns.some((p) => p.test(lower))
}

/**
 * Fallback: When Playwright selectors miss filling selects/radios, force-fill them
 * with sensible defaults so the form submission isn't blocked.
 * Handles both <select> elements, radio button groups, and checkboxes.
 */
async function fillRemainingDropdownsFallback(page: any) {
  try {
    const selectCount = await page.locator("select").count().catch(() => 0)
    let filled = 0

    for (let i = 0; i < selectCount; i++) {
      try {
        const select = page.locator("select").nth(i)
        const currentVal = await select.inputValue().catch(() => "")

        // Skip if already filled with a real value (not a placeholder)
        if (currentVal && currentVal.trim() !== "" && !isPlaceholderValue(currentVal)) continue

        // Check if this select is required OR has a placeholder value
        const isRequired = await select.evaluate(
          (el: HTMLSelectElement) => el.hasAttribute("required") || el.getAttribute("aria-required") === "true"
        ).catch(() => false)

        const options: Array<{ val: string; text: string }> = await select
          .locator("option")
          .evaluateAll((opts: HTMLOptionElement[]) =>
            opts
              .filter((o) => o.value && o.value.trim() !== "" && !isPlaceholderValue(o.value))
              .map((o) => ({ val: o.value, text: (o.innerText || o.textContent || "").toLowerCase().trim() }))
          )

        if (options.length === 0) continue

        // Smart fallback: pick the safest option based on label context
        const selectId = (await select.getAttribute("id").catch(() => null)) || ""
        const selectName = ((await select.getAttribute("name").catch(() => null)) || "").toLowerCase()
        const parentLabel = await select.evaluate((el: HTMLSelectElement) => {
          const label = el.closest("label")
          return label ? (label.textContent || "").toLowerCase().trim() : ""
        }).catch(() => "")

        const context = `${selectId} ${selectName} ${parentLabel}`.toLowerCase()

        // Pick answer based on context
        let safeOpt: { val: string; text: string } | undefined

        // Gender questions
        if (context.includes("gender") || context.includes("sex")) {
          safeOpt = options.find((o) => o.text.includes("prefer not") || o.text.includes("decline"))
            ?? options.find((o) => o.text === "male" || o.text === "man")
            ?? options[0]
        }
        // Ethnicity / Race
        else if (context.includes("ethnic") || context.includes("race")) {
          safeOpt = options.find((o) => o.text.includes("prefer not") || o.text.includes("decline"))
            ?? options[0]
        }
        // Disability
        else if (context.includes("disab")) {
          safeOpt = options.find((o) => o.text.includes("prefer not") || o.text.includes("decline"))
            ?? options.find((o) => o.text === "no")
            ?? options[0]
        }
        // Work authorization / Right to work
        else if (context.includes("authori") || context.includes("right to work") || context.includes("eligible") || context.includes("legally")) {
          safeOpt = options.find((o) => o.text === "yes" || o.text.includes("i am") || o.text.includes("authori"))
            ?? options[0]
        }
        // Sponsorship / Visa
        else if (context.includes("sponsor") || context.includes("visa")) {
          safeOpt = options.find((o) => o.text === "no" || o.text.includes("do not") || o.text.includes("not require"))
            ?? options[0]
        }
        // How did you hear / referral
        else if (context.includes("hear about") || context.includes("refer") || context.includes("source")) {
          safeOpt = options.find((o) => o.text.includes("linkedin"))
            ?? options.find((o) => o.text.includes("website") || o.text.includes("company"))
            ?? options.find((o) => o.text === "other")
            ?? options[0]
        }
        // Relocation
        else if (context.includes("relocat")) {
          safeOpt = options.find((o) => o.text === "yes" || o.text.includes("willing"))
            ?? options[0]
        }
        // Name-related questions (e.g., "Have you added your full legal name?")
        else if (context.includes("legal name") || context.includes("full name") || context.includes("surname")) {
          safeOpt = options.find((o) => o.text === "yes" || o.text.includes("i have"))
            ?? options[0]
        }
        // Default fallbacks
        else {
          safeOpt =
            options.find(
              (o) =>
                o.text.includes("prefer not") ||
                o.text.includes("decline") ||
                o.text.includes("do not wish")
            ) ??
            options.find((o) => o.text === "no" || o.text.includes("i do not")) ??
            options.find((o) => o.text === "yes" || o.text.includes("i am")) ??
            options[options.length > 1 ? 1 : 0]
        }

        await select.selectOption(safeOpt!.val).catch(() => {})
        filled++
        console.log(
          isPlaceholderValue(currentVal)
            ? `[Applicant/Fallback] Replaced placeholder in select: '${safeOpt!.text.slice(0, 40)}'`
            : `[Applicant/Fallback] Auto-selected '${safeOpt!.text.slice(0, 40)}' in empty select`
        )
      } catch {
        // Individual select failure is non-fatal
      }
    }

    // ── Radio buttons: find groups where nothing is checked ──────────────────
    try {
      const radioCount = await page.locator('input[type="radio"]').count().catch(() => 0)
      if (radioCount > 0) {
        const radioInfo = await page.locator('input[type="radio"]').evaluateAll(
          (radios: HTMLInputElement[]) =>
            radios.map((r, idx) => ({
              idx,
              name: r.getAttribute("name") || "",
              checked: r.checked,
              label: (() => {
                const id = r.getAttribute("id")
                if (id) {
                  const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`)
                  if (lbl) return lbl.textContent?.toLowerCase() || ""
                }
                const parent = r.closest("label")
                if (parent) return parent.textContent?.toLowerCase() || ""
                return r.getAttribute("value")?.toLowerCase() || ""
              })(),
            }))
        )

        const groups = new Map<string, Array<{ idx: number; checked: boolean; label: string }>>()
        for (const info of radioInfo) {
          if (!info.name) continue
          if (!groups.has(info.name)) groups.set(info.name, [])
          groups.get(info.name)!.push(info)
        }

        for (const [groupName, radios] of groups) {
          if (radios.some((r) => r.checked)) continue

          const context = groupName.toLowerCase()
          let chosenIdx: number | undefined

          const pickRadioByContext = () => {
            // Demographic / privacy-preserving questions
            if (context.includes("gender") || context.includes("sex")) {
              return radios.find((r) => r.label.includes("prefer not") || r.label.includes("decline"))?.idx
            }
            if (context.includes("ethnic") || context.includes("race")) {
              return radios.find((r) => r.label.includes("prefer not") || r.label.includes("decline"))?.idx
            }
            if (context.includes("disab")) {
              return radios.find((r) => r.label.includes("prefer not") || r.label.includes("decline"))?.idx
                ?? radios.find((r) => r.label === "no")?.idx
            }
            if (context.includes("authori") || context.includes("right to work") || context.includes("eligible") || context.includes("legally")) {
              return radios.find((r) => r.label === "yes" || r.label.includes("i am") || r.label.includes("authori"))?.idx
            }
            if (context.includes("sponsor") || context.includes("visa")) {
              return radios.find((r) => r.label === "no" || r.label.includes("do not") || r.label.includes("not require"))?.idx
            }
            if (context.includes("relocat")) {
              return radios.find((r) => r.label === "yes" || r.label.includes("willing"))?.idx
            }
            if (context.includes("legal name") || context.includes("full name")) {
              return radios.find((r) => r.label === "yes")?.idx
            }
            return undefined
          }

          chosenIdx = pickRadioByContext()

          // Default: prefer privacy-preserving, then "No", then "Yes", finally the first option
          if (chosenIdx === undefined) {
            chosenIdx =
              radios.find((r) => r.label.includes("prefer not") || r.label.includes("decline"))?.idx ??
              radios.find((r) => r.label === "no")?.idx ??
              radios.find((r) => r.label === "yes")?.idx ??
              radios[0].idx
          }

          await page.locator('input[type="radio"]').nth(chosenIdx).scrollIntoViewIfNeeded().catch(() => {})
          await page.locator('input[type="radio"]').nth(chosenIdx).click().catch(() => {})
          filled++
          console.log(`[Applicant/Fallback] Auto-checked radio in group "${groupName}" using index ${chosenIdx}`)
        }
      }
    } catch {
      // Radio fallback is best-effort
    }

    // ── Checkboxes: check unchecked ones that look optional ──────────────────
    try {
      const checkboxCount = await page.locator('input[type="checkbox"]:not(:checked)').count().catch(() => 0)
      if (checkboxCount > 0) {
        const checkboxInfo = await page.locator('input[type="checkbox"]').evaluateAll(
          (boxes: HTMLInputElement[]) =>
            boxes.map((cb, idx) => ({
              idx,
              checked: cb.checked,
              name: cb.getAttribute("name") || "",
              label: (() => {
                const id = cb.getAttribute("id")
                if (id) {
                  const lbl = document.querySelector(`label[for="${CSS.escape(id)}"]`)
                  if (lbl) return lbl.textContent?.toLowerCase() || ""
                }
                const parent = cb.closest("label")
                if (parent) return parent.textContent?.toLowerCase() || ""
                return cb.getAttribute("value")?.toLowerCase() || ""
              })(),
            }))
        )

        for (const cb of checkboxInfo) {
          if (cb.checked) continue

          // Gather more context: required status and surrounding text
          const isRequired = await page.locator('input[type="checkbox"]').nth(cb.idx).evaluate(
            (el: HTMLInputElement) => el.hasAttribute("required") || el.getAttribute("aria-required") === "true"
          ).catch(() => false)

          const consentKeywords = [
            "agree", "consent", "terms", "privacy", "authorize", "confirm", "acknowledge",
            "accept", "opt-in", "opt in", "subscribe", "receive", "communications",
            "conditions", "policy", "gdpr", "data processing", "terms of service",
            "j'accepte", "accepter", "conditions", "confidentialité", "consentement",
          ]

          const negationKeywords = ["not", "don't", "do not", "no ", "never", "opt-out", "opt out", "unsubscribe", "ne pas", "pas d'", "pas de"]

          const labelMatchesConsent = consentKeywords.some((kw) => cb.label.includes(kw))
          const labelContainsNegation = negationKeywords.some((kw) => cb.label.includes(kw))

          // Also check surrounding container text for terms/consent language
          let containerText = ""
          try {
            containerText = await page.locator('input[type="checkbox"]').nth(cb.idx).evaluate((el: HTMLInputElement) => {
              const parent = el.closest("label, fieldset")
              return (parent?.textContent || "").toLowerCase()
            }).catch(() => "")
          } catch {}
          const containerMatchesConsent = consentKeywords.some((kw) => containerText.includes(kw))
          const containerContainsNegation = negationKeywords.some((kw) => containerText.includes(kw))

          // Auto-check consent/agree/terms/acknowledge/required checkboxes, but avoid opt-out/negation boxes
          if (!labelContainsNegation && !containerContainsNegation && (isRequired || labelMatchesConsent || containerMatchesConsent)) {
            await page.locator('input[type="checkbox"]').nth(cb.idx).check().catch(() => {})
            filled++
            console.log(`[Applicant/Fallback] Auto-checked consent checkbox '${cb.label.slice(0, 40)}'`)
          }
        }
      }
    } catch {
      // Checkbox fallback is best-effort
    }

    if (filled > 0) console.log(`[Applicant/Fallback] Filled ${filled} empty field(s)`)
  } catch {
    // Fallback itself should never crash
  }
}

/**
 * Smartly select a radio option within a group by matching the desired value
 * against each radio's label text or value attribute.
 * Falls back to the first option if no good match is found.
 */
async function smartSelectRadioByName(
  page: any,
  name: string,
  value: string
): Promise<boolean> {
  if (!value?.trim() || !name?.trim()) return false

  try {
    const escapedName = name.replace(/"/g, '\\"')
    const radios = page.locator(`input[type="radio"][name="${escapedName}"]`)
    const count = await radios.count().catch(() => 0)
    if (count === 0) return false

    const radioInfo: Array<{ value: string; label: string }> = await radios.evaluateAll((els: HTMLInputElement[]) =>
      els.map((r) => {
        const id = r.getAttribute("id")
        let label = ""
        if (id) {
          const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`)
          if (labelEl) label = labelEl.textContent || ""
        }
        if (!label) {
          const parent = r.closest("label")
          if (parent) label = parent.textContent || ""
        }
        return {
          value: (r.value || "").toLowerCase().trim(),
          label: (label || "").toLowerCase().trim(),
        }
      })
    )

    const lowerVal = value.toLowerCase().trim()

    const scoreOption = (option: { label: string; value: string }) => {
      const candidates = [option.label, option.value].filter(Boolean)
      let best = 0
      for (const text of candidates) {
        if (text === lowerVal) return 100
        if (text.startsWith(lowerVal)) best = Math.max(best, 80)
        else if (text.includes(lowerVal)) best = Math.max(best, 70)
        else if (lowerVal.includes(text)) best = Math.max(best, 60)
      }
      return best
    }

    let bestIndex = 0
    let bestScore = scoreOption(radioInfo[0])

    for (let i = 1; i < radioInfo.length; i++) {
      const score = scoreOption(radioInfo[i])
      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }

    // Fallback for binary yes/no answers when the label/value doesn't match directly
    if (bestScore === 0) {
      const yesIndex = radioInfo.findIndex(
        (r) => r.label === "yes" || r.label.startsWith("yes, ") || r.value === "yes"
      )
      const noIndex = radioInfo.findIndex(
        (r) => r.label === "no" || r.label.startsWith("no, ") || r.value === "no"
      )
      if ((lowerVal === "yes" || lowerVal === "true") && yesIndex >= 0) {
        bestIndex = yesIndex
      } else if ((lowerVal === "no" || lowerVal === "false") && noIndex >= 0) {
        bestIndex = noIndex
      }
    }

    await radios.nth(bestIndex).scrollIntoViewIfNeeded().catch(() => {})
    await radios.nth(bestIndex).click().catch(() => {})
    console.log(`[Applicant] Smart-selected radio #${bestIndex} for "${name}" → "${value}"`)
    return true
  } catch {
    return false
  }
}

async function fillFieldSafely(
  page: any,
  selectors: string[],
  value: string,
  fieldLabel: string
): Promise<boolean> {
  if (!value?.trim()) return false

  for (const selector of selectors) {
    try {
      const loc = page.locator(selector)
      if ((await loc.count()) > 0) {
        const el = loc.first()
        await el.scrollIntoViewIfNeeded().catch(() => {})
        await el.click().catch(() => {})
        await page.waitForTimeout(150)
        await el.fill(value)
        console.log(`[Applicant] filled via selector: ${selector}`)
        return true
      }
    } catch {
      // Try next selector
    }
  }

  // Playwright semantic fallbacks: try getByLabel and getByPlaceholder
  try {
    const byLabel = page.getByLabel(fieldLabel, { exact: false })
    if ((await byLabel.count()) > 0) {
      await byLabel.first().fill(value)
      console.log(`[Applicant] filled via getByLabel: "${fieldLabel}"`)
      return true
    }
  } catch { /* ignore */ }

  try {
    const byPlaceholder = page.getByPlaceholder(fieldLabel, { exact: false })
    if ((await byPlaceholder.count()) > 0) {
      await byPlaceholder.first().fill(value)
      console.log(`[Applicant] filled via getByPlaceholder: "${fieldLabel}"`)
      return true
    }
  } catch { /* ignore */ }

  console.warn(`[Applicant] Could not fill field: "${fieldLabel}"`)
  return false
}

async function detectCaptcha(page: any): Promise<boolean> {
  try {
    const captchaSelectors = [
      "#h-captcha", ".h-captcha", "[data-hcaptcha-widget-id]",
      ".g-recaptcha", "#recaptcha",
      "iframe[src*='hcaptcha']", "iframe[src*='recaptcha']",
    ]
    for (const sel of captchaSelectors) {
      const count = await page.locator(sel).count().catch(() => 0)
      if (count > 0) { console.warn(`[Applicant] CAPTCHA detected: ${sel}`); return true }
    }
    return false
  } catch { return false }
}

/** Detect non-CAPTCHA human verification (Cloudflare, "verify you're human", etc.) */
async function detectHumanVerification(page: any): Promise<boolean> {
  try {
    const pageText = await page.evaluate(() => document.body?.innerText?.toLowerCase() || "")
    const pageTitle = await page.title().catch(() => "").then((t: string) => t.toLowerCase())

    const verificationPatterns = [
      "verify you are human", "verify you're human",
      "prove you are human", "security check",
      "confirm you are human", "are you a human",
      "complete the security check", "press and hold",
      "cloudflare", "ddos protection",
    ]

    const combined = `${pageText} ${pageTitle}`
    for (const pattern of verificationPatterns) {
      if (combined.includes(pattern)) {
        console.warn(`[Applicant] Human verification detected: "${pattern}"`)
        return true
      }
    }

    // Also check for Cloudflare challenge selectors
    const cfSelectors = [
      "#challenge-form", ".cf-challenge", "[id*='challenge']",
      "iframe[src*='challenges.cloudflare.com']",
    ]
    for (const sel of cfSelectors) {
      const count = await page.locator(sel).count().catch(() => 0)
      if (count > 0) { console.warn(`[Applicant] Cloudflare challenge detected: ${sel}`); return true }
    }

    return false
  } catch { return false }
}

async function tryUploadResume(page: any, tempFilePath: string) {
  try {
    const fileLoc = page.locator('input[type="file"]')
    if ((await fileLoc.count()) > 0) {
      await fileLoc.first().setInputFiles(tempFilePath)
      console.log("[Applicant] Resume file attached.")
    }
  } catch (err) { console.warn("[Applicant] Resume upload warning:", err) }
}

async function getPageAction(page: any): Promise<"submit" | "next" | null> {
  const submitSelectors = [
    "#btn-submit", '[data-qa="btn-submit"]',
    'button[type="submit"]', 'input[type="submit"]',
    'button:has-text("Submit application")', 'button:has-text("Submit Application")',
    'button:has-text("Submit")', 'button:has-text("Apply")',
    'button:has-text("Send Application")', 'button:has-text("Complete application")',
  ]
  const nextSelectors = [
    'button:has-text("Next")', 'button:has-text("Continue")',
    'button:has-text("Next Step")', 'button:has-text("Suivant")',
    'button:has-text("Continuer")', 'a:has-text("Next")',
  ]
  for (const sel of submitSelectors) {
    try { if ((await page.locator(sel).count()) > 0) return "submit" } catch {}
  }
  for (const sel of nextSelectors) {
    try { if ((await page.locator(sel).count()) > 0) return "next" } catch {}
  }
  return null
}

async function clickNextButton(page: any): Promise<boolean> {
  const nextSelectors = [
    'button:has-text("Next")', 'button:has-text("Continue")',
    'button:has-text("Next Step")', 'button:has-text("Suivant")',
    'button:has-text("Continuer")', 'a:has-text("Next")',
  ]
  for (const sel of nextSelectors) {
    try {
      const loc = page.locator(sel)
      if ((await loc.count()) > 0) {
        await loc.first().scrollIntoViewIfNeeded().catch(() => {})
        await loc.first().click()
        console.log(`[Applicant] Clicked Next: ${sel}`)
        return true
      }
    } catch {}
  }

  try {
    const btn = page.getByRole("button", { name: /next|continue|suivant|continuer/i })
    if ((await btn.count()) > 0) {
      await btn.first().click()
      console.log("[Applicant] Clicked Next via getByRole")
      return true
    }
  } catch {}

  return false
}

async function clickSubmitButton(page: any): Promise<boolean> {
  const submitSelectors = [
    "#btn-submit", '[data-qa="btn-submit"]',
    'button[type="submit"]', 'input[type="submit"]',
    'button:has-text("Submit application")', 'button:has-text("Submit Application")',
    'button:has-text("Submit")', 'button:has-text("Apply")',
    'button:has-text("Send Application")',
  ]
  for (const sel of submitSelectors) {
    try {
      const loc = page.locator(sel)
      if ((await loc.count()) > 0) {
        await loc.first().scrollIntoViewIfNeeded().catch(() => {})
        await loc.first().click()
        console.log(`[Applicant] Clicked Submit: ${sel}`)
        return true
      }
    } catch {}
  }

  try {
    const btn = page.getByRole("button", { name: /submit|apply|send application/i })
    if ((await btn.count()) > 0) {
      await btn.first().click()
      console.log("[Applicant] Clicked Submit via getByRole")
      return true
    }
  } catch {}

  return false
}

// ─── Lever ─────────────────────────────────────────────────────────────────────
async function fillLeverForm(
  page: any, profile: ResumeProfile, tempFilePath: string | null
): Promise<{ blocked: boolean; reason?: string }> {
  const fullName = profile.fullName || ""
  const email = profile.email || ""
  const phone = profile.phone || ""
  const location = profile.location || ""
  const links = profile.links || []
  const linkedinObj = links.find(
    (l) => l.label?.toLowerCase().includes("linkedin") || l.url?.includes("linkedin.com")
  )
  const linkedinUrl = linkedinObj?.url || ""
  const lastJob = profile.workExperience?.[0]?.company || ""

  try {
    await page.waitForSelector('[data-qa="name-input"], input[name="name"]', { timeout: 12000 })
  } catch { console.warn("[Applicant/Lever] Form inputs timeout") }

  if (tempFilePath) {
    try {
      const fileInput = page.locator(
        '#resume-upload-input, [data-qa="input-resume"], input[name="resume"][type="file"]'
      )
      if ((await fileInput.count()) > 0) {
        await fileInput.first().setInputFiles(tempFilePath)
        console.log("[Applicant/Lever] Resume attached via file input")
        await page.waitForTimeout(800)
      }
    } catch (err) { console.warn("[Applicant/Lever] Resume upload warning:", err) }
  }

  await fillFieldSafely(page,
    ['[data-qa="name-input"]', 'input[name="name"]'],
    fullName, "Full Name")

  await fillFieldSafely(page,
    ['[data-qa="email-input"]', 'input[name="email"]', 'input[type="email"]'],
    email, "Email")

  await fillFieldSafely(page,
    ['[data-qa="phone-input"]', 'input[name="phone"]', 'input[type="tel"]'],
    phone, "Phone")

  if (lastJob) {
    await fillFieldSafely(page,
      ['[data-qa="org-input"]', 'input[name="org"]'],
      lastJob, "Current Company")
  }

  if (location) {
    await fillFieldSafely(page,
      ['[data-qa="location-input"]', '#location-input', 'input[name="location"]'],
      location, "Location")
    await page.waitForTimeout(600)
    try {
      const suggestion = page.locator(
        ".application-location-suggestion, [class*='suggestion'] li, .pac-item"
      )
      if ((await suggestion.count()) > 0) await suggestion.first().click()
      else await page.keyboard.press("Escape")
    } catch {}
  }

  if (linkedinUrl) {
    await fillFieldSafely(page,
      ['input[name="urls[LinkedIn]"]', 'input[name*="LinkedIn"]',
       'input[placeholder*="linkedin" i]', 'input[id*="linkedin" i]'],
      linkedinUrl, "LinkedIn URL")
  }

  await fillRemainingDropdownsFallback(page)

  try {
    const emptyTextareas = await page.evaluate(() => {
      const areas = document.querySelectorAll(
        'textarea:not([name*="cover" i]):not([name*="note" i]):not([id*="cover" i])'
      )
      const results: Array<{ index: number; placeholder: string }> = []
      areas.forEach((area, i) => {
        const el = area as HTMLTextAreaElement
        if (!el.value.trim() && !el.closest('[class*="location"]')) {
          results.push({ index: i, placeholder: el.getAttribute("placeholder") || "" })
        }
      })
      return results
    })
    for (const { index } of emptyTextareas) {
      try {
        const ta = page.locator("textarea").nth(index)
        await ta.fill("Please see my attached resume and profile for details.")
        console.log(`[Applicant/Lever] Injected default text into textarea #${index}`)
      } catch {}
    }
  } catch {}

  const hasCaptcha = await detectCaptcha(page)
  if (hasCaptcha) {
    console.log("[Applicant/Lever] CAPTCHA element present — trying API auto-solve...")
    const solveResult = await solveCaptchaAuto({ page })
    if (solveResult.solved) {
      console.log("[Applicant/Lever] ✓ CAPTCHA solved via API token injection!")
    } else {
      console.log(`[Applicant/Lever] API auto-solve skipped/failed (${solveResult.error}) — attempting submit...`)
    }
  }

  await clickSubmitButton(page)
  return { blocked: false }
}

// ─── Greenhouse ────────────────────────────────────────────────────────────────
async function fillGreenhouseForm(
  page: any, profile: ResumeProfile, tempFilePath: string | null
) {
  const fullName = profile.fullName || ""
  const nameParts = fullName.trim().split(" ")
  const firstName = nameParts[0] || ""
  const lastName = nameParts.slice(1).join(" ") || firstName
  const email = profile.email || ""
  const phone = profile.phone || ""
  const location = profile.location || ""
  const links = profile.links || []
  const linkedinObj = links.find(
    (l) => l.label?.toLowerCase().includes("linkedin") || l.url?.includes("linkedin.com")
  )
  const linkedinUrl = linkedinObj?.url || ""

  try {
    await page.waitForSelector(
      '#first_name, #last_name, input[name="first_name"], input[id*="first"]',
      { timeout: 12000 }
    )
  } catch { console.warn("[Applicant/Greenhouse] Form inputs timeout") }

  if (tempFilePath) await tryUploadResume(page, tempFilePath)

  await fillFieldSafely(page,
    ['#first_name', 'input[name="first_name"]', 'input[autocomplete="given-name"]'],
    firstName, "First Name")

  await fillFieldSafely(page,
    ['#last_name', 'input[name="last_name"]', 'input[autocomplete="family-name"]'],
    lastName, "Last Name")

  await fillFieldSafely(page,
    ['#email', 'input[name="email"]', 'input[type="email"]'],
    email, "Email")

  await fillFieldSafely(page,
    ['#phone', 'input[name="phone"]', 'input[type="tel"]'],
    phone, "Phone")

  if (location) {
    await fillFieldSafely(page,
      ['#job_application_location', 'input[name="job_application[location]"]',
       'input[id*="location" i]', 'input[placeholder*="location" i]'],
      location, "Location")
  }

  if (linkedinUrl) {
    await fillFieldSafely(page,
      ['input[name*="linkedin" i]', 'input[id*="linkedin" i]',
       'input[placeholder*="linkedin" i]'],
      linkedinUrl, "LinkedIn URL")
  }

  // Fill all remaining dropdowns with smart defaults (now handles placeholders)
  await fillRemainingDropdownsFallback(page)

  await clickSubmitButton(page)
}

// ─── Wellfound ────────────────────────────────────────────────────────────────
async function fillWellfoundForm(
  page: any, profile: ResumeProfile
): Promise<{ blocked: boolean; reason?: string }> {
  const note = profile.summary ||
    `I am excited to apply for this position. My background includes ${(profile.skills || []).slice(0, 5).join(", ")}. I look forward to contributing to your team.`

  try {
    await page.waitForSelector(
      'button:has-text("Apply"), a:has-text("Apply"), [data-test="apply-button"]',
      { timeout: 10000 }
    )
  } catch { console.warn("[Applicant/Wellfound] Apply button timeout") }

  let modalOpened = false
  const applyBtnSelectors = [
    '[data-test="apply-button"]',
    'button:has-text("Apply")',
    'a:has-text("Apply")',
    'button:has-text("Apply now")',
  ]
  for (const sel of applyBtnSelectors) {
    try {
      const loc = page.locator(sel)
      if ((await loc.count()) > 0) {
        await loc.first().scrollIntoViewIfNeeded().catch(() => {})
        await loc.first().click()
        modalOpened = true
        console.log(`[Applicant/Wellfound] Clicked Apply: ${sel}`)
        await page.waitForTimeout(2000)
        break
      }
    } catch {}
  }
  if (!modalOpened) {
    try {
      const btn = page.getByRole("button", { name: /apply/i })
      if ((await btn.count()) > 0) {
        await btn.first().click()
        modalOpened = true
        console.log("[Applicant/Wellfound] Clicked Apply via getByRole")
        await page.waitForTimeout(2000)
      }
    } catch {}
  }

  const pageText = await page.evaluate(() => document.body?.innerText?.toLowerCase() || "")
  if (pageText.includes("sign in") || pageText.includes("log in") || pageText.includes("create account")) {
    return {
      blocked: true,
      reason: "Wellfound requires you to be logged in to apply. Please connect your Wellfound account."
    }
  }

  await page.waitForTimeout(1000)
  const noteSelectors = [
    'textarea[name="note"]',
    'textarea[placeholder*="note" i]',
    'textarea[placeholder*="cover" i]',
    'textarea[placeholder*="message" i]',
    'textarea[placeholder*="introduce" i]',
    '.application-modal textarea',
    '[class*="modal"] textarea',
    '[role="dialog"] textarea',
  ]
  await fillFieldSafely(page, noteSelectors, note, "Cover Letter / Note")

  const submitSelectors = [
    'button:has-text("Send Application")',
    'button:has-text("Submit Application")',
    'button:has-text("Submit")',
    '[data-test="submit-application"]',
    'button[type="submit"]',
  ]
  let submitted = false
  for (const sel of submitSelectors) {
    try {
      const loc = page.locator(sel)
      if ((await loc.count()) > 0) {
        await loc.first().scrollIntoViewIfNeeded().catch(() => {})
        await loc.first().click()
        submitted = true
        console.log(`[Applicant/Wellfound] Submitted via: ${sel}`)
        break
      }
    } catch {}
  }
  if (!submitted) {
    try {
      const btn = page.getByRole("button", { name: /submit|send application/i })
      if ((await btn.count()) > 0) {
        await btn.first().click()
        console.log("[Applicant/Wellfound] Submitted via getByRole")
      }
    } catch {}
  }

  return { blocked: false }
}

// ─── Generic / Adaptive (Workable, Ashby, Smartrecruiters, etc.) ──────────────
async function fillFormAdaptively(
  page: any, profile: ResumeProfile, tempFilePath: string | null
): Promise<{ blocked: boolean; reason?: string }> {
  const fullName = profile.fullName || ""
  const nameParts = fullName.trim().split(" ")
  const firstName = nameParts[0] || ""
  const lastName = nameParts.slice(1).join(" ") || firstName
  const email = profile.email || ""
  const phone = profile.phone || ""
  const location = profile.location || ""
  const summary = profile.summary || ""
  const links = profile.links || []
  const linkedinObj = links.find(
    (l) => l.label?.toLowerCase().includes("linkedin") || l.url?.includes("linkedin.com")
  )
  const linkedinUrl = linkedinObj?.url || ""
  const portfolioObj = links.find(
    (l) => l.label?.toLowerCase().includes("portfolio") || l.label?.toLowerCase().includes("website")
  )
  const portfolioUrl = portfolioObj?.url || ""

  const nameSelectors = [
    'input[name="name"]', 'input[name="fullName"]', 'input[name="full_name"]',
    '#name', 'input[autocomplete="name"]', 'input[placeholder*="full name" i]',
    'input[aria-label*="name" i]',
  ]
  const firstNameSelectors = [
    'input[name="first_name"]', 'input[name="firstName"]', '#first_name',
    'input[autocomplete="given-name"]', 'input[placeholder*="first name" i]',
  ]
  const lastNameSelectors = [
    'input[name="last_name"]', 'input[name="lastName"]', '#last_name',
    'input[autocomplete="family-name"]', 'input[placeholder*="last name" i]',
  ]
  const emailSelectors = [
    'input[type="email"]', 'input[name="email"]', '#email',
    'input[autocomplete="email"]', 'input[placeholder*="email" i]',
  ]
  const phoneSelectors = [
    'input[type="tel"]', 'input[name="phone"]', '#phone',
    'input[autocomplete="tel"]', 'input[placeholder*="phone" i]',
    'input[id*="phone" i]', 'input[name*="phone" i]',
  ]
  const locationSelectors = [
    'input[name="location"]', 'input[name="city"]', '#location',
    'input[placeholder*="city" i]', 'input[placeholder*="location" i]',
    'input[aria-label*="location" i]', 'input[id*="location" i]',
  ]

  for (let step = 0; step < 8; step++) {
    console.log(`\n[Applicant/Adaptive] ── Step ${step + 1} ──────────────`)
    await page.waitForTimeout(1500)

    if (await detectCaptcha(page)) {
      console.log("[Applicant/Adaptive] CAPTCHA detected — attempting auto-solve...")
      const solveResult = await solveCaptchaAuto({ page })
      if (solveResult.solved) {
        console.log("[Applicant/Adaptive] ✓ CAPTCHA solved via API!")
      } else {
        console.log(`[Applicant/Adaptive] API auto-solve skipped/failed (${solveResult.error}) — attempting submit...`)
      }
    }

    if (tempFilePath) await tryUploadResume(page, tempFilePath)

    const inputCount = await page
      .locator('input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), select, textarea')
      .count().catch(() => 0)
    console.log(`[Applicant/Adaptive] Visible inputs: ${inputCount}`)

    if (inputCount > 0) {
      const hasFirstName = (await page.locator(firstNameSelectors.join(", ")).count().catch(() => 0)) > 0
      if (hasFirstName) {
        await fillFieldSafely(page, firstNameSelectors, firstName, "First Name")
        await fillFieldSafely(page, lastNameSelectors, lastName, "Last Name")
      } else {
        await fillFieldSafely(page, nameSelectors, fullName, "Full Name")
      }

      await fillFieldSafely(page, emailSelectors, email, "Email")
      await fillFieldSafely(page, phoneSelectors, phone, "Phone")

      if (location) {
        await fillFieldSafely(page, locationSelectors, location, "Location")
        await page.waitForTimeout(400)
        try {
          const dropdown = page.locator(
            '[class*="suggestion"] li, [class*="autocomplete"] li, .pac-item'
          )
          if ((await dropdown.count()) > 0) await dropdown.first().click()
          else await page.keyboard.press("Escape")
        } catch {}
      }

      if (linkedinUrl) {
        await fillFieldSafely(page,
          ['input[name="urls[LinkedIn]"]', 'input[name*="LinkedIn"]',
           'input[name*="linkedin" i]', 'input[id*="linkedin" i]',
           'input[placeholder*="linkedin" i]'],
          linkedinUrl, "LinkedIn URL")
      }

      if (portfolioUrl) {
        await fillFieldSafely(page,
          ['input[name*="portfolio" i]', 'input[id*="portfolio" i]',
           'input[placeholder*="portfolio" i]', 'input[placeholder*="website" i]'],
          portfolioUrl, "Portfolio / Website")
      }

      if (summary) {
        const coverCount = await page
          .locator('textarea[name*="cover" i], textarea[id*="cover" i], textarea[placeholder*="cover" i]')
          .count().catch(() => 0)
        if (coverCount > 0) {
          await fillFieldSafely(page,
            ['textarea[name*="cover" i]', 'textarea[id*="cover" i]'],
            summary, "Cover Letter")
        }
      }

      await fillRemainingDropdownsFallback(page)
    }

    const action = await getPageAction(page)
    console.log(`[Applicant/Adaptive] Page action: ${action}`)

    if (action === "submit") {
      await clickSubmitButton(page)
      break
    } else if (action === "next") {
      const advanced = await clickNextButton(page)
      if (!advanced) { console.warn("[Applicant/Adaptive] Could not advance — stopping"); break }
      await page.waitForTimeout(2500)
    } else {
      console.warn("[Applicant/Adaptive] No action button found — stopping loop")
      break
    }
  }

  return { blocked: false }
}

// ─── Navigate to apply form ────────────────────────────────────────────────────

async function navigateToApplyForm(page: any, jobUrl: string) {
  if (jobUrl.includes("jobs.lever.co") && !jobUrl.endsWith("/apply")) {
    const applyUrl = jobUrl.replace(/\/$/, "") + "/apply"
    console.log(`[Applicant] Lever: navigating to ${applyUrl}`)
    await page.goto(applyUrl, { waitUntil: "domcontentloaded", timeout: 30000 })
    await page.waitForTimeout(2500)
    await dismissOverlays(page)
    return
  }

  await page.goto(jobUrl, { waitUntil: "domcontentloaded", timeout: 40000 })
  await page.waitForTimeout(2000)
  await dismissOverlays(page)

  const initialInputCount = await page
    .locator('input[type="text"], input[type="email"], input[name="name"], input[name="email"], #first_name')
    .count().catch(() => 0)

  if (initialInputCount > 0) {
    console.log(`[Applicant] Form already visible (${initialInputCount} inputs)`)
    return
  }

  console.log("[Applicant] No form visible — looking for Apply Now button...")
  const applySelectors = [
    'button:has-text("Apply now")', 'a:has-text("Apply now")',
    'button:has-text("Apply for this job")', 'a:has-text("Apply for this job")',
    'button:has-text("Apply")', 'a:has-text("Apply")',
    '[data-ui*="apply"]', 'a[href*="#apply"]',
  ]
  let clicked = false
  for (const sel of applySelectors) {
    try {
      const loc = page.locator(sel)
      if ((await loc.count()) > 0) {
        await loc.first().click()
        clicked = true
        console.log(`[Applicant] Clicked apply button: ${sel}`)
        await page.waitForTimeout(3000)
        break
      }
    } catch {}
  }
  if (!clicked) {
    try {
      const btn = page.getByRole("button", { name: /apply|apply now|apply for this job/i })
      if ((await btn.count()) > 0) {
        await btn.first().click()
        console.log("[Applicant] Clicked apply via getByRole")
      }
    } catch {}
    await page.waitForTimeout(3000)
  }
}

// ─── Submission verification ───────────────────────────────────────────────────

async function extractUnknownRequiredFields(page: any): Promise<UnknownFormField[]> {
  try {
    const fields = await page.evaluate(() => {
      const results: Array<{ label: string; name: string; type: string }> = []
      const seen = new Set<string>()

      // Find invalid inputs OR required inputs still empty OR selects with placeholder value
      const candidates = document.querySelectorAll(
        'input:invalid, select:invalid, textarea:invalid, ' +
        'input[required]:placeholder-shown, textarea[required]:empty, ' +
        '[aria-invalid="true"], ' +
        'select[required], ' +
        'input[aria-required="true"]:placeholder-shown, textarea[aria-required="true"]:empty'
      )

      candidates.forEach((el) => {
        const input = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        const tag = input.tagName
        const type = (input as HTMLInputElement).type || ""
        if (type === "hidden" || type === "file" || type === "submit" || type === "button") return

        // For selects with required but not :invalid, check if value is a placeholder
        if (tag === "SELECT") {
          const sel = el as HTMLSelectElement
          const val = sel.value || ""
          const placeholderPatterns = [/^select[.…]*$/i, /^choose[.…]*$/i, /^pick[.…]*$/i, /^--/, /^please select/i, /^select one/i, /^- select -/i]
          const isPlaceholder = !val || placeholderPatterns.some((p) => p.test(val.trim()))
          if (!isPlaceholder && val.trim()) return
        }

        let label = ""
        const id = input.getAttribute("id")
        if (id) {
          const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`)
          if (labelEl) {
            label = (labelEl.textContent || "").replace(/\s+/g, " ").replace(/[*:❋✱✽✤✦✧☞→⇒⇨➜➤➥➦➧➨➩➪➫➬➭➮➯➱➲➳➵➸➻➼➽➾*]+$/, "").trim()
          }
        }
        if (!label) {
          const parentLabel = input.closest("label")
          if (parentLabel) {
            label = (parentLabel.textContent || "").replace(/\s+/g, " ").replace(/[*:❋✱✽✤✦✧☞→⇒⇨➜➤➥➦➧➨➩➪➫➬➭➮➯➱➲➳➵➸➻➼➽➾*]+$/, "").trim()
          }
        }
        if (!label) {
          label = input.getAttribute("aria-label") || input.getAttribute("placeholder") || input.getAttribute("name") || ""
        }

        const name = input.getAttribute("name") || input.getAttribute("id") || ""
        const key = `${label}|${name}`
        if (seen.has(key) || !label.trim()) return
        seen.add(key)

        const lowerLabel = label.toLowerCase()
        if (
          lowerLabel.includes("first name") || lowerLabel.includes("last name") ||
          lowerLabel.includes("full name") || lowerLabel === "name" ||
          lowerLabel.includes("email") || lowerLabel.includes("phone") ||
          lowerLabel.includes("location") || lowerLabel.includes("city") ||
          lowerLabel.includes("linkedin") || lowerLabel.includes("resume") ||
          lowerLabel.includes("cv") || lowerLabel.includes("cover letter")
        ) return

        let fieldType = type || "text"
        if (tag === "SELECT") fieldType = "select"
        if (tag === "TEXTAREA") fieldType = "textarea"
        if (type === "checkbox") fieldType = "checkbox"
        if (type === "radio") fieldType = "radio"
        if (type === "tel") fieldType = "phone"

        results.push({ label, name, type: fieldType })
      })

      return results
    })

    return fields
  } catch (err) {
    console.warn("[Applicant] Error extracting unknown fields:", err)
    return []
  }
}

async function fillUnknownFields(page: any, answers: Record<string, string>): Promise<void> {
  if (!answers || Object.keys(answers).length === 0) return

  console.log(`[Applicant] Filling ${Object.keys(answers).length} unknown field(s)...`)

  for (const [label, value] of Object.entries(answers)) {
    if (!value?.trim()) continue

    let filled = false
    const lowerVal = value.toLowerCase().trim()
    const shouldCheck = lowerVal === "yes" || lowerVal === "true" || lowerVal === "check" || lowerVal === "agree"

    // ── 1. Try by label (handles select/checkbox/radio/text) ────────────────
    try {
      const byLabel = page.getByLabel(label, { exact: false })
      if ((await byLabel.count()) > 0) {
        const el = byLabel.first()
        const tagName = await el.evaluate((e: any) => e.tagName).catch(() => "")
        const inputType = await el.evaluate((e: any) => e.type).catch(() => "")

        if (tagName === "SELECT") {
          await el.selectOption({ label: value }).catch(async () => {
            await el.selectOption(value).catch(() => {})
          })
        } else if (inputType === "checkbox") {
          if (shouldCheck) await el.check().catch(() => {})          } else if (inputType === "radio") {
            const radioName = await el.evaluate((e: any) => e.name).catch(() => "")
            if (radioName) {
              await smartSelectRadioByName(page, radioName, value)
            } else {
              if (shouldCheck) await el.click().catch(() => {})
            }
          } else {
            await el.click().catch(() => {})
            await el.fill(value)
          }
          filled = true
          console.log(`[Applicant] Filled unknown field "${label}" via getByLabel`)
      }
    } catch {}

    // ── 2. Try by placeholder (text/textarea only) ──────────────────────────
    if (!filled) {
      try {
        const byPlaceholder = page.getByPlaceholder(label, { exact: false })
        if ((await byPlaceholder.count()) > 0) {
          const el = byPlaceholder.first()
          const tagName = await el.evaluate((e: any) => e.tagName).catch(() => "")
          if (tagName === "SELECT") {
            await el.selectOption({ label: value }).catch(async () => {
              await el.selectOption(value).catch(() => {})
            })
          } else if (tagName === "INPUT") {
            const inputType = await el.evaluate((e: any) => e.type).catch(() => "")
            if (inputType === "checkbox" && shouldCheck) {
              await el.check().catch(() => {})
            } else if (inputType === "radio") {
              const radioName = await el.evaluate((e: any) => e.name).catch(() => "")
              if (radioName) {
                await smartSelectRadioByName(page, radioName, value)
              } else if (shouldCheck) {
                await el.click().catch(() => {})
              }
            } else {
              await el.click().catch(() => {})
              await el.fill(value)
            }
          } else {
            await el.click().catch(() => {})
            await el.fill(value)
          }
          filled = true
          console.log(`[Applicant] Filled unknown field "${label}" via getByPlaceholder`)
        }
      } catch {}
    }

    // ── 3. Try by name attribute (covers select/checkbox/radio/text) ─────────
    if (!filled) {
      try {
        const byName = page.locator(`input[name="${label}"], textarea[name="${label}"], select[name="${label}"]`)
        if ((await byName.count()) > 0) {
          const el = byName.first()
          const tagName = await el.evaluate((e: any) => e.tagName).catch(() => "")
          const inputType = await el.evaluate((e: any) => e.type).catch(() => "")

          if (tagName === "SELECT") {
            await el.selectOption({ label: value }).catch(async () => {
              await el.selectOption(value).catch(() => {})
            })
          } else if (inputType === "checkbox") {
            if (shouldCheck) await el.check().catch(() => {})
          } else if (inputType === "radio") {
            await smartSelectRadioByName(page, label, value)
          } else {
            await el.click().catch(() => {})
            await el.fill(value)
          }
          filled = true
          console.log(`[Applicant] Filled unknown field "${label}" via name attribute`)
        }
      } catch {}
    }

    if (!filled) {
      console.warn(`[Applicant] Could not locate unknown field: "${label}"`)
    }
  }
}

export interface VerificationResult {
  status: SubmissionStatus
  error?: string
  unknownFields?: UnknownFormField[]
  needsHumanVerification?: boolean
  screenshot?: string
  finalUrl?: string
  finalTitle?: string
}

async function captureFinalScreenshot(page: any): Promise<string | undefined> {
  try {
    const screenshot = await page.screenshot({ type: "png", fullPage: false })
    if (!screenshot) return undefined
    const base64 = Buffer.isBuffer(screenshot)
      ? screenshot.toString("base64")
      : Buffer.from(screenshot as ArrayBuffer).toString("base64")
    return `data:image/png;base64,${base64}`
  } catch (err) {
    console.warn("[Applicant] Screenshot capture failed:", err)
    return undefined
  }
}

async function verifySubmissionSuccess(page: any): Promise<VerificationResult> {
  let screenshot: string | undefined
  let finalUrl = ""
  let finalTitle = ""

  try {
    // Give the page more time to settle and redirect after submission.
    await page.waitForTimeout(6000)

    finalUrl = page.url()
    finalTitle = (await page.title().catch(() => "")).toString()

    const pageText = await page.evaluate(() => document.body?.innerText?.toLowerCase() || "")
    const currentUrl = finalUrl.toLowerCase()

    const hasSuccessUrl =
      currentUrl.includes("confirmation") ||
      currentUrl.includes("thank") ||
      currentUrl.includes("success") ||
      currentUrl.includes("submitted") ||
      currentUrl.includes("complete")

    const hasSuccessText =
      pageText.includes("thank you for applying") ||
      pageText.includes("application received") ||
      pageText.includes("application has been submitted") ||
      pageText.includes("application submitted") ||
      pageText.includes("thank you for your interest") ||
      pageText.includes("we have received your application") ||
      pageText.includes("your application was sent") ||
      pageText.includes("successfully submitted") ||
      pageText.includes("we'll be in touch") ||
      pageText.includes("we will be in touch") ||
      pageText.includes("your application has been received")

    if (hasSuccessUrl || hasSuccessText) {
      console.log("[Applicant] Confirmed submission success!")
      return { status: "success" }
    }

    // ── Check for explicit failure signals FIRST ──────────────────────────────
    const failurePatterns = [
      "is required",
      "invalid phone",
      "please enter a valid",
      "error submitting",
      "please fix the errors",
      "this field is required",
      "submission failed",
      "unable to submit",
      "an error occurred",
      "there was an error",
      "please try again",
      "something went wrong",
      "failed to submit",
    ]
    const hasErrorText = failurePatterns.some((p) => pageText.includes(p))

    const invalidCount = await page
      .locator("input:invalid, select:invalid, textarea:invalid, [aria-invalid='true']")
      .count().catch(() => 0)

    if (hasErrorText || invalidCount > 0) {
      const unknownFields = await extractUnknownRequiredFields(page)

      let errorMsg = "Form submission blocked due to missing or invalid fields."
      try {
        const visibleErrors = await page
          .locator(".error, .field-error, [class*='error'], [aria-invalid='true']")
          .allInnerTexts()
        const cleaned = visibleErrors
          .map((e: string) => e.trim())
          .filter((e: string) => e.length > 0 && e.length < 150)
        if (cleaned.length > 0) errorMsg = `Form validation error: ${cleaned.slice(0, 2).join("; ")}`
      } catch {}

      if (unknownFields.length > 0) {
        console.log(`[Applicant] Detected ${unknownFields.length} unknown required field(s): ${unknownFields.map(f => f.label).join(", ")}`)
        errorMsg = `Unknown required fields detected: ${unknownFields.map(f => f.label).join(", ")}. Review and fill them to continue.`
      }

      screenshot = await captureFinalScreenshot(page)
      return { status: "failed", error: errorMsg, unknownFields, screenshot, finalUrl, finalTitle }
    }

    // ── Check CAPTCHA / human verification AFTER field validation ─────────────
    const hasCaptcha = await detectCaptcha(page)
    const hasHumanVerification = !hasCaptcha && (await detectHumanVerification(page))

    if (hasCaptcha || hasHumanVerification) {
      const unknownFields = await extractUnknownRequiredFields(page)
      const verificationType = hasCaptcha ? "CAPTCHA (hCaptcha/reCAPTCHA)" : "Human verification (Cloudflare/Security check)"
      screenshot = await captureFinalScreenshot(page)
      return {
        status: "failed",
        needsHumanVerification: true,
        error: `${verificationType} is blocking submission. Open the debug URL to complete it manually, then click Continue.`,
        unknownFields: unknownFields.length > 0 ? unknownFields : undefined,
        screenshot,
        finalUrl,
        finalTitle,
      }
    }

    // ── If inputs are still on the page, the form likely didn't submit ─────────
    const remainingInputs = await page
      .locator('input[type="text"], input[type="email"], input[type="tel"], textarea')
      .count().catch(() => 0)

    if (remainingInputs > 0) {
      const unknownFields = await extractUnknownRequiredFields(page)
      screenshot = await captureFinalScreenshot(page)
      return {
        status: "uncertain",
        error: "Form inputs remain on page after submit attempt. Could not confirm submission.",
        unknownFields: unknownFields.length > 0 ? unknownFields : undefined,
        screenshot,
        finalUrl,
        finalTitle,
      }
    }

    // ── No clear success signal and no clear failure signal ──────────────────
    // This is the critical "don't lie" case: we simply don't know.
    screenshot = await captureFinalScreenshot(page)
    return {
      status: "uncertain",
      error: "Submission status is uncertain. The bot clicked Submit but could not confirm success or failure.",
      screenshot,
      finalUrl,
      finalTitle,
    }
  } catch (err: any) {
    screenshot = await captureFinalScreenshot(page).catch(() => undefined)
    return {
      status: "uncertain",
      error: `Failed to verify submission status: ${err?.message || "Unknown error"}`,
      screenshot,
      finalUrl,
      finalTitle,
    }
  }
}

// ─── AI-Powered Smart Field Filler ─────────────────────────────────────────────

/**
 * Extract ALL unfilled/placeholder fields from the DOM with full context for AI analysis.
 * Includes available options for selects, surrounding labels, and required status.
 */
async function extractAllUnfilledFields(page: any): Promise<Array<{
  label: string
  name: string
  type: string
  required: boolean
  options?: string[]
}>> {
  try {
    return await page.evaluate(() => {
      const results: Array<{
        label: string
        name: string
        type: string
        required: boolean
        options?: string[]
      }> = []
      const seen = new Set<string>()

      const isPlaceholder = (val: string) => {
        const v = val.trim().toLowerCase()
        if (!v) return true
        return /^select[.…]*$|^choose[.…]*$|^pick[.…]*$|^--|^please select|^select one|^- select -|^none$|^n\/a$/i.test(v)
      }

      const candidates = document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
      )

      candidates.forEach((el) => {
        const input = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        const tag = input.tagName
        const type = (input as HTMLInputElement).type || ""
        if (type === "hidden" || type === "file" || type === "submit" || type === "button") return

        // Check if already filled
        if (tag === "SELECT") {
          const val = (input as HTMLSelectElement).value
          if (val && !isPlaceholder(val)) return
        } else if (tag === "TEXTAREA") {
          if ((input as HTMLTextAreaElement).value.trim()) return
        } else if (type === "checkbox" || type === "radio") {
          if ((input as HTMLInputElement).checked) return
        } else {
          if ((input as HTMLInputElement).value.trim()) return
        }

        // Get label
        let label = ""
        const id = input.getAttribute("id")
        if (id) {
          const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`)
          if (labelEl) {
            label = (labelEl.textContent || "").replace(/\s+/g, " ").replace(/[*:❋✱✽✤✦✧☞→⇒⇨➜➤➥➦➧➨➩➪➫➬➭➮➯➱➲➳➵➸➻➼➽➾*]+$/, "").trim()
          }
        }
        if (!label) {
          const parentLabel = input.closest("label")
          if (parentLabel) {
            label = (parentLabel.textContent || "").replace(/\s+/g, " ").replace(/[*:❋✱✽✤✦✧☞→⇒⇨➜➤➥➦➧➨➩➪➫➬➭➮➯➱➲➳➵➸➻➼➽➾*]+$/, "").trim()
          }
        }
        if (!label) {
          label = input.getAttribute("aria-label") || input.getAttribute("placeholder") || input.getAttribute("name") || ""
        }

        const name = input.getAttribute("name") || input.getAttribute("id") || ""
        const key = `${label}|${name}|${tag}`
        if (seen.has(key) || !label.trim()) return
        seen.add(key)

        const required = input.hasAttribute("required") || input.getAttribute("aria-required") === "true"

        let fieldType = type || "text"
        if (tag === "SELECT") fieldType = "select"
        if (tag === "TEXTAREA") fieldType = "textarea"
        if (type === "checkbox") fieldType = "checkbox"
        if (type === "radio") fieldType = "radio"
        if (type === "tel") fieldType = "phone"
        if (type === "email") fieldType = "email"

        const field: { label: string; name: string; type: string; required: boolean; options?: string[] } = {
          label, name, type: fieldType, required
        }

        // For selects, extract all available options
        if (tag === "SELECT") {
          const sel = input as HTMLSelectElement
          const opts: string[] = []
          for (let i = 0; i < sel.options.length; i++) {
            const opt = sel.options[i]
            const optText = (opt.textContent || opt.label || "").trim()
            if (optText && opt.value && !isPlaceholder(opt.value)) {
              opts.push(optText)
            }
          }
          if (opts.length > 0) field.options = opts
        }

        results.push(field)
      })

      return results
    })
  } catch (err) {
    console.warn("[Applicant/AI] Error extracting unfilled fields:", err)
    return []
  }
}

/**
 * Use Gemini AI to analyze all remaining unfilled fields and choose the best answers.
 * This is the core intelligence that makes the bot adapt to ANY form.
 *
 * Returns a map of field label → value.
 * For selects, the value will be one of the available options.
 */
async function analyzeAndFillUnknownFields(
  page: any,
  profile: ResumeProfile,
  jobContext?: { title: string; company: string; description?: string }
): Promise<number> {
  const unfilledFields = await extractAllUnfilledFields(page)
  if (unfilledFields.length === 0) {
    console.log("[Applicant/AI] No unfilled fields detected — all fields already filled.")
    return 0
  }

  console.log(`[Applicant/AI] Detected ${unfilledFields.length} unfilled field(s). Asking Gemini AI to analyze...`)
  for (const f of unfilledFields) {
    const opts = f.options ? ` [Options: ${f.options.join(" | ")}]` : ""
    console.log(`  - "${f.label}" (${f.type}, required: ${f.required})${opts}`)
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn("[Applicant/AI] GEMINI_API_KEY not set — skipping AI field analysis.")
    return 0
  }

  try {
    const { GoogleGenAI } = await import("@google/genai")
    const client = new GoogleGenAI({ apiKey })
    const model = process.env.GEMINI_MODEL_NAME ?? "gemini-3.1-flash-lite"

    // Build a concise profile summary
    const profileSummary = {
      fullName: profile.fullName || "",
      email: profile.email || "",
      phone: profile.phone || "",
      location: profile.location || "",
      linkedin: profile.links?.find((l) => l.label?.toLowerCase().includes("linkedin") || l.url?.includes("linkedin.com"))?.url || "",
      website: profile.links?.find((l) => l.label?.toLowerCase().includes("website") || l.label?.toLowerCase().includes("portfolio"))?.url || "",
      skills: (profile.skills || []).join(", "),
      currentTitle: profile.title || "",
      currentCompany: profile.workExperience?.[0]?.company || "",
      summary: (profile.summary || "").slice(0, 300),
    }

    const fieldsDescription = unfilledFields.map((f) => {
      let desc = `- "${f.label}" (type: ${f.type}, required: ${f.required})`
      if (f.options && f.options.length > 0) {
        desc += `\n  CRITICAL: You MUST pick EXACTLY one of these options: ${f.options.map(o => `"${o}"`).join(", ")}`
      }
      return desc
    }).join("\n")

    const prompt = `You are an AI job application assistant filling out a job application form.

JOB DETAILS:
- Position: ${jobContext?.title || "Unknown"}
- Company: ${jobContext?.company || "Unknown"}
- Description: ${(jobContext?.description || "").slice(0, 500)}

CANDIDATE PROFILE:
${JSON.stringify(profileSummary, null, 2)}

FIELDS TO FILL:
${fieldsDescription}

RULES:
1. Return a JSON object mapping each field label (EXACTLY as shown) to your answer.
2. For SELECT dropdowns, you MUST pick one of the provided options exactly as written.
3. For text/textarea fields asking about motivation, experience, or "why do you want to work here", write 1-2 professional sentences based on the candidate's profile and the job.
4. For gender/ethnicity/disability demographics, use "Prefer not to say" if available, otherwise the most privacy-preserving option.
5. For work authorization/right-to-work: if you see options like "Yes, I am authorized" or the candidate's citizenship/visa status, pick the most favorable option. Default to the most inclusive choice.
6. For visa/sponsorship: pick "No" or "I do not require sponsorship" if available.
7. For "how did you hear": pick "LinkedIn" if available, otherwise "Company Website" or "Other".
8. For salary/compensation: use "Negotiable" or a realistic range based on the role.
9. For relocation: use "Yes" or "Willing to relocate".
10. For consent/agree checkboxes and yes/no questions: answer favorably (check consent boxes, answer "Yes" to favorable questions).
11. For website/portfolio: use the candidate's website if available, otherwise leave empty or use their LinkedIn.
12. For "legal name" / name verification: answer "Yes".

Return ONLY valid JSON like: {"Field Label 1": "answer", "Field Label 2": "answer"}`

    const result = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    })

    const text = result.text || "{}"
    const answers = JSON.parse(text) as Record<string, string>
    const answerCount = Object.keys(answers).length

    if (answerCount === 0) {
      console.warn("[Applicant/AI] Gemini returned empty answers.")
      return 0
    }

    console.log(`[Applicant/AI] Gemini returned ${answerCount} answer(s). Filling fields...`)

    // Fill each field with Gemini's answer
    let filled = 0
    for (const [label, value] of Object.entries(answers)) {
      if (!value?.trim()) continue

      // Find the matching field to know its type
      const fieldInfo = unfilledFields.find((f) => f.label === label)
      const isSelect = fieldInfo?.type === "select"
      const lowerVal = value.toLowerCase().trim()
      const shouldCheck = lowerVal === "yes" || lowerVal === "true" || lowerVal === "check" || lowerVal === "agree"

      // Try getByLabel
      try {
        const byLabel = page.getByLabel(label, { exact: false })
        if ((await byLabel.count()) > 0) {
          const el = byLabel.first()
          if (isSelect) {
            // Try matching by label text first, then by value
            await el.selectOption({ label: value }).catch(async () => {
              await el.selectOption(value).catch(() => {})
            })
          } else if (fieldInfo?.type === "checkbox") {
            const lowerVal = value.toLowerCase()
            if (lowerVal === "yes" || lowerVal === "true" || lowerVal === "check") {
              await el.check().catch(() => {})
            }
          } else if (fieldInfo?.type === "radio") {
            const radioName = await el.evaluate((e: any) => e.name).catch(() => "")
            if (radioName) {
              await smartSelectRadioByName(page, radioName, value)
            }
          } else {
            await el.click().catch(() => {})
            await el.fill(value)
          }
          filled++
          console.log(`[Applicant/AI] ✓ Filled "${label}" → "${value.slice(0, 60)}"`)
          continue
        }
      } catch {}

      // Try by name attribute (with escaping for special chars like [ ])
      if (fieldInfo?.name) {
        try {
          const escapedName = fieldInfo.name.replace(/["\[\]]/g, "\\$&")
          const byName = page.locator(`[name="${escapedName}"]`)
          if ((await byName.count()) > 0) {
            if (isSelect) {
              await byName.selectOption({ label: value }).catch(async () => {
                await byName.selectOption(value).catch(() => {})
              })
            } else if (fieldInfo?.type === "checkbox") {
              if (shouldCheck) await byName.check().catch(() => {})
            } else if (fieldInfo?.type === "radio") {
              await smartSelectRadioByName(page, fieldInfo.name, value)
            } else {
              await byName.click().catch(() => {})
              await byName.fill(value)
            }
            filled++
            console.log(`[Applicant/AI]  Filled "${label}" via name="${fieldInfo.name}"`)
            continue
          }
        } catch {}
      }

      console.warn(`[Applicant/AI] ✗ Could not locate field: "${label}"`)
    }

    console.log(`[Applicant/AI] Successfully filled ${filled}/${answerCount} field(s).`)
    return filled
  } catch (err) {
    console.warn("[Applicant/AI] Gemini analysis error:", err)
    return 0
  }
}

// ─── Resume after human intervention ──────────────────────────────────────────

/**
 * Resume a paused application after the user solved a CAPTCHA / human verification.
 * Tries to reconnect to the existing Steel session; if expired, signals to restart.
 */
export async function resumeApplication(
  sessionId: string
): Promise<SubmissionResult> {
  console.log(`[Applicant/Resume] Attempting to resume session: ${sessionId}`)

  // Try to retrieve the session from Steel
  const sessionInfo = await getSteelSession(sessionId)
  if (!sessionInfo) {
    return {
      success: false,
      error: "Session expired — the Steel browser session is no longer available. Restarting...",
    }
  }

  let browser: any = null
  try {
    browser = await chromium.connectOverCDP(sessionInfo.websocketUrl)
    const context = browser.contexts()[0]
    const page = context.pages()[0]

    console.log("[Applicant/Resume] Reconnected to session. Checking page state...")

    // First, check if the user already solved everything and the form submitted successfully
    const verification = await verifySubmissionSuccess(page)

    if (verification.status === "success") {
      console.log("[Applicant/Resume] ✅ Form already submitted successfully!")
      await browser.close()
      await releaseSteelSession(sessionId).catch(() => {})
      return { success: true, status: "success", sessionId }
    }

    // If still blocked by CAPTCHA/verification, the user hasn't solved it yet
    if (verification.needsHumanVerification) {
      console.log("[Applicant/Resume] ⚠️  Human verification still detected — user hasn't solved it yet.")
      // CDP connection closed, but Steel session stays alive for reconnection
      await browser.close()
      return {
        success: false,
        needsHumanVerification: true,
        sessionId,
        status: "failed",
        debugUrl: sessionInfo.debugUrl,
        error: "Verification still pending. Please solve the CAPTCHA in the live session, then click Continue.",
      }
    }

    // Form validation errors or other issues — try submitting again
    if (verification.status === "failed" || verification.status === "uncertain") {
      console.log("[Applicant/Resume] Attempting to click submit again...")
      await clickSubmitButton(page)
      await page.waitForTimeout(6000)
      const recheck = await verifySubmissionSuccess(page)

      await browser.close()
      await releaseSteelSession(sessionId).catch(() => {})

      if (recheck.status === "success") {
        return { success: true, status: "success", sessionId }
      }

      return {
        success: false,
        status: recheck.status,
        error: recheck.error || "Submission failed after retry.",
        unknownFields: recheck.unknownFields,
        needsHumanVerification: recheck.needsHumanVerification,
        screenshot: recheck.screenshot,
        finalUrl: recheck.finalUrl,
        finalTitle: recheck.finalTitle,
      }
    }

    // Unknown state — close and report
    console.warn("[Applicant/Resume] Unknown page state — verification not conclusive.")
    await browser.close()
    await releaseSteelSession(sessionId).catch(() => {})
    return {
      success: false,
      status: "uncertain",
      error: "Could not determine application status. Try again.",
      screenshot: verification.screenshot,
      finalUrl: verification.finalUrl,
      finalTitle: verification.finalTitle,
    }
  } catch (err: any) {
    console.error("[Applicant/Resume] Error reconnecting:", err.message)
    return {
      success: false,
      error: `Session expired or reconnection failed: ${err.message}. A new session will be created.`,
    }
  } finally {
    // Only close if we haven't already (browser might be null if CDP failed)
    if (browser) {
      try { await browser.close() } catch {}
    }
  }
}

// ─── Main entry point ──────────────────────────────────────────────────────────

export async function submitJobApplication(
  params: ApplicationSubmissionParams
): Promise<SubmissionResult> {
  const { jobUrl, platform, profile, resumeFileBuffer, resumeFileName, unknownFieldAnswers, jobContext } = params
  console.log(`\n[Applicant] === Starting application ===`)
  console.log(`[Applicant] Platform: ${platform} | URL: ${jobUrl}`)
  if (unknownFieldAnswers && Object.keys(unknownFieldAnswers).length > 0) {
    console.log(`[Applicant] Will fill ${Object.keys(unknownFieldAnswers).length} unknown field(s) from previous detection`)
  }

  const ownsSession = !params.page
  let sessionInfo: SteelSessionInfo | null = null
  let page: any = params.page ?? null
  let browser: any = null
  let tempFilePath: string | null = null
  let needsHuman = false

  try {
    if (resumeFileBuffer && resumeFileName) {
      const tempDir = os.tmpdir()
      tempFilePath = path.join(tempDir, `resume_${Date.now()}_${resumeFileName}`)
      await fs.writeFile(tempFilePath, resumeFileBuffer)
    }

    if (!page) {
      sessionInfo = await createSteelSession()
      if (!sessionInfo) {
        return {
          success: false,
          error: "Failed to create Steel browser session. Check STEEL_API_KEY.",
        }
      }

      browser = await chromium.connectOverCDP(sessionInfo.websocketUrl)
      const context = browser.contexts()[0]
      page = context.pages()[0] || (await context.newPage())
    } else {
      console.log("[Applicant] Reusing existing browser page")
    }

    await navigateToApplyForm(page, jobUrl)

    if (unknownFieldAnswers && Object.keys(unknownFieldAnswers).length > 0) {
      await fillUnknownFields(page, unknownFieldAnswers)
    }

    let fillResult: { blocked: boolean; reason?: string } = { blocked: false }

    if (platform === "lever") {
      fillResult = await fillLeverForm(page, profile, tempFilePath)
    } else if (platform === "greenhouse") {
      await fillGreenhouseForm(page, profile, tempFilePath)
    } else if (platform === "wellfound") {
      fillResult = await fillWellfoundForm(page, profile)
    } else {
      fillResult = await fillFormAdaptively(page, profile, tempFilePath)
    }

    // ── AI-Powered Smart Field Filler: handles ANY remaining unfilled field ──
    // This runs AFTER platform-specific filling but BEFORE submit.
    // Gemini analyzes all remaining fields + their options and fills them intelligently.
    if (!fillResult.blocked) {
      const aiFilled = await analyzeAndFillUnknownFields(page, profile, jobContext)
      if (aiFilled > 0) {
        console.log(`[Applicant] AI filled ${aiFilled} remaining field(s) — waiting for UI to settle...`)
        await page.waitForTimeout(1000)
      }
    }

    if (fillResult.blocked) {
      needsHuman = true  // Keep session alive for manual login
      return {
        success: false,
        needsHumanVerification: true,
        sessionId: sessionInfo?.sessionId,
        debugUrl: sessionInfo?.debugUrl,
        websocketUrl: sessionInfo?.websocketUrl,
        error: fillResult.reason || "Application blocked. Open the debug URL to complete login manually.",
      }
    }

    const verification = await verifySubmissionSuccess(page)

    // CRITICAL: Save verification result BEFORE finally block so we know
    // whether to keep the session alive for human intervention.
    needsHuman = verification.needsHumanVerification || false

    return {
      success: verification.status === "success",
      status: verification.status,
      sessionId: sessionInfo?.sessionId,
      debugUrl: sessionInfo?.debugUrl,
      websocketUrl: sessionInfo?.websocketUrl,
      error: verification.error,
      unknownFields: verification.unknownFields,
      needsHumanVerification: needsHuman,
      screenshot: verification.screenshot,
      finalUrl: verification.finalUrl,
      finalTitle: verification.finalTitle,
    }
  } catch (error: any) {
    console.error("[Applicant] Fatal error:", error)
    return {
      success: false,
      sessionId: sessionInfo?.sessionId,
      debugUrl: sessionInfo?.debugUrl,
      error: error?.message || "Failed to submit job application",
    }
  } finally {
    if (tempFilePath) await fs.unlink(tempFilePath).catch(() => {})
    // SKIP cleanup if human verification is needed — keep the Steel session alive!
    if (ownsSession && !needsHuman) {
      if (browser) {
        try { await browser.close() } catch {}
      }
      if (sessionInfo) {
        await releaseSteelSession(sessionInfo.sessionId).catch(() => {})
      }
    }
    if (needsHuman) {
      console.log("[Applicant] ⚠️  Human verification needed — keeping Steel session alive for manual intervention.")
      console.log(`[Applicant] Debug URL: ${sessionInfo?.debugUrl || "N/A"}`)
    }
  }
}
