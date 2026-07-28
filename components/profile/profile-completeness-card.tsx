"use client"

import * as React from "react"
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserIcon,
  WrenchIcon,
  BriefcaseIcon,
  GraduationCapIcon,
  FolderIcon,
  Certificate01Icon,
  LinkIcon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CircularProgress } from "./circular-progress"
import {
  calculateProfileCompleteness,
  getProgressColor,
  getProgressBackgroundColor,
  getProgressIndicatorColor,
} from "@/lib/profile/completeness"
import type { ResumeProfile } from "@/lib/resume/schema"
import { cn } from "@/lib/utils"

interface ProfileCompletenessCardProps {
  data?: ResumeProfile | null
  className?: string
}

const sectionIcons: Record<string, React.ReactNode> = {
  personal: <HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-3.5" />,
  skills: <HugeiconsIcon icon={WrenchIcon} strokeWidth={2} className="size-3.5" />,
  workExperience: <HugeiconsIcon icon={BriefcaseIcon} strokeWidth={2} className="size-3.5" />,
  education: <HugeiconsIcon icon={GraduationCapIcon} strokeWidth={2} className="size-3.5" />,
  projects: <HugeiconsIcon icon={FolderIcon} strokeWidth={2} className="size-3.5" />,
  certifications: <HugeiconsIcon icon={Certificate01Icon} strokeWidth={2} className="size-3.5" />,
  links: <HugeiconsIcon icon={LinkIcon} strokeWidth={2} className="size-3.5" />,
}

export function ProfileCompletenessCard({
  data,
  className,
}: ProfileCompletenessCardProps) {
  const result = React.useMemo(() => calculateProfileCompleteness(data), [data])
  const colorClass = getProgressColor(result.percentage)
  const bgClass = getProgressBackgroundColor(result.percentage)
  const isComplete = result.percentage === 100

  return (
    <Card className={cn("h-fit", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              bgClass
            )}
          >
            {isComplete ? (
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                strokeWidth={2}
                className={cn("size-4", colorClass)}
              />
            ) : (
              <HugeiconsIcon
                icon={UserIcon}
                strokeWidth={2}
                className={cn("size-4", colorClass)}
              />
            )}
          </div>
          <div className="min-w-0">
            <CardTitle className="font-semibold">Profile Completeness</CardTitle>
            <CardDescription>
              {isComplete
                ? "Your profile is ready for job matching"
                : `${100 - result.percentage}% remaining to optimize matches`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex items-center gap-4 rounded-xl bg-muted/40 p-4 ring-1 ring-border/50">
          <CircularProgress
            value={result.percentage}
            size={96}
            strokeWidth={8}
            fillClassName="text-primary"
            trackClassName="text-muted/40"
          >
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black tabular-nums text-primary">
                {result.percentage}%
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Complete
              </span>
            </div>
          </CircularProgress>

          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isComplete
                ? "All sections are filled in. You're getting the best job matches."
                : "Complete missing sections to improve match accuracy and ranking."}
            </p>
            {!isComplete && (
              <Link
                href="/dashboard/profile"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
              >
                Complete profile
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5" />
              </Link>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {result.sections.map((section) => (
            <div key={section.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground">
                    {sectionIcons[section.key]}
                  </span>
                  <span className="truncate text-sm font-medium">
                    {section.label}
                  </span>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-xs font-semibold tabular-nums",
                    getProgressColor(section.percentage)
                  )}
                >
                  {section.percentage}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    getProgressIndicatorColor(section.percentage)
                  )}
                  style={{ width: `${section.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
