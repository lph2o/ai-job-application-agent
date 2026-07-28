"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import { PLATFORMS, type Platform } from "@/lib/jobs/schema"
import { PlatformLogo } from "@/components/jobs/platform-logo"

interface PlatformSelectorProps {
  selected: Platform[]
  onToggle: (platform: Platform) => void
  loading?: boolean
  className?: string
}

const platformStyles: Record<
  Platform,
  { border: string; bg: string; ring: string }
> = {
  greenhouse: {
    border: "border-emerald-200/80 dark:border-emerald-800/60",
    bg: "bg-emerald-50/80 dark:bg-emerald-950/20 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/40",
    ring: "ring-emerald-500/30",
  },
  lever: {
    border: "border-blue-200/80 dark:border-blue-800/60",
    bg: "bg-blue-50/80 dark:bg-blue-950/20 hover:bg-blue-100/80 dark:hover:bg-blue-950/40",
    ring: "ring-blue-500/30",
  },
  workable: {
    border: "border-purple-200/80 dark:border-purple-800/60",
    bg: "bg-purple-50/80 dark:bg-purple-950/20 hover:bg-purple-100/80 dark:hover:bg-purple-950/40",
    ring: "ring-purple-500/30",
  },
  wellfound: {
    border: "border-orange-200/80 dark:border-orange-800/60",
    bg: "bg-orange-50/80 dark:bg-orange-950/20 hover:bg-orange-100/80 dark:hover:bg-orange-950/40",
    ring: "ring-orange-500/30",
  },
}

export function PlatformSelector({
  selected,
  onToggle,
  loading = false,
  className,
}: PlatformSelectorProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      {PLATFORMS.map((platform) => {
        const styles = platformStyles[platform.key]
        const isSelected = selected.includes(platform.key)

        return (
          <button
            key={platform.key}
            onClick={() => !loading && onToggle(platform.key)}
            disabled={loading}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]",
              isSelected
                ? cn(
                    "border-transparent bg-background shadow-md ring-2 ring-primary/80 dark:bg-card/90",
                    styles.ring
                  )
                : "border-border/60 bg-background/60 hover:border-border hover:bg-background hover:shadow-sm dark:bg-card/40 dark:hover:bg-card/70",
              loading && "cursor-wait opacity-60"
            )}
          >
            <div className="relative shrink-0">
              <PlatformLogo platform={platform.key} size="sm" className="transition-transform duration-300 group-hover:scale-105" />
              {isSelected && (
                <div className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm animate-in zoom-in-50 duration-200">
                  <HugeiconsIcon icon={Tick02Icon} strokeWidth={2.5} className="size-2.5" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="block truncate text-xs font-bold tracking-tight">
                  {platform.label}
                </span>
              </div>
              <span className="block truncate text-[10px] font-medium text-muted-foreground/80">
                {platform.domain}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
