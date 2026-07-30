"use client"

import { usePathname } from "next/navigation"

import { SignOutButton } from "@/components/auth/sign-out-button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

const pageTitles: Record<string, string> = {
  "/dashboard/jobs": "Job Discovery",
  "/dashboard/resume": "Resume",
  "/dashboard/profile": "Profile",
  "/dashboard/application-status": "Applications",
  "/dashboard/billing": "Billing",
  "/dashboard/settings": "Settings",
}

function getPageTitle(pathname: string) {
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname === path || pathname.startsWith(`${path}/`)) return title
  }
  return "Dashboard"
}

interface DashboardHeaderProps {
  fullName: string
  email: string
  initials: string
}

export function DashboardHeader({
  fullName,
  email,
  initials,
}: DashboardHeaderProps) {
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-border/50 bg-background/75 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3">
        <SidebarTrigger
          className="size-9 rounded-xl ring-1 ring-foreground/[0.06] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-muted/60"
        />
        <div className="hidden h-6 w-px bg-border/60 sm:block" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">{pageTitle}</p>
          <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
            JobBuddy AI
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-2.5 rounded-full bg-muted/50 py-1 pl-1 pr-3 ring-1 ring-foreground/[0.05] sm:flex">
          <Avatar size="sm">
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-left">
            <p className="truncate text-xs font-medium">{fullName}</p>
            <p className="truncate text-[10px] text-muted-foreground">{email}</p>
          </div>
        </div>
        <SignOutButton />
      </div>
    </header>
  )
}
