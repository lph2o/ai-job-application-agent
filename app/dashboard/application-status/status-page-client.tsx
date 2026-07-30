"use client"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  Loading02Icon,
  SparklesIcon,
  RefreshIcon,
  SearchIcon,
  ViewIcon,
  Building01Icon,
  Location01Icon,
  Clock01Icon,
  ArrowUpRightIcon,
  PlayIcon,
  Cancel01Icon,
  FilterIcon,
  Briefcase02Icon,
  Activity02Icon,
  Robot01Icon,
  UserQuestionIcon,
  FileQuestionMarkIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { PlatformLogo } from "@/components/jobs/platform-logo"
import { MissingFieldsDialog } from "@/components/jobs/missing-fields-dialog"
import { UnknownFieldsDialog } from "@/components/jobs/unknown-fields-dialog"
import { fetchAppliedJobs, startAutoApplyJob, resumeAfterHumanVerification } from "@/app/actions/jobs"
import { cn } from "@/lib/utils"
import { toast } from "@/components/ui/toast"

export interface ApplicationJob {
  id: string
  title: string
  company: string
  company_logo?: string | null
  location?: string | null
  salary?: string | null
  job_type?: string | null
  platform: string
  job_url: string
  applied_status: boolean
  application_status?: string | null
  missing_fields?: string[] | null
  detected_fields?: Array<{ name: string; label: string; type: string; required: boolean }> | null
  browserbase_session_id?: string | null
  browserbase_debug_url?: string | null
  unknown_form_fields?: Array<{ label: string; name: string; type: string }> | null
  unknown_field_answers?: Record<string, string> | null
  application_error?: string | null
  application_screenshot_url?: string | null
  application_final_url?: string | null
  application_final_title?: string | null
  created_at: string
  fetched_at?: string
}

interface StatusPageClientProps {
  initialJobs: ApplicationJob[]
}

type FilterTab =
  | "all"
  | "applied"
  | "processing"
  | "missing"
  | "unknown"
  | "human"
  | "failed"
  | "uncertain"

const STATUS_CONFIG: Record<
  string,
  {
    label: string
    color: string
    bg: string
    border: string
    text: string
    ring: string
    icon: typeof CheckmarkCircle02Icon
  }
> = {
  applied: {
    label: "Applied",
    color: "emerald",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500/30",
    icon: CheckmarkCircle02Icon,
  },
  detecting_fields: {
    label: "Detecting Form Fields",
    color: "amber",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500/30",
    icon: Loading02Icon,
  },
  applying: {
    label: "Applying via AI Agent",
    color: "blue",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-700 dark:text-blue-300",
    ring: "ring-blue-500/30",
    icon: SparklesIcon,
  },
  missing_profile_info: {
    label: "Missing Profile Info",
    color: "amber",
    bg: "bg-amber-500/10",
    border: "border-amber-500/40",
    text: "text-amber-800 dark:text-amber-200",
    ring: "ring-amber-500/40",
    icon: AlertCircleIcon,
  },
  unknown_form_fields: {
    label: "Unknown Form Fields",
    color: "rose",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-500/30",
    icon: FileQuestionMarkIcon,
  },
  needs_human_verification: {
    label: "Needs Human Help",
    color: "primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    text: "text-primary",
    ring: "ring-primary/30",
    icon: UserQuestionIcon,
  },
  failed: {
    label: "Failed",
    color: "rose",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-500/30",
    icon: Cancel01Icon,
  },
  uncertain: {
    label: "Uncertain",
    color: "amber",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500/30",
    icon: AlertCircleIcon,
  },
}

