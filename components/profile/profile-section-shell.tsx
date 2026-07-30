import { cn } from "@/lib/utils"

interface ProfileSectionShellProps {
  children: React.ReactNode
  className?: string
}

export function ProfileSectionShell({
  children,
  className,
}: ProfileSectionShellProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[1.25rem] bg-muted/40 p-1.5 ring-1 ring-foreground/[0.06] dark:ring-white/[0.08]",
        className
      )}
    >
      <div className="rounded-[calc(1.25rem-0.375rem)] bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-foreground/[0.04] dark:ring-white/[0.06]">
        {children}
      </div>
    </div>
  )
}
