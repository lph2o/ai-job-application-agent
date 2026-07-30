import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { ProfileForm } from "./profile-form"
import { ProfileHero } from "@/components/profile/profile-hero"
import { normalizeProfile, type ResumeProfile } from "@/lib/resume/schema"

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

  const parsedProfile = normalizeProfile(
    profile?.parsed_data as ResumeProfile | null
  )

  return (
    <main className="relative flex flex-1 flex-col gap-8 overflow-auto p-4 sm:p-6 lg:p-8">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(172,244,23,0.07),transparent_60%)]"
      />

      <ProfileHero data={parsedProfile} />

      <ProfileForm initialData={profile?.parsed_data} />
    </main>
  )
}
