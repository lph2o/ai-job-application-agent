import { type Platform } from "./schema"
import { enrichJob } from "./enrich"
import type { ResumeProfile } from "@/lib/resume/schema"

const BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search"
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))


interface BraveSearchResult {
  title: string
  url: string
  description: string
  meta_url?: {
    hostname?: string
  }
}

interface BraveSearchResponse {
  web?: {
    results: BraveSearchResult[]
  }
}

// One primary domain per platform — Brave Search API does not reliably handle
// multiple `site:` operators in a single query (only the first one is honored).
// We use the most job-rich official subdomain for each ATS.
const PLATFORM_SITES: Record<Platform, string> = {
  greenhouse: "site:job-boards.greenhouse.io OR site:boards.greenhouse.io",
  lever: "site:jobs.lever.co OR site:lever.co",
  workable: "site:apply.workable.com OR site:jobs.workable.com",
  wellfound: "site:wellfound.com/jobs OR site:wellfound.com",
}

function cleanTitle(rawTitle?: string): string {
  if (!rawTitle) return "Developer"
  // If title has multiple roles separated by &, /, or comma, pick the most relevant one or clean symbols
  const parts = rawTitle.split(/[&/,|]/).map((p) => p.trim()).filter(Boolean)
  const primaryRole = parts[0] || rawTitle
  return primaryRole.replace(/[^a-zA-Z0-9\s-]/g, "").trim() || "Developer"
}

function buildSearchQuery(
  platform: Platform,
  profile: ResumeProfile
): string {
  const siteFilter = PLATFORM_SITES[platform] ?? `site:${platform}.com`
  const roleTitle = cleanTitle(profile.title ?? undefined)
  const topSkills = (profile.skills ?? []).slice(0, 2).join(" ")

  const parts: string[] = [siteFilter]

  if (roleTitle) {
    parts.push(`"${roleTitle}"`)
  } else if (topSkills) {
    parts.push(topSkills)
  } else {
    parts.push("Developer")
  }

  const query = parts.join(" ").trim()
  return query
}

function extractCompanyFromUrl(url: string, platform: Platform): string {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname
    const pathParts = urlObj.pathname.split("/").filter(Boolean)

    if (platform === "greenhouse") {
      if (hostname.includes("greenhouse.io")) {
        return pathParts[0]?.replace(/-/g, " ") ?? "Tech Company"
      }
    }
    if (platform === "lever") {
      return pathParts[0]?.replace(/-/g, " ") ?? "Tech Company"
    }
    if (platform === "wellfound") {
      return pathParts[1]?.replace(/-/g, " ") ?? pathParts[0]?.replace(/-/g, " ") ?? "Startup"
    }
    if (platform === "workable") {
      return pathParts[0]?.replace(/-/g, " ") ?? "Company"
    }
  } catch {
    // Fallback
  }
  return "Company"
}

const KNOWN_SKILLS = [
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
  "CSS",
  "HTML",
  "SEO",
  "Meta Ads",
  "TikTok Ads",
  "Copywriting",
  "Creative Strategy",
  "DTC",
  "Paid Social",
  "Growth Marketing",
]

function extractTags(text: string, userSkills: string[] = []): string[] {
  const lowerText = text.toLowerCase()
  const found = new Set<string>()

  for (const skill of KNOWN_SKILLS) {
    if (lowerText.includes(skill.toLowerCase())) {
      found.add(skill)
    }
  }

  return Array.from(found).slice(0, 6)
}

