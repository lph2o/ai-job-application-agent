import Link from "next/link"
import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  if (!claims?.sub) {
    redirect("/sign-in")
  }

  const fullName =
    (claims.user_metadata?.full_name as string | undefined) ??
    (claims.user_metadata?.name as string | undefined) ??
    "User"

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, created_at")
    .eq("id", claims.sub)
    .single()

  return (
    <main className="flex flex-1 flex-col gap-8 bg-muted/30 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome back, {profile?.full_name ?? fullName}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Your workspace for managing job applications with AI assistance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
            <CardDescription>Track roles you&apos;ve applied to.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">0</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumes</CardTitle>
            <CardDescription>Tailored versions for each job.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">0</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interviews</CardTitle>
            <CardDescription>Upcoming and completed sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">0</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
          <CardDescription>
            You&apos;re signed in and ready to build your application workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button render={<Link href="/dashboard/jobs" />}>Browse jobs</Button>
          <Button variant="outline" render={<Link href="/dashboard/resume" />}>
            Create resume
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
