import Link from "next/link"

import { cn } from "@/lib/utils"

interface AuthShellProps {
  children: React.ReactNode
  title: string
  description: string
  footer: React.ReactNode
}

export function AuthShell({
  children,
  title,
  description,
  footer,
}: AuthShellProps) {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="relative hidden w-[45%] overflow-hidden bg-zinc-950 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(255,255,255,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(120,120,120,0.18),_transparent_50%)]"
        />
        <div className="relative z-10 flex flex-col gap-6 p-10">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-2 text-sm font-medium text-zinc-100"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
              AI
            </span>
            Job Application Agent
          </Link>
          <div className="max-w-md space-y-3">
            <p className="text-3xl font-semibold tracking-tight text-white">
              Apply smarter, not harder.
            </p>
            <p className="text-sm leading-relaxed text-zinc-400">
              Tailor resumes, track applications, and let AI handle the
              repetitive parts of your job search.
            </p>
          </div>
        </div>
        <div className="relative z-10 border-t border-white/10 p-10">
          <blockquote className="space-y-2">
            <p className="text-sm leading-relaxed text-zinc-300">
              &ldquo;The fastest way to go from job posting to polished
              application.&rdquo;
            </p>
            <footer className="text-xs text-zinc-500">Built for modern job seekers</footer>
          </blockquote>
        </div>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10">
        <div className="mb-8 flex w-full max-w-md items-center justify-between lg:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              AI
            </span>
            Job Agent
          </Link>
        </div>

        <div className={cn("w-full max-w-md space-y-8")}>
          <div className="space-y-2 text-center lg:text-left">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          {children}

          <p className="text-center text-sm text-muted-foreground lg:text-left">
            {footer}
          </p>
        </div>
      </main>
    </div>
  )
}
