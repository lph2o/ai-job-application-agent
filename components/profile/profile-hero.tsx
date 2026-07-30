"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Location01Icon,
  Mail01Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"

import { CircularProgress } from "@/components/profile/circular-progress"
import {
  calculateProfileCompleteness,
  getProgressColor,
  getProgressBackgroundColor,
} from "@/lib/profile/completeness"
import type { ResumeProfile } from "@/lib/resume/schema"
import { cn } from "@/lib/utils"

interface ProfileHeroProps {
  data?: ResumeProfile | null
  className?: string
}

function getInitials(name?: string) {
  if (!name?.trim()) return "?"
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function ProfileHero({ data, className }: ProfileHeroProps) {
  const result = React.useMemo(() => calculateProfileCompleteness(data), [data])
  const colorClass = getProgressColor(result.percentage)
  const bgClass = getProgressBackgroundColor(result.percentage)
  const skills = data?.skills?.slice(0, 6) ?? []

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card/90 to-background p-6 sm:p-8 shadow-sm backdrop-blur-xl transition-all duration-300 hover:shadow-md",
        className
      )}
    >
      {/* Decorative Orbs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -bottom-20 size-64 rounded-full bg-secondary/10 blur-3xl"
      />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {/* Avatar / Initials */}
          <div className="relative shrink-0">
            <div className="rounded-2xl bg-gradient-to-br from-muted to-muted/50 p-1 shadow-inner ring-1 ring-border/60">
              <div
                className={cn(
                  "flex size-20 items-center justify-center rounded-[14px] text-2xl font-black tracking-tight sm:size-24 sm:text-3xl shadow-sm",
                  bgClass,
                  colorClass
                )}
              >
                {getInitials(data?.fullName || undefined)}
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-card">
              <HugeiconsIcon icon={SparklesIcon} strokeWidth={2.5} className="size-4" />
            </div>
          </div>

          {/* Details */}
          <div className="min-w-0 space-y-2.5">
            <div>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary ring-1 ring-primary/20">
                Professional Profile
              </span>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                {data?.fullName?.trim() || "Your Profile"}
              </h1>
              {data?.title?.trim() && (
                <p className="text-sm font-semibold text-muted-foreground/90">
                  {data.title}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
              {data?.location?.trim() && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1">
                  <HugeiconsIcon icon={Location01Icon} strokeWidth={2} className="size-3.5 text-primary" />
                  {data.location}
                </span>
              )}
              {data?.email?.trim() && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1">
                  <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="size-3.5 text-primary" />
                  {data.email}
                </span>
              )}
            </div>

            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-secondary/50 px-2.5 py-0.5 text-[11px] font-semibold text-foreground/90 ring-1 ring-border/50"
                  >
                    {skill}
                  </span>
                ))}
                {(data?.skills?.length ?? 0) > 6 && (
                  <span className="rounded-full bg-muted/60 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    +{(data?.skills?.length ?? 0) - 6} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
