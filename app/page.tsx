import Link from "next/link"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const isSignedIn = Boolean(data?.claims?.sub)

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
              AI
            </span>
            <span className="text-sm font-medium">Job Application Agent</span>
          </div>
          <div className="flex items-center gap-2">
            {isSignedIn ? (
              <Button
                nativeButton={false}
                size="sm"
                render={<Link href="/dashboard" />}
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Button
                  nativeButton={false}
                  variant="ghost"
                  size="sm"
                  render={<Link href="/sign-in" />}
                >
                  Sign in
                </Button>
                <Button
                  nativeButton={false}
                  size="sm"
                  render={<Link href="/sign-up" />}
                >
                  Get started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 px-6 py-20">
        <div className="max-w-2xl space-y-4">
          <p className="text-sm font-medium text-muted-foreground">
            AI-powered job search
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Apply to more jobs in less time.
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            Tailor resumes, track applications, and automate repetitive tasks
            so you can focus on landing the right role.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {isSignedIn ? (
            <Button
              nativeButton={false}
              size="lg"
              render={<Link href="/dashboard" />}
            >
              Go to dashboard
            </Button>
          ) : (
            <>
              <Button
                nativeButton={false}
                size="lg"
                render={<Link href="/sign-up" />}
              >
                Create free account
              </Button>
              <Button
                nativeButton={false}
                variant="outline"
                size="lg"
                render={<Link href="/sign-in" />}
              >
                Sign in
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
