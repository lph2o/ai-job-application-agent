import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { ProfileForm } from "./profile-form"

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub

  if (!userId) {
    redirect("/sign-in?next=/dashboard/profile")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("parsed_data")
    .eq("id", userId)
    .single()

  return (
    <main className="flex flex-1 flex-col gap-6 overflow-auto bg-muted/30 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Review and edit the information extracted from your resume.
        </p>
      </div>

      <ProfileForm initialData={profile?.parsed_data} />
    </main>
  )
}
