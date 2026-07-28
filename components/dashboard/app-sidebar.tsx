"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  BriefcaseIcon,
  ChartLineIcon,
  CoinsIcon,
  CreditCardIcon,
  File01Icon,
  GearsIcon,
  SparklesIcon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import * as React from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type NavItem = {
  title: string
  href: string
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]
  description?: string
}

const navigation: NavItem[] = [
  {
    title: "Jobs",
    href: "/dashboard/jobs",
    icon: BriefcaseIcon,
    description: "Discover & apply",
  },
  {
    title: "Resume",
    href: "/dashboard/resume",
    icon: File01Icon,
    description: "Upload & parse",
  },
  {
    title: "Profile",
    href: "/dashboard/profile",
    icon: UserIcon,
    description: "Your identity",
  },
  {
    title: "Applications",
    href: "/dashboard/application-status",
    icon: ChartLineIcon,
    description: "Track progress",
  },
]

const footerNavigation: NavItem[] = [
  { title: "Billing", href: "/dashboard/billing", icon: CreditCardIcon },
  { title: "Settings", href: "/dashboard/settings", icon: GearsIcon },
]

function AppLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_rgba(172,244,23,0.25)]",
        className
      )}
    >
      <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} className="size-4.5" />
    </div>
  )
}

function SidebarLogo() {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Link
      href="/dashboard/jobs"
      className="group flex items-center gap-3 rounded-xl px-2 py-2 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-sidebar-accent/50"
    >
      <AppLogo />
      <div className={cn("min-w-0 transition-opacity duration-200", isCollapsed && "sr-only opacity-0")}>
        <span className="block text-sm font-semibold tracking-tight">JobBuddy</span>
        <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          AI Agent
        </span>
      </div>
    </Link>
  )
}

function SidebarMenuLink({
  href,
  title,
  icon,
  description,
  isActive,
}: NavItem & { isActive: boolean }) {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={title}
        className={cn(
          "group/nav relative h-auto min-h-[44px] overflow-hidden rounded-xl px-3 py-2.5 transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
          "[&_svg]:size-[18px]",
          isActive
            ? "bg-[#ACF418]/15 text-foreground font-bold border border-[#ACF418]/40 shadow-xs dark:bg-[#ACF418]/20"
            : "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-foreground font-medium"
        )}
        render={
          <Link href={href} className="flex w-full items-center gap-3">
            {/* Active Pill Indicator on Left edge */}
            {isActive && (
              <div className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[#ACF418] shadow-[0_0_8px_#ACF418] animate-in fade-in-50 duration-200" />
            )}

            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                isActive
                  ? "bg-[#ACF418] text-black shadow-xs"
                  : "bg-muted/50 text-muted-foreground group-hover/nav:bg-muted group-hover/nav:text-foreground"
              )}
            >
              <HugeiconsIcon icon={icon} strokeWidth={isActive ? 2.5 : 2} className="size-4.5" />
            </span>

            <span className={cn("min-w-0 flex-1", isCollapsed && "sr-only")}>
              <span className="block truncate text-xs font-bold tracking-tight text-foreground">{title}</span>
              {description && !isCollapsed && (
                <span
                  className={cn(
                    "block truncate text-[10px] leading-tight",
                    isActive ? "text-foreground/80 font-semibold" : "text-muted-foreground/80 font-normal"
                  )}
                >
                  {description}
                </span>
              )}
            </span>
          </Link>
        }
      />
    </SidebarMenuItem>
  )
}

function CreditsSection({
  isCollapsed,
  credits = 120,
}: {
  isCollapsed: boolean
  credits?: number
}) {
  const maxCredits = 200
  const pct = Math.min(100, Math.round((credits / maxCredits) * 100))

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl bg-sidebar-accent/30 p-1 ring-1 ring-foreground/[0.06] dark:ring-white/[0.08]",
        isCollapsed && "p-1"
      )}
    >
      <div
        className={cn(
          "rounded-[calc(0.75rem-0.25rem)] bg-sidebar p-3",
          isCollapsed && "flex justify-center p-2"
        )}
      >
        <div className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
          <div className="relative flex size-10 shrink-0 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40" aria-hidden>
              <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/40" />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 100.53} 100.53`}
                className="text-primary transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
              />
            </svg>
            <HugeiconsIcon icon={CoinsIcon} strokeWidth={2} className="size-3.5 text-primary" />
          </div>
          <div className={cn("min-w-0 flex-1", isCollapsed && "sr-only")}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Credits
            </p>
            <p className="text-sm font-semibold tabular-nums">
              {credits}
              <span className="ml-1 text-xs font-normal text-muted-foreground">/ {maxCredits}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface AppSidebarProps {
  userName?: string
  userEmail?: string
  userInitials?: string
}

export function AppSidebar({
  userName = "User",
  userEmail,
  userInitials = "U",
}: AppSidebarProps) {
  const pathname = usePathname()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/50 bg-sidebar/50 backdrop-blur-xl [&_[data-slot=sidebar-inner]]:bg-sidebar/80 [&_[data-slot=sidebar-inner]]:backdrop-blur-xl"
    >
      <SidebarHeader className="border-b border-border/40 px-3 py-4">
        <SidebarLogo />
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2 py-4">
        <SidebarGroup className="px-0 py-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {navigation.map((item) => (
                <SidebarMenuLink
                  key={item.href}
                  {...item}
                  isActive={
                    pathname === item.href || pathname.startsWith(`${item.href}/`)
                  }
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mt-auto gap-3 border-t border-sidebar-border/40 px-2 py-4">
        <CreditsSection isCollapsed={isCollapsed} />

        <SidebarGroup className="px-0 py-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {footerNavigation.map((item) => (
                <SidebarMenuLink
                  key={item.href}
                  {...item}
                  isActive={
                    pathname === item.href || pathname.startsWith(`${item.href}/`)
                  }
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div
          className={cn(
            "overflow-hidden rounded-xl bg-sidebar-accent/30 p-1 ring-1 ring-foreground/[0.06] dark:ring-white/[0.08]",
            isCollapsed && "flex justify-center"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-[calc(0.75rem-0.25rem)] bg-sidebar p-2.5",
              isCollapsed && "justify-center p-2"
            )}
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className={cn("min-w-0 flex-1", isCollapsed && "sr-only")}>
              <p className="truncate text-sm font-medium">{userName}</p>
              {userEmail && (
                <p className="truncate text-[11px] text-muted-foreground">{userEmail}</p>
              )}
            </div>
          </div>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
