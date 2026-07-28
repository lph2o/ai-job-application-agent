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
  UserIcon,
} from "@hugeicons/core-free-icons"
import * as React from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

type NavItem = {
  title: string
  href: string
  icon: React.ComponentProps<typeof HugeiconsIcon>["icon"]
}

const navigation: NavItem[] = [
  { title: "Jobs", href: "/dashboard/jobs", icon: BriefcaseIcon },
  { title: "Resume", href: "/dashboard/resume", icon: File01Icon },
  { title: "Profile", href: "/dashboard/profile", icon: UserIcon },
  { title: "Application Status", href: "/dashboard/application-status", icon: ChartLineIcon },
]

const footerNavigation: NavItem[] = [
  { title: "Billing / Credits", href: "/dashboard/billing", icon: CreditCardIcon },
  { title: "Profile Settings", href: "/dashboard/settings", icon: GearsIcon },
]

function AppLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M8 12.5C8 11.1193 9.11929 10 10.5 10h11c1.3807 0 2.5 1.1193 2.5 2.5v7c0 1.3807-1.1193 2.5-2.5 2.5h-11C9.11929 22 8 20.8807 8 19.5v-7Z"
        fill="white"
      />
      <path
        d="M14.5 15.5L17 17.5L17 13.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SidebarLogo() {
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-3 px-2 py-2 text-foreground transition-opacity hover:opacity-80"
    >
      <AppLogo className="size-8 shrink-0" />
      <span
        className={cn(
          "text-base font-semibold tracking-tight transition-opacity duration-200",
          isCollapsed && "sr-only opacity-0"
        )}
      >
        JobBuddy AI
      </span>
    </Link>
  )
}

function SidebarMenuLink({
  href,
  title,
  icon,
  isActive,
}: NavItem & { isActive: boolean }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={title}
        className={cn(
          "relative h-11 text-sm transition-colors",
          "[&_svg]:size-5",
          isActive &&
            "bg-primary/10 font-semibold text-primary hover:bg-primary/15 hover:text-primary"
        )}
        render={
          <Link href={href} className="flex w-full items-center gap-3">
            <span
              className={cn(
                "absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary transition-opacity group-data-[collapsible=icon]:hidden",
                isActive ? "opacity-100" : "opacity-0"
              )}
              aria-hidden="true"
            />
            <HugeiconsIcon
              icon={icon}
              strokeWidth={2}
              className={cn(
                "size-5 shrink-0 transition-colors",
                isActive ? "text-primary" : "text-sidebar-foreground/70"
              )}
            />
            <span className="truncate">{title}</span>
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
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-primary/30 bg-primary/5 p-3 shadow-sm transition-all",
        isCollapsed && "px-2 py-3"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3",
          isCollapsed && "justify-center"
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HugeiconsIcon icon={CoinsIcon} strokeWidth={2} className="size-4" />
        </div>
        <div className={cn("min-w-0", isCollapsed && "sr-only")}>
          <p className="text-sm text-muted-foreground">Available credits</p>
          <p className="text-sm font-semibold text-foreground">
            {credits} credits
          </p>
        </div>
      </div>
    </div>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50 py-4">
        <SidebarLogo />
      </SidebarHeader>

      <SidebarContent className="py-5">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuLink
                  key={item.href}
                  {...item}
                  isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="mt-auto border-t border-sidebar-border/50 py-4">
        <SidebarGroup className="px-0 py-0">
          <SidebarGroupLabel className="text-sm font-semibold uppercase tracking-wider text-sidebar-foreground/60">
            Credits
          </SidebarGroupLabel>
          <CreditsSection isCollapsed={isCollapsed} />
        </SidebarGroup>

        <SidebarGroup className="px-0 py-0">
          <SidebarGroupContent>
            <SidebarMenu>
              {footerNavigation.map((item) => (
                <SidebarMenuLink
                  key={item.href}
                  {...item}
                  isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
