"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserIcon,
  WrenchIcon,
  BriefcaseIcon,
  GraduationCapIcon,
  FolderIcon,
  Certificate01Icon,
  LinkIcon,
} from "@hugeicons/core-free-icons"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CircularProgress } from "./circular-progress"
import {
  calculateProfileCompleteness,
  getProgressColor,
  getProgressBackgroundColor,
} from "@/lib/profile/completeness"
import type { ResumeProfile } from "@/lib/resume/schema"
import { cn } from "@/lib/utils"

interface ProfileCompletenessCardProps {
  data?: ResumeProfile | null
  className?: string
}

const sectionIcons: Record<string, React.ReactNode> = {
  personal: <HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-4" />,
  skills: <HugeiconsIcon icon={WrenchIcon} strokeWidth={2} className="size-4" />,
  workExperience: <HugeiconsIcon icon={BriefcaseIcon} strokeWidth={2} className="size-4" />,
  education: <HugeiconsIcon icon={GraduationCapIcon} strokeWidth={2} className="size-4" />,
  projects: <HugeiconsIcon icon={FolderIcon} strokeWidth={2} className="size-4" />,
  certifications: <HugeiconsIcon icon={Certificate01Icon} strokeWidth={2} className="size-4" />,
  links: <HugeiconsIcon icon={LinkIcon} strokeWidth={2} className="size-4" />,
}

export function ProfileCompletenessCard({
  data,
  className,
}: ProfileCompletenessCardProps) {
  const result = React.useMemo(() => calculateProfileCompleteness(data), [data])
  const colorClass = getProgressColor(result.percentage)
  const bgClass = getProgressBackgroundColor(result.percentage)

  return (
    <div className={cn("overflow-hidden rounded-2xl bg-muted/30 p-1.5 ring-1 ring-black/5 dark:ring-white/10", className)}>
      <Card className="h-fit rounded-xl border-0 bg-background shadow-sm ring-1 ring-black/5 dark:ring-white/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Profile Completeness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center justify-center gap-4 py-2">
          <CircularProgress
            value={result.percentage}
            size={140}
            strokeWidth={12}
            className={cn("rounded-full", bgClass)}
            fillClassName={cn(colorClass)}
            trackClassName="text-muted/30"
          >
            <div className="flex flex-col items-center">
              <span className={cn("text-3xl font-bold", colorClass)}>
                {result.percentage}%
              </span>
              <span className="text-sm text-muted-foreground">Complete</span>
            </div>
          </CircularProgress>
          <p className="text-center text-sm text-muted-foreground">
            {result.percentage === 100
              ? "Your profile is complete!"
              : "Fill in the remaining sections to improve your profile."}
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Sections
          </h4>
          <div className="space-y-2">
            {result.sections.map((section) => (
              <div
                key={section.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border">
                    {sectionIcons[section.key]}
                  </span>
                  <span className="truncate text-sm font-medium">
                    {section.label}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    getProgressColor(section.percentage)
                  )}
                >
                  {section.percentage}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      
      </Card>
    </div>
  )
}