export function StatusPageClient({ initialJobs }: StatusPageClientProps) {
  const [jobs, setJobs] = React.useState<ApplicationJob[]>(initialJobs)
  const [activeTab, setActiveTab] = React.useState<FilterTab>("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [retryingId, setRetryingId] = React.useState<string | null>(null)
  const [selectedMissingJob, setSelectedMissingJob] = React.useState<ApplicationJob | null>(null)
  const [selectedUnknownFieldsJob, setSelectedUnknownFieldsJob] = React.useState<ApplicationJob | null>(null)
  const [continuingId, setContinuingId] = React.useState<string | null>(null)

  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true)
    try {
      const res = await fetchAppliedJobs()
      if (res.data) {
        setJobs(res.data as ApplicationJob[])
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  // Auto-refresh every 4 seconds if there are jobs in active processing state
  React.useEffect(() => {
    const hasActiveProcessing = jobs.some(
      (j) => j.application_status === "detecting_fields" || j.application_status === "applying"
    )

    if (!hasActiveProcessing) return

    const timer = setInterval(() => {
      handleRefresh()
    }, 4000)

    return () => clearInterval(timer)
  }, [jobs, handleRefresh])

  const handleRetryAuto = async (jobId: string) => {
    setRetryingId(jobId)
    setJobs((prev) =>
      prev.map((j) =>
        j.id === jobId ? { ...j, application_status: "detecting_fields", application_error: null } : j
      )
    )
    try {
      await startAutoApplyJob(jobId)
    } finally {
      setRetryingId(null)
      handleRefresh()
    }
  }

  // Calculate summary counts
  const stats = React.useMemo(() => {
    const total = jobs.length
    const applied = jobs.filter((j) => j.applied_status || j.application_status === "applied").length
    const processing = jobs.filter(
      (j) => j.application_status === "detecting_fields" || j.application_status === "applying"
    ).length
    const missing = jobs.filter((j) => j.application_status === "missing_profile_info").length
    const unknownFields = jobs.filter((j) => j.application_status === "unknown_form_fields").length
    const failed = jobs.filter((j) => j.application_status === "failed").length
    const needsHuman = jobs.filter((j) => j.application_status === "needs_human_verification").length
    const uncertain = jobs.filter((j) => j.application_status === "uncertain").length

    return { total, applied, processing, missing, unknownFields, failed, needsHuman, uncertain }
  }, [jobs])

  // Filter jobs based on active tab and search query
  const filteredJobs = React.useMemo(() => {
    return jobs.filter((job) => {
      switch (activeTab) {
        case "applied":
          if (!job.applied_status && job.application_status !== "applied") return false
          break
        case "processing":
          if (job.application_status !== "detecting_fields" && job.application_status !== "applying") return false
          break
        case "human":
          if (job.application_status !== "needs_human_verification") return false
          break
        case "missing":
          if (job.application_status !== "missing_profile_info") return false
          break
        case "unknown":
          if (job.application_status !== "unknown_form_fields") return false
          break
        case "failed":
          if (job.application_status !== "failed") return false
          break
        case "uncertain":
          if (job.application_status !== "uncertain") return false
          break
      }

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        job.platform.toLowerCase().includes(q)
      )
    })
  }, [jobs, activeTab, searchQuery])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  return (
    <main className="flex flex-1 flex-col gap-8 bg-muted/20 p-4 pt-6 sm:p-6 sm:pt-8 lg:p-8 lg:pt-10">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        {/* Header section */}
        <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-gradient-to-br from-card/90 to-card/60 p-6 shadow-xl backdrop-blur-md sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/60 via-primary/40 to-primary/20" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-primary ring-1 ring-inset ring-primary/20">
                <HugeiconsIcon icon={Activity02Icon} strokeWidth={2.5} className="size-3" />
                Live Monitor
              </div>
              <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                Application Status
              </h1>
              <p className="max-w-xl text-xs font-medium text-muted-foreground sm:text-sm">
                Track every stage of your AI-powered applications, from field detection to final submission.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="shrink-0 gap-2 self-start rounded-xl border-border/60 bg-card/80 shadow-sm transition-all hover:bg-muted sm:self-auto"
            >
              <HugeiconsIcon
                icon={RefreshIcon}
                strokeWidth={2}
                className={cn("size-4", isRefreshing && "animate-spin text-primary")}
              />
              {isRefreshing ? "Syncing..." : "Refresh Status"}
            </Button>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <KpiCard
            active={activeTab === "all"}
            onClick={() => setActiveTab("all")}
            icon={Briefcase02Icon}
            label="Total"
            count={stats.total}
            colorClass="text-foreground"
            borderClass="border-border/60 hover:border-border"
            activeClass="border-primary/50 bg-primary/5"
          />
          <KpiCard
            active={activeTab === "applied"}
            onClick={() => setActiveTab("applied")}
            icon={CheckmarkCircle02Icon}
            label="Applied"
            count={stats.applied}
            colorClass="text-emerald-600 dark:text-emerald-400"
            borderClass="border-emerald-500/30 hover:border-emerald-500/50"
            activeClass="border-emerald-500/50 bg-emerald-500/10"
          />
          <KpiCard
            active={activeTab === "processing"}
            onClick={() => setActiveTab("processing")}
            icon={Robot01Icon}
            label="In Progress"
            count={stats.processing}
            colorClass="text-blue-600 dark:text-blue-400"
            borderClass="border-blue-500/30 hover:border-blue-500/50"
            activeClass="border-blue-500/50 bg-blue-500/10"
            pulse={stats.processing > 0}
          />
          <KpiCard
            active={activeTab === "human"}
            onClick={() => setActiveTab("human")}
            icon={UserQuestionIcon}
            label="Needs Help"
            count={stats.needsHuman}
            colorClass="text-primary"
            borderClass="border-primary/30 hover:border-primary/50"
            activeClass="border-primary/50 bg-primary/10"
          />
          <KpiCard
            active={activeTab === "missing"}
            onClick={() => setActiveTab("missing")}
            icon={AlertCircleIcon}
            label="Missing Info"
            count={stats.missing}
            colorClass="text-amber-600 dark:text-amber-400"
            borderClass="border-amber-500/30 hover:border-amber-500/50"
            activeClass="border-amber-500/50 bg-amber-500/10"
          />
          <KpiCard
            active={activeTab === "unknown"}
            onClick={() => setActiveTab("unknown")}
            icon={FileQuestionMarkIcon}
            label="Unknown Fields"
            count={stats.unknownFields}
            colorClass="text-rose-600 dark:text-rose-400"
            borderClass="border-rose-500/30 hover:border-rose-500/50"
            activeClass="border-rose-500/50 bg-rose-500/10"
          />
          <KpiCard
            active={activeTab === "uncertain"}
            onClick={() => setActiveTab("uncertain")}
            icon={AlertCircleIcon}
            label="Uncertain"
            count={stats.uncertain}
            colorClass="text-amber-600 dark:text-amber-400"
            borderClass="border-amber-500/30 hover:border-amber-500/50"
            activeClass="border-amber-500/50 bg-amber-500/10"
          />
          <KpiCard
            active={activeTab === "failed"}
            onClick={() => setActiveTab("failed")}
            icon={Cancel01Icon}
            label="Failed"
            count={stats.failed}
            colorClass="text-rose-600 dark:text-rose-400"
            borderClass="border-rose-500/30 hover:border-rose-500/50"
            activeClass="border-rose-500/50 bg-rose-500/10"
          />
        </div>

        {/* Toolbar: Filters + Search */}
        <div className="sticky top-2 z-30 rounded-2xl border border-border/50 bg-card/90 p-2 shadow-sm backdrop-blur-md sm:p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/50 bg-muted/50 p-1.5">
              {(
                [
                  { key: "all", label: `All`, count: stats.total },
                  { key: "applied", label: `Applied`, count: stats.applied },
                  { key: "processing", label: `In Progress`, count: stats.processing },
                  { key: "human", label: `Needs Help`, count: stats.needsHuman },
                  { key: "missing", label: `Missing Info`, count: stats.missing },
                  { key: "failed", label: `Failed`, count: stats.failed },
                  { key: "uncertain", label: `Uncertain`, count: stats.uncertain },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as FilterTab)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all duration-200",
                    activeTab === tab.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {tab.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9px] font-extrabold",
                      activeTab === tab.key
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted-foreground/10 text-muted-foreground"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-auto">
              <HugeiconsIcon
                icon={SearchIcon}
                strokeWidth={2}
                className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter applications..."
                className="h-9 w-full rounded-xl border-border/60 bg-card pl-9 pr-3 text-xs shadow-2xs transition-all focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <HugeiconsIcon icon={FilterIcon} strokeWidth={2} className="size-3.5" />
          Showing <span className="font-bold text-foreground">{filteredJobs.length}</span> of{" "}
          <span className="font-bold text-foreground">{jobs.length}</span> applications
        </div>

        {/* Applications List */}
        <div aria-live="polite" aria-atomic="false" className="sr-only">
          {filteredJobs.length} application{filteredJobs.length !== 1 ? "s" : ""} shown
        </div>

        {filteredJobs.length === 0 ? (
          <Card className="border-dashed border-border/80 bg-card/40 p-12 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-muted/60">
              <HugeiconsIcon icon={Building01Icon} strokeWidth={2} className="size-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-bold">No applications found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {jobs.length === 0
                ? "You haven't initiated any manual or automated job applications yet."
                : "No applications match your selected filter or search criteria."}
            </p>
            {jobs.length === 0 && (
              <Link href="/dashboard/jobs" className="mt-5 inline-block">
                <Button size="sm" className="gap-2 rounded-xl font-bold">
                  Find Jobs to Apply
                  <HugeiconsIcon icon={ArrowUpRightIcon} strokeWidth={2.5} className="size-4" />
                </Button>
              </Link>
            )}
          </Card>
        ) : (
          <div className="space-y-5">
            {filteredJobs.map((job) => {
              const isCompleted = job.applied_status || job.application_status === "applied"
              const isDetecting = job.application_status === "detecting_fields"
              const isApplying = job.application_status === "applying"
              const isMissingInfo = job.application_status === "missing_profile_info"
              const isUnknownFormFields = job.application_status === "unknown_form_fields"
              const isNeedsHuman = job.application_status === "needs_human_verification"
              const isUncertain = job.application_status === "uncertain"
              const isFailed = job.application_status === "failed"

              const statusKey = isCompleted ? "applied" : (job.application_status ?? "idle")
              const statusConfig = STATUS_CONFIG[statusKey] ?? {
                label: "Idle",
                color: "muted",
                bg: "bg-muted/50",
                border: "border-border/50",
                text: "text-muted-foreground",
                ring: "ring-muted/30",
                icon: Activity02Icon,
              }

              return (
                <Card
                  key={job.id}
                  className={cn(
                    "relative overflow-hidden border border-border/60 bg-card/80 transition-all duration-200 hover:shadow-lg",
                    statusConfig.border
                  )}
                >
                  {/* Status accent border */}
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 w-[3px] transition-colors duration-300",
                      isCompleted && "bg-emerald-500",
                      isFailed && "bg-rose-500",
                      isUnknownFormFields && "bg-rose-500",
                      isNeedsHuman && "bg-primary",
                      isMissingInfo && "bg-amber-500",
                      isUncertain && "bg-amber-500",
                      isApplying && "bg-blue-500",
                      isDetecting && "bg-amber-500"
                    )}
                  />

                  <CardContent className="space-y-5 p-5 pl-6">
                    {/* Top row: company / title / status */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3.5">
                        <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-muted/80 to-muted ring-1 ring-border/50 shadow-inner">
                          {job.company_logo ? (
                            <img src={job.company_logo} alt={job.company} className="size-full object-cover" />
                          ) : (
                            <span className="text-xs font-extrabold uppercase text-primary">
                              {job.company.substring(0, 2)}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-foreground sm:text-lg">{job.title}</h3>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                                statusConfig.bg,
                                statusConfig.text,
                                statusConfig.ring
                              )}
                            >
                              <HugeiconsIcon
                                icon={statusConfig.icon}
                                strokeWidth={2.5}
                                className={cn("size-3", (isDetecting || isApplying) && "animate-spin")}
                              />
                              {statusConfig.label}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-muted-foreground">{job.company}</p>

                          <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-muted-foreground">
                            <PlatformLogo platform={job.platform} size="xs" showLabel />
                            {job.location && (
                              <span className="inline-flex items-center gap-1">
                                <HugeiconsIcon icon={Location01Icon} strokeWidth={2} className="size-3" />
                                {job.location}
                              </span>
                            )}
                            {job.job_type && (
                              <span className="inline-flex items-center gap-1">
                                <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3" />
                                {job.job_type}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                              <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3" />
                              {formatDate(job.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {(job.browserbase_debug_url || job.browserbase_session_id) && (
                          <a
                            href={
                              job.browserbase_debug_url ||
                              `https://app.steel.dev/sessions/${job.browserbase_session_id}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                          >
                            <HugeiconsIcon icon={ViewIcon} strokeWidth={2.5} className="size-3.5" />
                            Debug Recording
                          </a>
                        )}
                        <a
                          href={job.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex size-8 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          title="Open Official Job URL"
                        >
                          <HugeiconsIcon icon={ArrowUpRightIcon} strokeWidth={2} className="size-4" />
                        </a>
                      </div>
                    </div>

                    {/* Status-specific alert boxes */}
                    {isNeedsHuman && (
                      <AlertBox variant="primary" icon={UserQuestionIcon} title="Human Verification Required">
                        <p className="text-xs opacity-90">
                          {job.application_error ||
                            "A CAPTCHA or security check is blocking the bot. Open the live session to solve it manually."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(job.browserbase_debug_url || job.browserbase_session_id) && (
                            <a
                              href={
                                job.browserbase_debug_url ||
                                `https://app.steel.dev/sessions/${job.browserbase_session_id}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
                            >
                              <HugeiconsIcon icon={ViewIcon} strokeWidth={2.5} className="size-3.5" />
                              View Live Session
                            </a>
                          )}
                          <Button
                            size="sm"
                            onClick={async () => {
                              setContinuingId(job.id)
                              const result = await resumeAfterHumanVerification(job.id)
                              setContinuingId(null)
                              if (result.error) {
                                toast.add({ type: "error", title: "Continuation failed", description: result.error })
                              } else {
                                handleRefresh()
                              }
                            }}
                            disabled={continuingId === job.id}
                            className="gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-xs transition-colors hover:bg-emerald-700"
                          >
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2.5} className="size-3.5" />
                            Continue After Solving
                          </Button>
                        </div>
                      </AlertBox>
                    )}

                    {isUnknownFormFields && (
                      <AlertBox variant="rose" icon={FileQuestionMarkIcon} title="Unknown Required Fields Detected">
                        <p className="text-xs opacity-90">
                          The bot found <span className="font-bold">{job.unknown_form_fields?.length || 0}</span>{" "}
                          unknown required field(s):{" "}
                          <span className="font-semibold">
                            {job.unknown_form_fields?.map((f) => f.label).join(", ") || "Unknown"}
                          </span>
                          . Fill them to retry.
                        </p>
                        <div className="mt-3">
                          <Button
                            size="sm"
                            onClick={() => setSelectedUnknownFieldsJob(job)}
                            className="gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-xs transition-colors hover:bg-rose-700"
                          >
                            <HugeiconsIcon icon={SparklesIcon} strokeWidth={2.5} className="size-3.5" />
                            Fill Unknown Fields
                          </Button>
                        </div>
                      </AlertBox>
                    )}

                    {isMissingInfo && (
                      <AlertBox variant="amber" icon={AlertCircleIcon} title="Missing Required Profile Information">
                        <p className="text-xs opacity-90">
                          Required fields: <span className="font-semibold">{job.missing_fields?.join(", ") || "Phone, Resume"}</span>. Complete them to continue the automated application.
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => setSelectedMissingJob(job)}
                            className="gap-1.5 rounded-xl bg-amber-600 px-3.5 py-1.5 text-[11px] font-bold text-white shadow-xs transition-colors hover:bg-amber-700"
                          >
                            <HugeiconsIcon icon={SparklesIcon} strokeWidth={2.5} className="size-3.5" />
                            Fill Missing Data
                          </Button>
                          <Link
                            href={`/dashboard/profile?missing=${encodeURIComponent(
                              (job.missing_fields || []).join(",")
                            )}`}
                            className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:underline"
                          >
                            Edit Profile
                          </Link>
                        </div>
                      </AlertBox>
                    )}

                    {isUncertain && (
                      <AlertBox variant="amber" icon={AlertCircleIcon} title="Submission Uncertain">
                        <p className="font-mono text-[11px] break-words">
                          {job.application_error ||
                            "The bot could not confirm whether the application was submitted."}
                        </p>
                        {job.application_final_url && (
                          <p className="mt-2 text-[10px] opacity-80">
                            Final URL:{" "}
                            <a
                              href={job.application_final_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-amber-700 dark:hover:text-amber-300"
                            >
                              {job.application_final_url}
                            </a>
                          </p>
                        )}
                        {job.application_screenshot_url && (
                          <div className="mt-3 space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                              Final Screenshot
                            </span>
                            <a href={job.application_screenshot_url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={job.application_screenshot_url}
                                alt="Final application state"
                                className="max-h-40 rounded-lg border border-amber-500/30 object-contain"
                              />
                            </a>
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(job.browserbase_debug_url || job.browserbase_session_id) && (
                            <a
                              href={
                                job.browserbase_debug_url ||
                                `https://app.steel.dev/sessions/${job.browserbase_session_id}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs transition-colors hover:bg-amber-700"
                            >
                              <HugeiconsIcon icon={ViewIcon} strokeWidth={2.5} className="size-3.5" />
                              View Recording
                            </a>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleRetryAuto(job.id)}
                            disabled={retryingId === job.id}
                            className="shrink-0 gap-1.5 rounded-xl bg-amber-600 font-bold text-white hover:bg-amber-700"
                          >
                            <HugeiconsIcon icon={PlayIcon} strokeWidth={2.5} className="size-3.5" />
                            Retry Auto-Apply
                          </Button>
                        </div>
                      </AlertBox>
                    )}

                    {isFailed && (
                      <AlertBox variant="rose" icon={Cancel01Icon} title="Application Failed">
                        <p className="font-mono text-[11px] break-words">
                          {job.application_error || "Automated form submission failed."}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedMissingJob(job)}
                            className="shrink-0 gap-1.5 rounded-xl border-rose-500/40 font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-500/10"
                          >
                            <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2.5} className="size-3.5" />
                            Fill / Fix Data
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleRetryAuto(job.id)}
                            disabled={retryingId === job.id}
                            className="shrink-0 gap-1.5 rounded-xl bg-rose-600 font-bold text-white hover:bg-rose-700"
                          >
                            <HugeiconsIcon icon={PlayIcon} strokeWidth={2.5} className="size-3.5" />
                            Retry Auto-Apply
                          </Button>
                        </div>
                      </AlertBox>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {selectedMissingJob && (
        <MissingFieldsDialog
          isOpen={!!selectedMissingJob}
          onClose={() => setSelectedMissingJob(null)}
          jobId={selectedMissingJob.id}
          jobTitle={selectedMissingJob.title}
          company={selectedMissingJob.company}
          missingFields={selectedMissingJob.missing_fields || []}
          onSuccess={() => handleRefresh()}
        />
      )}

      {selectedUnknownFieldsJob && (
        <UnknownFieldsDialog
          isOpen={!!selectedUnknownFieldsJob}
          onClose={() => setSelectedUnknownFieldsJob(null)}
          jobId={selectedUnknownFieldsJob.id}
          jobTitle={selectedUnknownFieldsJob.title}
          company={selectedUnknownFieldsJob.company}
          unknownFields={selectedUnknownFieldsJob.unknown_form_fields || []}
          onSuccess={() => handleRefresh()}
        />
      )}
    </main>
  )
}

function KpiCard({
  active,
  onClick,
  icon,
  label,
  count,
  colorClass,
  borderClass,
  activeClass,
  pulse,
}: {
  active: boolean
  onClick: () => void
  icon: typeof CheckmarkCircle02Icon
  label: string
  count: number
  colorClass: string
  borderClass: string
  activeClass: string
  pulse?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-start rounded-2xl border p-4 text-left transition-all duration-200",
        "bg-card/60 hover:bg-card hover:shadow-sm",
        active ? activeClass : borderClass
      )}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-xl bg-muted/70 text-foreground/80 transition-colors group-hover:bg-muted",
            active && "bg-primary/10 text-primary"
          )}
        >
          <HugeiconsIcon icon={icon} strokeWidth={2} className={cn("size-4", active && colorClass)} />
        </span>
        {pulse && (
          <span className="flex size-2.5 rounded-full bg-blue-500 animate-ping" />
        )}
      </div>
      <span className={cn("mt-3 text-2xl font-black", colorClass)}>{count}</span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
    </button>
  )
}

function AlertBox({
  variant,
  icon,
  title,
  children,
}: {
  variant: "primary" | "amber" | "rose"
  icon: typeof AlertCircleIcon
  title: string
  children: React.ReactNode
}) {
  const variantClasses = {
    primary: {
      border: "border-primary/40",
      bg: "bg-primary/10",
      iconBg: "bg-primary/20",
      text: "text-primary",
    },
    amber: {
      border: "border-amber-500/40",
      bg: "bg-amber-500/10",
      iconBg: "bg-amber-500/20",
      text: "text-amber-700 dark:text-amber-200",
    },
    rose: {
      border: "border-rose-500/40",
      bg: "bg-rose-500/10",
      iconBg: "bg-rose-500/20",
      text: "text-rose-700 dark:text-rose-200",
    },
  }

  const classes = variantClasses[variant]

  return (
    <div className={cn("rounded-2xl border p-4", classes.border, classes.bg)}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-xl",
            classes.iconBg,
            classes.text
          )}
        >
          <HugeiconsIcon icon={icon} strokeWidth={2.5} className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className={cn("text-xs font-extrabold", classes.text)}>{title}</h4>
          <div className="mt-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
