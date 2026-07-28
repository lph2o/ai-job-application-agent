import type { Platform } from "./schema"

export interface EnrichedJobData {
  title?: string
  company?: string
  location?: string | null
  salary?: string | null
  job_type?: string | null
  experience_level?: string | null
  description?: string
  tags?: string[]
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function stripHtml(rawHtml: string): string {
  if (!rawHtml) return ""
  let text = rawHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<h[1-6][^>]*>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")

  text = decodeHtmlEntities(text)
  return text.replace(/\n\s*\n\s*\n/g, "\n\n").trim()
}

function extractSalaryFromText(text: string): string | null {
  if (!text) return null

  // Matches "Pay Range: $55k -$62k", "Pay Range $26.44 - $29.81 USD", "$70,000", "$120,000 - $160,000", "€60,000 - €80,000", "$40 - $60 / hr"
  const rangeMatch = text.match(
    /(?:Pay Range:?|Salary:?|Compensation:?|Pay:?)\s*([\$€£]\s*\d+[\d\.,]*\s*k?(?:\s*(?:-|to)\s*[\$€£]?\s*\d+[\d\.,]*\s*k?)?(?:\s*(?:Annually|hourly|USD|EUR|GBP|\/yr|\/hr))?)/i
  )
  if (rangeMatch) return rangeMatch[1].trim()

  const directMatch = text.match(
    /(?:[\$€£]\s*\d+[\d,]*\s*k?\s*(?:-|to)\s*[\$€£]?\s*\d+[\d,]*\s*k?|\d+[\d,]*\s*k?\s*-\s*\d+[\d,]*\s*k?\s*(?:USD|EUR|GBP))(?:\s*\/\s*(?:yr|year|hr|hour|mo))?/i
  )
  if (directMatch) return directMatch[0].trim()

  return null
}

function extractExperienceLevelFromText(text: string): string | null {
  if (!text) return null
  const lower = text.toLowerCase()

  const yrsMatch = lower.match(/(\d+\+?\s*years?|\d+\+\s*yrs?)\s*(?:of\s*)?(?:experience|exp)?/i)
  if (yrsMatch) return yrsMatch[0].trim()

  if (/principal|staff|director|head of/i.test(lower)) return "Lead / Principal"
  if (/senior|sr\b/i.test(lower)) return "Senior Level"
  if (/junior|jr\b|intern|entry/i.test(lower)) return "Entry Level"
  if (/mid-level|mid level|intermediate/i.test(lower)) return "Mid Level"
  if (/lead|manager/i.test(lower)) return "Lead"
  return null
}

const COMMON_TECH_SKILLS = [
  "React",
  "TypeScript",
  "JavaScript",
  "Node.js",
  "Next.js",
  "Python",
  "PostgreSQL",
  "MongoDB",
  "GraphQL",
  "TailwindCSS",
  "Vue.js",
  "Angular",
  "Docker",
  "AWS",
  "Figma",
  "UI/UX",
  "REST API",
  "Go",
  "Rust",
  "Java",
  "C++",
  "C#",
  "Ruby",
  "PHP",
  "Laravel",
  "Swift",
  "Flutter",
  "Kubernetes",
  "Git",
  "SQL",
  "Redis",
  "After Effects",
  "Premiere Pro",
  "Photoshop",
  "Illustrator",
  "Cinema 4D",
  "Blender",
  "Motion Graphics",
  "Creative Strategy",
  "Meta Ads",
  "TikTok Ads",
  "SEO",
]

function extractTechTags(text: string): string[] {
  const lower = text.toLowerCase()
  const tags = new Set<string>()

  for (const skill of COMMON_TECH_SKILLS) {
    if (lower.includes(skill.toLowerCase())) {
      tags.add(skill)
    }
  }

  return Array.from(tags).slice(0, 7)
}

/* ─── Greenhouse Enrichment ───────────────────────────────────────────────── */
async function enrichGreenhouseJob(url: string): Promise<EnrichedJobData | null> {
  try {
    const urlObj = new URL(url)
    const parts = urlObj.pathname.split("/").filter(Boolean)
    // Format: /tegna/jobs/4014902007 or /embed/job_app?for=gitlab&token=123
    let board = ""
    let jobId = ""

    if (parts.length >= 3 && parts[1] === "jobs") {
      board = parts[0]
      jobId = parts[2]
    } else {
      board = urlObj.searchParams.get("for") ?? ""
      jobId = urlObj.searchParams.get("token") ?? parts[parts.length - 1] ?? ""
    }

    if (!board || !jobId) return null

    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${jobId}`
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(3500),
    })

    if (!res.ok) return null
    const data = await res.json()

    const rawContent = data.content ?? ""
    const cleanContent = stripHtml(rawContent)
    const fullText = `${data.title ?? ""} ${data.location?.name ?? ""} ${cleanContent}`

    return {
      title: data.title,
      location: data.location?.name ?? null,
      salary: extractSalaryFromText(cleanContent),
      job_type: /part-time/i.test(cleanContent) ? "Part-time" : /contract/i.test(cleanContent) ? "Contract" : "Full-time",
      experience_level: extractExperienceLevelFromText(data.title + " " + cleanContent),
      description: cleanContent || undefined,
      tags: extractTechTags(fullText),
    }
  } catch {
    return null
  }
}

/* ─── Lever Enrichment ────────────────────────────────────────────────────── */
async function enrichLeverJob(url: string): Promise<EnrichedJobData | null> {
  try {
    const urlObj = new URL(url)
    const parts = urlObj.pathname.split("/").filter(Boolean)
    // Format: /company/job-id
    if (parts.length < 2) return null
    const company = parts[0]
    const jobId = parts[1]

    const apiUrl = `https://api.lever.co/v0/postings/${company}/${jobId}`
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(3500),
    })

