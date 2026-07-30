import { fetchSavedJobs } from "@/app/actions/jobs"
import { SavedJobsClient } from "./saved-jobs-client"
import type { JobWithApplication } from "@/lib/jobs/schema"

export const dynamic = "force-dynamic"

export default async function SavedJobsPage() {
  const result = await fetchSavedJobs()
  const jobs = (result.data ?? []) as JobWithApplication[]

  return <SavedJobsClient initialJobs={jobs} />
}
