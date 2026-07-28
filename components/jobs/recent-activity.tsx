"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Clock01Icon,
  Bookmark01Icon,
  CheckmarkCircle02Icon,
  SearchIcon,
} from "@hugeicons/core-free-icons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlatformLogo } from "@/components/jobs/platform-logo"
import { getPlatform } from "@/lib/jobs/schema"
import { cn } from "@/lib/utils"

interface Activity {
  id: string
  type: "saved" | "applied" | "searched"
  title: string
  company?: string
  platform?: string
  timestamp: string
}

interface RecentActivityProps {
  activities: Activity[]
  className?: string
}

const activityIcons: Record<Activity["type"], React.ReactNode> = {
  saved: <HugeiconsIcon icon={Bookmark01Icon} strokeWidth={2} className="size-4 text-primary" />,
  applied: <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4 text-emerald-500" />,
  searched: <HugeiconsIcon icon={SearchIcon} strokeWidth={2} className="size-4 text-blue-500" />,
}

const activityLabels: Record<Activity["type"], string> = {
  saved: "Saved",
  applied: "Applied",
  searched: "Searched",
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return `${diffDays}d ago`
}

export function RecentActivity({ activities, className }: RecentActivityProps) {
  return (
    <Card className={cn("h-fit", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-4 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">No recent activity</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your interactions with jobs will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50">
                  {activityIcons[activity.type]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {activityLabels[activity.type]}{" "}
                    {activity.title}
                    {activity.company && (
                      <span className="text-muted-foreground">
                        {" "}
                        at {activity.company}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{timeAgo(activity.timestamp)}</span>
                    {activity.platform && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <PlatformLogo platform={activity.platform} size="xs" />
                          {getPlatform(activity.platform)?.label ?? activity.platform}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
