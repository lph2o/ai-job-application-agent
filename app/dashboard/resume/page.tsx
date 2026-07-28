import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { ResumeList } from "./resume-list"

export default async function ResumePage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = authData?.claims?.sub

  if (!userId) {
    redirect("/sign-in?next=/dashboard/resume")
  }

  const { data: resumes, error } = await supabase
    .from("resumes")
    .select("id, file_name, storage_path, file_size, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Failed to fetch resumes:", error)
  }

  const resumeRows = !resumes?.length
    ? null
    : await Promise.all(
        resumes.map(async (resume) => {
          const { data: signedData } = await supabase.storage
            .from("resumes")
            .createSignedUrl(resume.storage_path, 60 * 60)

          return {
            ...resume,
            signedUrl: signedData?.signedUrl ?? null,
          }
        })
      )

  return (
    <main className="flex flex-1 flex-col gap-6 overflow-auto bg-muted/30 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Resume</h1>
        <p className="text-sm text-muted-foreground">
          Build and tailor your resumes.
        </p>
      </div>

      <ResumeList resumes={resumeRows ?? []} />
    </main>
  )
}