    if (!res.ok) return null
    const data = await res.json()

    const categories = data.categories ?? {}
    const lists = data.lists ?? []
    let fullTextParts: string[] = [data.descriptionPlain ?? ""]

    for (const list of lists) {
      if (list.text) fullTextParts.push(`\n\n${list.text}:`)
      if (list.content) fullTextParts.push(`\n${stripHtml(list.content)}`)
    }

    const fullContent = fullTextParts.join("\n").trim()
    const fullText = `${data.text ?? ""} ${categories.location ?? ""} ${fullContent}`

    return {
      title: data.text,
      location: categories.location ?? null,
      salary: extractSalaryFromText(fullContent),
      job_type: categories.commitment ?? null,
      experience_level: extractExperienceLevelFromText(data.text + " " + fullContent),
      description: fullContent || undefined,
      tags: extractTechTags(fullText),
    }
  } catch {
    return null
  }
}

/* ─── Workable Enrichment ─────────────────────────────────────────────────── */
async function enrichWorkableJob(url: string): Promise<EnrichedJobData | null> {
  try {
    const urlObj = new URL(url)
    const parts = urlObj.pathname.split("/").filter(Boolean)
    // Format: /account/j/shortcode
    if (parts.length < 3) return null
    const account = parts[0]
    const shortcode = parts[parts.length - 1]

    const apiUrl = `https://apply.workable.com/api/v2/accounts/${account}/jobs/${shortcode}`
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(3500),
    })

    if (!res.ok) return null
    const data = await res.json()

    const locationObj = data.location ?? {}
    const locParts = [locationObj.city, locationObj.region, locationObj.country].filter(Boolean)
    const locationStr = locParts.join(", ") || (data.workplace === "remote" ? "Remote" : null)

    const desc = stripHtml(data.description ?? "")
    const reqs = stripHtml(data.requirements ?? "")
    const benefits = stripHtml(data.benefits ?? "")

    const combinedText = [desc, reqs ? `\n\nRequirements:\n${reqs}` : "", benefits ? `\n\nBenefits:\n${benefits}` : ""]
      .join("")
      .trim()

    const fullText = `${data.title ?? ""} ${locationStr ?? ""} ${combinedText}`

    const jobTypeMap: Record<string, string> = {
      full: "Full-time",
      part: "Part-time",
      contract: "Contract",
      internship: "Internship",
    }

    return {
      title: data.title,
      location: locationStr,
      salary: extractSalaryFromText(combinedText),
      job_type: jobTypeMap[data.type] ?? data.type ?? null,
      experience_level: extractExperienceLevelFromText(data.title + " " + combinedText),
      description: combinedText || undefined,
      tags: extractTechTags(fullText),
    }
  } catch {
    return null
  }
}

/* ─── Main Enrichment Switcher ────────────────────────────────────────────── */
export async function enrichJob(
  url: string,
  platform: Platform
): Promise<EnrichedJobData | null> {
  if (platform === "greenhouse" || url.includes("greenhouse.io")) {
    return enrichGreenhouseJob(url)
  }
  if (platform === "lever" || url.includes("lever.co")) {
    return enrichLeverJob(url)
  }
  if (platform === "workable" || url.includes("workable.com")) {
    return enrichWorkableJob(url)
  }
  return null
}
