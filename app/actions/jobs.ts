"use server"

import { createClient } from "@/lib/supabase/server"
import { fetchJobsFromBrave } from "@/lib/jobs/brave"
import { PLATFORMS, type Platform } from "@/lib/jobs/schema"
import type { ResumeProfile } from "@/lib/resume/schema"

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