function extractLocation(text: string): string | null {
  // Explicit ATS format: "Location: Santa Ana, California — On-site" or "Location: Paris"
  const explicitMatch = text.match(/(?:Location:?\s*|Based in:?\s*)([A-Z][a-zA-Z0-9\s,\-\(\)]+?)(?:\s*(?:—|-|\||\.|\n|$))/i)
  if (explicitMatch && explicitMatch[1] && explicitMatch[1].length < 50) {
    return explicitMatch[1].trim()
  }

  // City, State / City, Country pattern (e.g. "Santa Ana, California", "Paris, France")
  const cityStateMatch = text.match(/([A-Z][a-zA-Z\s]{2,18},\s*(?:[A-Z]{2}|[A-Z][a-zA-Z\s]{2,18}))/)
  if (cityStateMatch) {
    const isRemote = /remote/i.test(text)
    return isRemote ? `${cityStateMatch[1]} (Remote)` : cityStateMatch[1]
  }

  if (/remote\s*\(?\w*\)?/i.test(text) || /work from anywhere/i.test(text)) {
    if (/us remote|united states/i.test(text)) return "Remote (US)"
    if (/europe|eu remote/i.test(text)) return "Remote (EU)"
    return "Remote"
  }
  if (/hybrid/i.test(text)) return "Hybrid"
  if (/on-site|onsite/i.test(text)) return "On-site"

  return null
}

function extractJobType(text: string): string | null {
  const explicitType = text.match(/(?:Job Type:?\s*|Employment Type:?\s*)(Full-time|Part-time|Contract|Freelance|Internship)/i)
  if (explicitType) return explicitType[1]

  if (/full-time|full time/i.test(text)) return "Full-time"
  if (/part-time|part time/i.test(text)) return "Part-time"
  if (/contract|freelance/i.test(text)) return "Contract"
  if (/internship|intern\b/i.test(text)) return "Internship"
  return null
}

function extractExperienceLevel(title: string, text: string): string | null {
  const combined = `${title} ${text}`.toLowerCase()

  const expYearsMatch = combined.match(/(\d+\+?\s*years?|\d+\+\s*yrs?)\s*(?:of\s*)?(?:experience|exp)?/i)
  if (expYearsMatch) {
    return expYearsMatch[0].trim()
  }

  if (/principal|staff|director|head of/i.test(combined)) return "Lead / Principal"
  if (/senior|sr\b/i.test(combined)) return "Senior Level"
  if (/junior|jr\b|intern|entry/i.test(combined)) return "Entry Level"
  if (/mid-level|mid level|intermediate/i.test(combined)) return "Mid Level"
  if (/lead|manager/i.test(combined)) return "Lead"
  return null
}

function extractSalary(text: string): string | null {
  // Matches "Salary: $70,000", "Salary: $100k - $140k", "$70,000/yr", "$50/hr", "€60,000"
  const explicitMatch = text.match(/(?:Salary:?\s*|Compensation:?\s*|Pay:?\s*)([\$€£]\s*\d+[\d,]*\s*k?(?:\s*(?:-|to)\s*[\$€£]?\s*\d+[\d,]*\s*k?)?(?:\s*\/\s*(?:yr|year|hr|hour|mo))?)/i)
  if (explicitMatch) return explicitMatch[1].trim()

  const rangeMatch = text.match(
    /(?:[\$€£]\s*\d+[\d,]*\s*k?\s*(?:-|to)\s*[\$€£]?\s*\d+[\d,]*\s*k?|\d+[\d,]*\s*k?\s*-\s*\d+[\d,]*\s*k?\s*(?:USD|EUR|GBP)?)(?:\s*\/\s*(?:yr|year|hr|hour|mo))?/i
  )
  if (rangeMatch) return rangeMatch[0].trim()

  return null
}

function parseJobFromResult(
  result: BraveSearchResult,
  platform: Platform,
  userSkills: string[] = []
): {
  title: string
  company: string
  job_url: string
  description: string
  location: string | null
  salary: string | null
  job_type: string | null
  experience_level: string | null
  tags: string[]
} {
  const url = result.url
  const title = result.title.split(" - ")[0]?.split(" at ")[0]?.split(" in ")[0]?.split(" | ")[0]?.trim() ?? result.title
  const company = extractCompanyFromUrl(url, platform)
  const description = result.description ?? ""
  const fullText = `${title} ${description}`

  const location = extractLocation(fullText)
  const salary = extractSalary(fullText)
  const job_type = extractJobType(fullText)
  const experience_level = extractExperienceLevel(title, fullText)
  const tags = extractTags(fullText, userSkills)

  return {
    title,
    company: company.charAt(0).toUpperCase() + company.slice(1),
    job_url: url,
    description,
    location,
    salary,
    job_type,
    experience_level,
    tags,
  }
}

