import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { SignOutButton } from "@/components/auth/sign-out-button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (!user?.sub) {
    redirect("/sign-in?next=/dashboard")
  }

  const email = (user.email as string | undefined) ?? "User"
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    email.split("@")[0]
  const initials = fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const cookieStore = await cookies()
  const defaultOpen =
    cookieStore.get("sidebar_state")?.value === "true" ? true : undefined

  return (
    <SidebarProvider defaultOpen={defaultOpen ?? true}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center justify-between border-b bg-background px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <span className="text-sm font-medium">JobBuddy AI</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 sm:flex">
              <Avatar size="sm">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">{email}</span>
            </div>
            <SignOutButton />
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
