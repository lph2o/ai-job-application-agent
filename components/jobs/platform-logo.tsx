import { cn } from "@/lib/utils"
import { getPlatform, type Platform } from "@/lib/jobs/schema"

const sizeStyles = {
  xs: { container: "size-4 rounded-sm p-0.5", label: "text-xs" },
  sm: { container: "size-7 rounded-md p-1", label: "text-xs" },
  md: { container: "size-10 rounded-lg p-1.5", label: "text-sm" },
  lg: { container: "size-14 rounded-xl p-2", label: "text-sm" },
} as const

interface PlatformLogoProps {
  platform: Platform | string
  size?: keyof typeof sizeStyles
  showLabel?: boolean
  className?: string
  labelClassName?: string
}

export function PlatformLogo({
  platform,
  size = "md",
  showLabel = false,
  className,
  labelClassName,
}: PlatformLogoProps) {
  const meta = getPlatform(platform)
  if (!meta) return null

  const styles = sizeStyles[size]

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative shrink-0 overflow-hidden bg-white ring-1 ring-black/5 dark:bg-white/95",
          styles.container
        )}
      >
        <img
          src={meta.logo}
          alt={`${meta.label} logo`}
          className="size-full object-contain"
        />
      </div>
      {showLabel && (
        <span className={cn("font-medium", styles.label, labelClassName)}>
          {meta.label}
        </span>
      )}
    </div>
  )
}