function computeMatchScore(
  job: { title: string; description: string },
  profile: ResumeProfile
): number {
  let score = 65
  const skills = (profile.skills ?? []).map((s) => s.toLowerCase())
  const text = `${job.title} ${job.description}`.toLowerCase()

  const matchedSkills = skills.filter((skill) => text.includes(skill))
  score += matchedSkills.length * 8

  if (profile.title && text.includes(profile.title.toLowerCase())) {
    score += 15
  }

  if (profile.location && text.includes(profile.location.toLowerCase())) {
    score += 10
  }

  return Math.min(98, score)
}

export async function fetchJobsFromBrave(
  platform: Platform,
  profile: ResumeProfile,
  apiKey: string
): Promise<
  Array<{
    title: string
    company: string
    job_url: string
    description: string
    location: string | null
    salary: string | null
    job_type: string | null
    experience_level: string | null
    tags: string[]
    match_score: number
  }>
> {
  const query = buildSearchQuery(platform, profile)
  console.log(`[Brave] Fetching ${platform} query: ${query}`)

  let results = await executeBraveSearch(query, apiKey, "pw")

  // Fallback 1: if 0 results, try without freshness filter
  if (results.length === 0) {
    results = await executeBraveSearch(query, apiKey, undefined)
  }

  // Fallback 2: if still 0 results, try fallback broader query with generic term
  if (results.length === 0) {
    const siteFilter = PLATFORM_SITES[platform] ?? `site:${platform}.com`
    const fallbackQuery = `${siteFilter} Developer`
    results = await executeBraveSearch(fallbackQuery, apiKey, undefined)
  }

  const userSkills = profile.skills ?? []

  // Enrich each job with ATS API data (runs in parallel, with a 200ms stagger)
  const enriched = await Promise.all(
    results.slice(0, 10).map(async (result, idx) => {
      // Stagger enrichment calls to avoid hammering ATS APIs simultaneously
      if (idx > 0) await sleep(idx * 200)

      const parsed = parseJobFromResult(result, platform, userSkills)
      let enrichedData = null
      try {
        enrichedData = await enrichJob(result.url, platform)
      } catch {
        // Silently fall back to brave snippet data
      }

      return {
        ...parsed,
        // Overlay with ATS-sourced data when available
        ...(enrichedData?.description && { description: enrichedData.description }),
        ...(enrichedData?.location && { location: enrichedData.location }),
        ...(enrichedData?.salary && { salary: enrichedData.salary }),
        ...(enrichedData?.job_type && { job_type: enrichedData.job_type }),
        ...(enrichedData?.experience_level && { experience_level: enrichedData.experience_level }),
        ...(enrichedData?.tags && enrichedData.tags.length > 0 && { tags: enrichedData.tags }),
        match_score: computeMatchScore(parsed, profile),
      }
    })
  )

  return enriched
}


async function executeBraveSearch(
  query: string,
  apiKey: string,
  freshness?: string,
  retryCount = 0
): Promise<BraveSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    count: "10",
  })
  if (freshness) {
    params.set("freshness", freshness)
  }

  try {
    const response = await fetch(`${BRAVE_API_URL}?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    })

    if (response.status === 429) {
      if (retryCount < 2) {
        console.warn(`[Brave Rate Limit 429] Waiting 1.2s before retry ${retryCount + 1}...`)
        await sleep(1200 * (retryCount + 1))
        return executeBraveSearch(query, apiKey, freshness, retryCount + 1)
      }
      console.error(`[Brave Rate Limit 429] Max retries reached for query: ${query}`)
      return []
    }

    if (!response.ok) {
      console.error(`Brave API HTTP Error ${response.status} for query: ${query}`)
      return []
    }

    const data: BraveSearchResponse = await response.json()
    return data.web?.results ?? []
  } catch (err) {
    console.error(`Failed to fetch jobs from Brave API for query (${query}):`, err)
    return []
  }
}
