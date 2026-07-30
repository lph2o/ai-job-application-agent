"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  AlertCircleIcon,
  SparklesIcon,
  Loading02Icon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { autofillUnknownFieldsWithAI, saveUnknownFieldsAndRetry } from "@/app/actions/jobs"
import { cn } from "@/lib/utils"

interface UnknownFormField {
  label: string
  name: string
  type: string
}

interface UnknownFieldsDialogProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  jobTitle: string
  company: string
  unknownFields: UnknownFormField[]
  onSuccess: () => void
}

export function UnknownFieldsDialog({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  company,
  unknownFields,
  onSuccess,
}: UnknownFieldsDialogProps) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isAiGenerating, setIsAiGenerating] = React.useState(false)
  const [isAiAutofilled, setIsAiAutofilled] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleAiAutofill = async () => {
    setIsAiGenerating(true)
    setError(null)
    try {
      const res = await autofillUnknownFieldsWithAI({ jobId, unknownFields })
      if (res.error) {
        setError(res.error)
      } else if (res.data) {
        setAnswers(res.data as Record<string, string>)
        setIsAiAutofilled(true)
      }
    } catch (err: any) {
      setError(err?.message || "Failed to generate AI autofill values.")
    } finally {
      setIsAiGenerating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await saveUnknownFieldsAndRetry({ jobId, answers })
      if (res.error) {
        setError(res.error)
        setIsSubmitting(false)
        return
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative flex flex-col w-full max-w-lg max-h-[85vh] overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute right-4 top-4 z-10 flex size-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
        </button>

        {/* Header */}
        <div className="space-y-1.5 pr-8 shrink-0 pb-3 border-b border-border/40">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 ring-1 ring-inset ring-rose-500/20">
            <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2.5} className="size-3.5" />
            Unknown Required Fields
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-foreground truncate">
            {jobTitle}
          </h2>
          <p className="text-xs font-medium text-muted-foreground">
            The automated bot encountered <span className="font-bold text-foreground">{unknownFields.length}</span> unknown required field(s) on{" "}
            <span className="font-semibold text-foreground">{company}</span>&apos;s application form. Fill them below to retry.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-3 shrink-0 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="space-y-4 overflow-y-auto pr-2 max-h-[55vh] [scrollbar-width:thin]">
            {/* AI Autofill Card */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                  <HugeiconsIcon icon={SparklesIcon} strokeWidth={2.5} className="size-4" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    AI Agent Autofill
                    {isAiAutofilled && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400">
                        Filled
                      </span>
                    )}
                  </h4>
                  <p className="text-[10px] font-medium text-muted-foreground truncate">
                    Use Gemini AI to suggest answers for all fields
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleAiAutofill}
                disabled={isAiGenerating || isSubmitting}
                className="shrink-0 gap-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs h-8 shadow-xs hover:bg-primary/90"
              >
                {isAiGenerating ? (
                  <>
                    <HugeiconsIcon icon={Loading02Icon} strokeWidth={2.5} className="size-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={SparklesIcon} strokeWidth={2.5} className="size-3.5" />
                    Autofill with AI
                  </>
                )}
              </Button>
            </div>

            {/* Unknown Fields */}
            {unknownFields.map((field) => (
              <div key={field.label} className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span className="flex size-1.5 rounded-full bg-rose-500" />
                  {field.label}
                  <span className="text-[10px] font-medium text-muted-foreground ml-1">
                    ({field.type})
                  </span>
                </Label>
                {field.type === "textarea" ? (
                  <Textarea
                    required
                    value={answers[field.label] || ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [field.label]: e.target.value }))}
                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                    className="min-h-[80px] rounded-xl text-xs"
                    rows={3}
                  />
                ) : (
                  <Input
                    type={field.type === "phone" ? "tel" : field.type === "email" ? "email" : "text"}
                    required
                    value={answers[field.label] || ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [field.label]: e.target.value }))}
                    placeholder={`Enter ${field.label.toLowerCase()}...`}
                    className="h-10 rounded-xl text-xs"
                  />
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-border/40 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="gap-2 rounded-xl bg-primary text-primary-foreground font-bold shadow-md hover:bg-primary/90"
            >
              {isSubmitting ? (
                <>
                  <HugeiconsIcon icon={Loading02Icon} strokeWidth={2.5} className="size-4 animate-spin" />
                  Saving & Retrying...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={SparklesIcon} strokeWidth={2.5} className="size-4" />
                  Save & Retry Auto-Apply
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
