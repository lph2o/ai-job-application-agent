import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { JobsPageClient } from "./jobs-page-client"

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub

  if (!userId) {
    redirect("/sign-in?next=/dashboard/jobs")
  }

  // Fetch user profile
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("parsed_data, full_name")
    .eq("id", userId)
    .single()

  const profile = (profileRow?.parsed_data as Record<string, unknown>) ?? {}
  const fullName = (profileRow?.full_name as string) ?? "User"

  // Fetch current saved/applied jobs for activity feed
  const { data: recentActivity } = await supabase
    .from("jobs")
    .select("id, title, company, platform, saved_status, applied_status, created_at")
    .eq("user_id", userId)
    .or("saved_status.eq.true,applied_status.eq.true")
    .order("created_at", { ascending: false })
    .limit(10)

  const activities = (recentActivity ?? []).flatMap((job) => {
    const items: Array<{
      id: string
      type: "saved" | "applied"
      title: string
      company?: string
      platform?: string
      timestamp: string
    }> = []

    if (job.saved_status) {
      items.push({
        id: `${job.id}-saved`,
        type: "saved" as const,
        title: job.title,
        company: job.company,
        platform: job.platform,
        timestamp: job.created_at,
      })
    }
    if (job.applied_status) {
      items.push({
        id: `${job.id}-applied`,
        type: "applied" as const,
        title: job.title,
        company: job.company,
        platform: job.platform,
        timestamp: job.created_at,
      })
    }
    return items
  })

  return (
    <JobsPageClient
      userId={userId}
      profile={profile}
      fullName={fullName}
      initialActivities={activities}
    />
  )
}
