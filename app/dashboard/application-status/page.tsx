import { fetchAppliedJobs } from "@/app/actions/jobs"
import { StatusPageClient } from "./status-page-client"

export const dynamic = "force-dynamic"

export default async function ApplicationStatusPage() {
  const result = await fetchAppliedJobs()
  const jobs = (result.data ?? []) as any[]

  return <StatusPageClient initialJobs={jobs} />
}
