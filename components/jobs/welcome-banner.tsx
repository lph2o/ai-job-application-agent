"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon, RefreshIcon } from "@hugeicons/core-free-icons"

interface WelcomeBannerProps {
  userName: string
  jobCount: number
  isRefreshing: boolean
  onRefresh: () => void
}

export function WelcomeBanner({
  userName,
  jobCount,
  isRefreshing,
  onRefresh,
}: WelcomeBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-primary/5 to-background/80 p-6 sm:p-7 shadow-sm backdrop-blur-xl dark:from-primary/10 dark:via-primary/5 dark:to-card/40">
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-primary ring-1 ring-primary/20 backdrop-blur-md">
            <HugeiconsIcon
              icon={SparklesIcon}
              strokeWidth={2.5}
              className="size-3.5 text-primary"
            />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              AI Job Search Engine
            </span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
            Welcome back, {userName} 👋
          </h2>
          <p className="text-sm font-medium text-muted-foreground/90">
            {jobCount > 0
              ? `We found ${jobCount} high-matching jobs tailored to your profile.`
              : "Select platforms to discover jobs matching your profile."}
          </p>
        </div>
        
        {jobCount > 0 && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-background/90 px-4 py-2.5 text-xs font-bold text-foreground shadow-sm ring-1 ring-border/60 backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-background hover:shadow-md hover:border-border active:scale-[0.97] disabled:opacity-60 dark:bg-card/80 dark:hover:bg-card"
          >
            {isRefreshing ? (
              <span className="flex items-center gap-2">
                <span className="size-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                Refreshing...
              </span>
            ) : (
              <>
                <HugeiconsIcon icon={RefreshIcon} strokeWidth={2.5} className="size-4 text-primary" />
                Refresh Jobs
              </>
            )}
          </button>
        )}
      </div>
      
      {/* Decorative gradient elements */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/15 blur-3xl dark:bg-primary/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 left-1/3 size-48 rounded-full bg-secondary/10 blur-3xl"
      />
    </div>
  )
}
