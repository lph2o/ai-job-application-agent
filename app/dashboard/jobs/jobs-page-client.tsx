"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  FileSearchIcon,
  AlertCircleIcon,
  RefreshIcon,
  SearchIcon,
  SortingAZ01Icon,
  LayoutGridIcon,
  ListViewIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { WelcomeBanner } from "@/components/jobs/welcome-banner"
import { PlatformSelector } from "@/components/jobs/platform-selector"
import { JobCard } from "@/components/jobs/job-card"
import { JobCardSkeleton } from "@/components/jobs/job-card-skeleton"
import { RecentActivity } from "@/components/jobs/recent-activity"
import { ProfileCompletenessCard } from "@/components/profile/profile-completeness-card"
import { fetchAllJobs, toggleSaveJob, toggleAppliedJob, markJobAppliedManually, startAutoApplyJob } from "@/app/actions/jobs"
import { type Platform, type JobWithApplication } from "@/lib/jobs/schema"
import { normalizeProfile, type ResumeProfile } from "@/lib/resume/schema"
import { cn } from "@/lib/utils"

interface JobsPageClientProps {
  userId: string
  profile: Record<string, unknown>
  fullName: string
  initialActivities: Array<{
    id: string
    type: "saved" | "applied" | "searched"
    title: string
    company?: string
    platform?: string
    timestamp: string
  }>
}

