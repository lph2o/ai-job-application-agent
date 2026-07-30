"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Link01Icon,
  SparklesIcon,
  Loading02Icon,
  Cancel01Icon,
  Building01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ApplyModalProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  jobTitle: string
  company: string
  jobUrl: string
  onManualApply: (id: string, url: string) => void
  onAutoApply: (id: string) => Promise<void>
}

export function ApplyModal({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  company,
  jobUrl,
  onManualApply,
  onAutoApply,
}: ApplyModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  if (!isOpen) return null

  const handleManual = () => {
    onManualApply(jobId, jobUrl)
    onClose()
  }

  const handleAuto = async () => {
    setIsSubmitting(true)
    try {
      await onAutoApply(jobId)
    } finally {
      setIsSubmitting(false)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
        </button>

        {/* Header */}
        <div className="space-y-1.5 pr-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary ring-1 ring-inset ring-primary/20">
            <HugeiconsIcon icon={Building01Icon} strokeWidth={2} className="size-3.5" />
            {company}
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">
            Apply to {jobTitle}
          </h2>
          <p className="text-xs font-medium text-muted-foreground">
            Choose how you would like to submit your job application.
          </p>
        </div>

        {/* Options */}
        <div className="mt-6 space-y-3">
          {/* Option 1: Apply Manually */}
          <button
            type="button"
            onClick={handleManual}
            disabled={isSubmitting}
            className={cn(
              "group relative flex w-full items-start gap-4 rounded-2xl border border-border/60 bg-muted/30 p-4 text-left transition-all duration-200",
              "hover:border-border hover:bg-muted/60 hover:shadow-md cursor-pointer"
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background border border-border/50 text-foreground shadow-2xs group-hover:scale-105 transition-transform">
              <HugeiconsIcon icon={Link01Icon} strokeWidth={2} className="size-5" />
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground">Apply Manually</h4>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Official Site
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Opens the official job application page in a new browser tab so you can fill it out manually.
              </p>
            </div>
          </button>

          {/* Option 2: Apply Automatically using AI Agent */}
          <button
            type="button"
            onClick={handleAuto}
            disabled={isSubmitting}
            className={cn(
              "group relative flex w-full items-start gap-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 text-left transition-all duration-200",
              "hover:border-primary/60 hover:bg-primary/10 hover:shadow-lg hover:shadow-primary/10 cursor-pointer"
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm group-hover:scale-105 transition-transform">
              {isSubmitting ? (
                <HugeiconsIcon icon={Loading02Icon} strokeWidth={2.5} className="size-5 animate-spin" />
              ) : (
                <HugeiconsIcon icon={SparklesIcon} strokeWidth={2.5} className="size-5" />
              )}
            </div>
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  Apply Automatically using AI Agent
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-primary-foreground">
                    Automated
                  </span>
                </h4>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Steel.dev + Playwright will detect required form fields, verify your profile data, attach your resume, and submit the application for you.
              </p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl text-xs">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
