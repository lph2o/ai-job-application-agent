"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Bookmark01Icon,
  BriefcaseIcon,
  RefreshIcon,
  SearchIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { JobCard } from "@/components/jobs/job-card"
import {
  fetchSavedJobs,
  toggleSaveJob,
  toggleAppliedJob,
  markJobAppliedManually,
  startAutoApplyJob,
} from "@/app/actions/jobs"
import type { JobWithApplication } from "@/lib/jobs/schema"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/toast"

interface SavedJobsClientProps {
  initialJobs: JobWithApplication[]
}

export function SavedJobsClient({ initialJobs }: SavedJobsClientProps) {
  const router = useRouter()
  const [jobs, setJobs] = React.useState<JobWithApplication[]>(initialJobs)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true)
    try {
      const res = await fetchSavedJobs()
      if (res.data) {
        setJobs(res.data as JobWithApplication[])
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    setJobs(initialJobs)
  }, [initialJobs])

  // Poll while any saved job is actively applying / detecting fields
  React.useEffect(() => {
    const hasActiveProcessing = jobs.some(
      (j) =>
        j.application_status === "detecting_fields" ||
        j.application_status === "applying"
    )
    if (!hasActiveProcessing) return

    const timer = setInterval(() => {
      handleRefresh()
    }, 4000)

    return () => clearInterval(timer)
  }, [jobs, handleRefresh])

  const handleSave = async (jobId: string, saved: boolean) => {
    const job = jobs.find((j) => j.id === jobId)

    if (!saved) {
      setJobs((prev) => prev.filter((j) => j.id !== jobId))
    } else {
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, saved_status: true } : j))
      )
    }

    const result = await toggleSaveJob(jobId, saved)
    if (!result.error) {
      toast.add({
        type: "success",
        title: saved ? "Job saved" : "Removed from saved",
        description: job
          ? saved
            ? `${job.title} was added to your saved jobs.`
            : `${job.title} was removed from your saved jobs.`
          : undefined,
      })
    } else {
      toast.add({
        type: "error",
        title: "Could not update save",
        description: result.error,
      })
      await handleRefresh()
    }
    router.refresh()
  }

  const handleApply = async (jobId: string) => {
    const job = jobs.find((j) => j.id === jobId)
    if (!job) return

    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId ? { ...j, applied_status: true } : j
      )
    )

    await toggleAppliedJob(jobId, true)
    router.refresh()
    window.open(job.job_url, "_blank", "noopener,noreferrer")
  }

  const handleManualApply = async (jobId: string, url: string) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? { ...j, applied_status: true, application_status: "applied" }
          : j
      )
    )
    await markJobAppliedManually(jobId)
    window.open(url, "_blank", "noopener,noreferrer")
    router.refresh()
  }

  const handleAutoApply = async (jobId: string) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId ? { ...j, application_status: "detecting_fields" } : j
      )
    )
    await startAutoApplyJob(jobId)
    router.refresh()
  }

  const filteredJobs = React.useMemo(() => {
    if (!searchQuery.trim()) return jobs
    const q = searchQuery.toLowerCase().trim()
    return jobs.filter(
      (job) =>
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        (job.location && job.location.toLowerCase().includes(q)) ||
        (job.platform && job.platform.toLowerCase().includes(q))
    )
  }, [jobs, searchQuery])

  return (
    <main className="flex flex-1 flex-col gap-6 bg-muted/20 p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <HugeiconsIcon icon={Bookmark01Icon} strokeWidth={2} className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Bookmarks
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Saved Jobs</h1>
          <p className="text-sm text-muted-foreground">
            {jobs.length === 0
              ? "Jobs you bookmark will show up here."
              : `${jobs.length} saved job${jobs.length === 1 ? "" : "s"} — statuses stay in sync with your applications.`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="gap-2 rounded-xl"
        >
          <HugeiconsIcon
            icon={RefreshIcon}
            strokeWidth={2}
            className={cn("size-4", isRefreshing && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {jobs.length > 0 && (
        <div className="relative max-w-md">
          <HugeiconsIcon
            icon={SearchIcon}
            strokeWidth={2}
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved jobs..."
            className="pl-9"
          />
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted/50">
            <HugeiconsIcon
              icon={Bookmark01Icon}
              strokeWidth={2}
              className="size-6 text-muted-foreground"
            />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold">No saved jobs yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Browse matching roles and tap the bookmark icon to save them here.
            </p>
          </div>
          <Button
            size="sm"
            className="gap-2 rounded-xl"
            nativeButton={false}
            render={<Link href="/dashboard/jobs" />}
          >
            <HugeiconsIcon icon={BriefcaseIcon} strokeWidth={2} className="size-4" />
            Discover jobs
          </Button>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No saved jobs match &ldquo;{searchQuery}&rdquo;.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              id={job.id}
              title={job.title}
              company={job.company}
              companyLogo={job.company_logo}
              location={job.location}
              salary={job.salary}
              jobType={job.job_type}
              experienceLevel={job.experience_level}
              description={job.description}
              tags={job.tags}
              platform={job.platform}
              matchScore={job.match_score ?? 0}
              jobUrl={job.job_url}
              savedStatus={job.saved_status ?? true}
              appliedStatus={job.applied_status ?? false}
              applicationStatus={job.application_status}
              missingFields={job.missing_fields}
              unknownFormFields={job.unknown_form_fields}
              browserbaseSessionId={job.browserbase_session_id}
              browserbaseDebugUrl={job.browserbase_debug_url}
              applicationError={job.application_error}
              onSave={handleSave}
              onApply={handleApply}
              onManualApply={handleManualApply}
              onAutoApply={handleAutoApply}
            />
          ))}
        </div>
      )}
    </main>
  )
}