export function JobsPageClient({
  userId,
  profile,
  fullName,
  initialActivities,
}: JobsPageClientProps) {
  const router = useRouter()
  const [selectedPlatforms, setSelectedPlatforms] = React.useState<Platform[]>([
    "greenhouse",
    "lever",
    "workable",
    "wellfound",
  ])
  const [jobs, setJobs] = React.useState<JobWithApplication[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(true)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isCached, setIsCached] = React.useState(false)
  const [activities, setActivities] = React.useState(initialActivities)

  const parsedProfile = React.useMemo(
    () => normalizeProfile(profile as ResumeProfile | null),
    [profile]
  )

  const loadJobs = React.useCallback(async () => {
    setError(null)
    const result = await fetchAllJobs(parsedProfile)
    if (result.error) {
      setError(result.error)
      setJobs([])
    } else {
      setJobs(result.data ?? [])
      setIsCached(result.cached ?? false)
    }
  }, [parsedProfile])

  React.useEffect(() => {
    loadJobs().finally(() => setIsLoading(false))
  }, [loadJobs])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadJobs()
    setIsRefreshing(false)
  }

  const handleTogglePlatform = (platform: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    )
  }

  const handleSave = async (jobId: string, saved: boolean) => {
    const job = jobs.find((j) => j.id === jobId)
    if (!job) return

    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, saved_status: saved } : j))
    )

    const result = await toggleSaveJob(jobId, saved)
    if (!result.error) {
      setActivities((prev) => [
        {
          id: `${jobId}-saved-${Date.now()}`,
          type: saved ? "saved" : "searched",
          title: job.title,
          company: job.company,
          platform: job.platform,
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ])
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

    setActivities((prev) => [
      {
        id: `${jobId}-applied-${Date.now()}`,
        type: "applied" as const,
        title: job.title,
        company: job.company,
        platform: job.platform,
        timestamp: new Date().toISOString(),
      },
      ...prev,
    ])

    router.refresh()
    window.open(job.job_url, "_blank", "noopener,noreferrer")
  }

  const handleManualApply = async (jobId: string, url: string) => {
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId ? { ...j, applied_status: true, application_status: "applied" } : j
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

  const [sortBy, setSortBy] = React.useState<"match" | "recent" | "salary">("match")
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid")

  const filteredJobs = React.useMemo(() => {
    return jobs.filter((job) => {
      const matchesPlatform = selectedPlatforms.includes(job.platform as Platform)
      if (!matchesPlatform) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        (job.location && job.location.toLowerCase().includes(q)) ||
        (job.description && job.description.toLowerCase().includes(q))
      )
    })
  }, [jobs, selectedPlatforms, searchQuery])

  const sortedJobs = React.useMemo(() => {
    const copy = [...filteredJobs]
    if (sortBy === "match") return copy.sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0))
    if (sortBy === "recent") return copy.sort((a, b) => new Date(b.fetched_at ?? 0).getTime() - new Date(a.fetched_at ?? 0).getTime())
    if (sortBy === "salary") {
      const toNum = (s: string | null | undefined) => {
        if (!s) return 0
        const m = s.match(/\d[\d,]*/)
        return m ? parseInt(m[0].replace(/,/g, ""), 10) : 0
      }
      return copy.sort((a, b) => toNum(b.salary) - toNum(a.salary))
    }
    return copy
  }, [filteredJobs, sortBy])

  return (
    <main className="flex flex-1 flex-col gap-6 bg-muted/20 p-6 sm:p-8">
      {/* Welcome Banner */}
      <WelcomeBanner
        userName={fullName}
        jobCount={filteredJobs.length}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />

      {isCached && !isLoading && (
        <div className="-mt-2 flex items-center justify-between rounded-xl bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground border border-border/40">
          <span>Showing cached results from the last 6 hours</span>
          <button
            onClick={handleRefresh}
            className="font-bold text-primary hover:underline"
          >
            Refresh now
          </button>
        </div>
      )}

      {/* Main Grid: Left (Platforms + Jobs) | Right (Completeness + Activity) */}
      {!error && (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          {/* Left Column: Platforms + Job Matches */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            <PlatformSelector
              selected={selectedPlatforms}
              onToggle={handleTogglePlatform}
              loading={isLoading}
            />

            {/* Job list */}
            {isLoading ? (
              <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <JobCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60">
                  <HugeiconsIcon
                    icon={FileSearchIcon}
                    strokeWidth={2}
                    className="size-6 text-muted-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold">No jobs found</h3>
                  <p className="max-w-sm text-xs font-medium text-muted-foreground">
                    {selectedPlatforms.length === 0
                      ? "Select at least one platform above to start searching for jobs matching your profile."
                      : "No matching jobs found. Try selecting different platforms or refreshing."}
                  </p>
                </div>
                {selectedPlatforms.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    className="gap-2 rounded-xl"
                  >
                    <HugeiconsIcon
                      icon={RefreshIcon}
                      strokeWidth={2}
                      className="size-4"
                    />
                    Refresh
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* ── Toolbar: Title + Search + Sort + View ──────────────── */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {/* Title */}
                  <h3 className="shrink-0 text-base font-bold tracking-tight text-foreground flex items-center">
                    Top Job Matches
                    <span className="ml-2.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                      {sortedJobs.length} jobs
                    </span>
                  </h3>

                  <div className="ml-auto flex items-center gap-2 flex-wrap">
                    {/* Search */}
                    <div className="relative">
                      <HugeiconsIcon
                        icon={SearchIcon}
                        strokeWidth={2}
                        className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                      <Input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search..."
                        className="h-8 w-40 rounded-xl border-border/60 bg-background/80 pl-8 pr-3 text-xs shadow-2xs transition-all focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary"
                      />
                    </div>

                    {/* Sort dropdown */}
                    <div className="relative flex items-center">
                      <HugeiconsIcon
                        icon={SortingAZ01Icon}
                        strokeWidth={2}
                        className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none"
                      />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        className="h-8 appearance-none rounded-xl border border-border/60 bg-background/80 pl-7 pr-6 text-xs font-medium text-foreground shadow-2xs cursor-pointer focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                      >
                        <option value="match">Best match</option>
                        <option value="recent">Most recent</option>
                        <option value="salary">Highest salary</option>
                      </select>
                    </div>

                    {/* View toggle */}
                    <div className="flex items-center rounded-xl border border-border/60 bg-background/80 p-0.5 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setViewMode("grid")}
                        className={cn(
                          "flex size-7 items-center justify-center rounded-lg transition-all",
                          viewMode === "grid"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        aria-label="Grid view"
                      >
                        <HugeiconsIcon icon={LayoutGridIcon} strokeWidth={2} className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("list")}
                        className={cn(
                          "flex size-7 items-center justify-center rounded-lg transition-all",
                          viewMode === "list"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        aria-label="List view"
                      >
                        <HugeiconsIcon icon={ListViewIcon} strokeWidth={2} className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Job cards ────────────────────────────────────────────── */}
                <div className={cn(
                  "gap-4",
                  viewMode === "grid"
                    ? "grid grid-cols-1 sm:grid-cols-2"
                    : "flex flex-col"
                )}>
                  {sortedJobs.map((job) => (
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
                      savedStatus={job.saved_status ?? false}
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
              </div>
            )}
          </div>

          {/* Right Sidebar: Profile Completeness + Recent Activity */}
          <div className="flex flex-col gap-6 lg:col-span-1">
            <ProfileCompletenessCard data={parsedProfile} />
            <div className="lg:sticky lg:top-6">
              <RecentActivity activities={activities} />
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10">
            <HugeiconsIcon
              icon={AlertCircleIcon}
              strokeWidth={2}
              className="size-6 text-destructive"
            />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold">Failed to load jobs</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="gap-2 rounded-xl"
          >
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} className="size-4" />
            Try again
          </Button>
        </div>
      )}
    </main>
  )
}
