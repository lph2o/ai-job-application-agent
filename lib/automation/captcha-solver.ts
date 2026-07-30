/**
 * CAPTCHA Auto-Solver Utility
 * Compatible with CapMonster Cloud, CapSolver, EzCaptcha, and 2Captcha JSON APIs.
 * Supports hCaptcha (Lever, etc.) and reCAPTCHA v2/v3 (Greenhouse, etc.).
 */

export interface SolveCaptchaParams {
  page: any
  apiKey?: string
  providerUrl?: string
}

export interface SolveCaptchaResult {
  solved: boolean
  token?: string
  error?: string
}

export async function extractCaptchaSitekey(page: any): Promise<{
  sitekey: string | null
  type: "hcaptcha" | "recaptcha" | null
}> {
  try {
    const sitekeyInfo = await page.evaluate(() => {
      const hCaptchaEl =
        document.querySelector("[data-sitekey]") ||
        document.querySelector(".h-captcha") ||
        document.querySelector("#h-captcha") ||
        document.querySelector("iframe[src*='hcaptcha']")

      if (hCaptchaEl) {
        const sitekey =
          hCaptchaEl.getAttribute("data-sitekey") ||
          hCaptchaEl.getAttribute("sitekey") ||
          new URLSearchParams(hCaptchaEl.getAttribute("src") || "").get("sitekey")
        if (sitekey) return { sitekey, type: "hcaptcha" as const }
      }

      const reCaptchaEl =
        document.querySelector(".g-recaptcha") ||
        document.querySelector("[data-sitekey]") ||
        document.querySelector("iframe[src*='recaptcha']")

      if (reCaptchaEl) {
        const sitekey =
          reCaptchaEl.getAttribute("data-sitekey") ||
          reCaptchaEl.getAttribute("sitekey") ||
          new URLSearchParams(reCaptchaEl.getAttribute("src") || "").get("k") ||
          new URLSearchParams(reCaptchaEl.getAttribute("src") || "").get("sitekey")
        if (sitekey) return { sitekey, type: "recaptcha" as const }
      }

      const html = document.documentElement.outerHTML
      const hMatch = html.match(/data-sitekey=["']([a-f0-9-]{36})["']/i) || html.match(/sitekey:\s*["']([a-f0-9-]{36})["']/i)
      if (hMatch && hMatch[1]) return { sitekey: hMatch[1], type: "hcaptcha" as const }

      const rMatch = html.match(/6L[a-zA-Z0-9_-]{38}/)
      if (rMatch && rMatch[0]) return { sitekey: rMatch[0], type: "recaptcha" as const }

      return { sitekey: null, type: null }
    })

    return sitekeyInfo
  } catch (err) {
    console.warn("[CaptchaSolver] Error extracting sitekey:", err)
    return { sitekey: null, type: null }
  }
}

export async function solveCaptchaAuto(
  params: SolveCaptchaParams
): Promise<SolveCaptchaResult> {
  const apiKey = params.apiKey || process.env.CAPTCHA_SOLVER_KEY || process.env.CAPMONSTER_API_KEY || process.env.CAPSOLVER_API_KEY

  if (!apiKey?.trim()) {
    return {
      solved: false,
      error: "No CAPTCHA solver API key configured in environment (CAPTCHA_SOLVER_KEY).",
    }
  }

  const providerUrl = (
    params.providerUrl ||
    process.env.CAPTCHA_SOLVER_PROVIDER_URL ||
    "https://api.capmonster.cloud"
  ).replace(/\/$/, "")

  const pageUrl = params.page.url()
  const { sitekey, type } = await extractCaptchaSitekey(params.page)

  if (!sitekey || !type) {
    return {
      solved: false,
      error: "Could not extract CAPTCHA sitekey from page.",
    }
  }

  console.log(`[CaptchaSolver] Auto-solving ${type.toUpperCase()} | sitekey: ${sitekey}`)

  const taskType = type === "hcaptcha" ? "HCaptchaTaskProxyless" : "NoCaptchaTaskProxyless"

  try {
    const createResp = await fetch(`${providerUrl}/createTask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientKey: apiKey,
        task: {
          type: taskType,
          websiteURL: pageUrl,
          websiteKey: sitekey,
        },
      }),
    })

    const createData = await createResp.json()

    if (createData.errorId !== 0 && createData.errorId !== undefined && createData.errorId !== null) {
      console.warn(`[CaptchaSolver] createTask error:`, createData)
      return {
        solved: false,
        error: `CAPTCHA solver API error: ${createData.errorDescription || createData.errorCode || "createTask failed"}`,
      }
    }

    const taskId = createData.taskId
    if (!taskId) {
      return { solved: false, error: "CAPTCHA solver API returned no taskId." }
    }

    console.log(`[CaptchaSolver] Task created: ${taskId}. Polling for solution...`)

    const startTime = Date.now()
    const TIMEOUT_MS = 45000
    const POLL_INTERVAL = 3000

    while (Date.now() - startTime < TIMEOUT_MS) {
      await new Promise((res) => setTimeout(res, POLL_INTERVAL))

      const resultResp = await fetch(`${providerUrl}/getTaskResult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientKey: apiKey,
          taskId,
        }),
      })

      const resultData = await resultResp.json()

      if (resultData.status === "ready") {
        const token =
          resultData.solution?.gRecaptchaResponse ||
          resultData.solution?.token ||
          resultData.solution?.response

        if (token) {
          console.log(`[CaptchaSolver] ✓ CAPTCHA solved! Token length: ${token.length}`)
          await injectCaptchaToken(params.page, token, type)
          return { solved: true, token }
        }
      } else if (resultData.status === "processing") {
        console.log(`[CaptchaSolver] Still processing... (${Math.round((Date.now() - startTime) / 1000)}s)`)
      } else if (resultData.errorId) {
        console.warn(`[CaptchaSolver] Task result error:`, resultData)
        return {
          solved: false,
          error: `CAPTCHA solve failed: ${resultData.errorDescription || "Unknown error"}`,
        }
      }
    }

    return { solved: false, error: "CAPTCHA solve timed out after 45s." }
  } catch (err: any) {
    console.error("[CaptchaSolver] Network error:", err)
    return { solved: false, error: err?.message || "CAPTCHA solver request failed." }
  }
}

async function injectCaptchaToken(page: any, token: string, type: "hcaptcha" | "recaptcha") {
  try {
    await page.evaluate(
      ({ token, type }: { token: string; type: string }) => {
        const targetSelectors = [
          'textarea[name="h-captcha-response"]',
          'input[name="h-captcha-response"]',
          '#hcaptchaResponseInput',
          'textarea[name="g-recaptcha-response"]',
          'input[name="g-recaptcha-response"]',
          '[id*="h-captcha-response"]',
          '[id*="g-recaptcha-response"]',
        ]

        let injected = 0
        for (const sel of targetSelectors) {
          const els = document.querySelectorAll(sel)
          els.forEach((el: any) => {
            el.value = token
            el.innerHTML = token
            el.dispatchEvent(new Event("input", { bubbles: true }))
            el.dispatchEvent(new Event("change", { bubbles: true }))
            injected++
          })
        }

        if (type === "hcaptcha" && (window as any).hcaptcha) {
          try { ;(window as any).hcaptcha.getResp = () => token } catch {}
        }

        console.log(`[CaptchaSolver] Injected token into ${injected} input(s).`)
      },
      { token, type }
    )
  } catch (err) {
    console.warn("[CaptchaSolver] Token injection warning:", err)
  }
}
