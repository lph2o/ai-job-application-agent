import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { createClient } from "@/lib/supabase/server"
import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog"

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded")
    .eq("id", user.sub)
    .single()

  const needsOnboarding = !profile?.onboarded

  return (
    <SidebarProvider defaultOpen={defaultOpen ?? true}>
      <AppSidebar
        userName={fullName}
        userEmail={email}
        userInitials={initials}
      />
      <SidebarInset className="bg-muted/20">
        <DashboardHeader
          fullName={fullName}
          email={email}
          initials={initials}
        />
        {children}
        {needsOnboarding && <OnboardingDialog open={true} />}
      </SidebarInset>
    </SidebarProvider>
  )
}
