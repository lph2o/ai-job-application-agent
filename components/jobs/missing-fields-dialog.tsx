"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  AlertCircleIcon,
  SparklesIcon,
  Loading02Icon,
  Upload01Icon,
  CheckmarkCircle02Icon,
  UserIcon,
  Mail01Icon,
  CallIcon,
  Location01Icon,
  Link01Icon,
  File01Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { parseAndSaveResume } from "@/app/actions/onboarding"
import { saveMissingFieldsAndApply, autofillMissingFieldsWithAI } from "@/app/actions/jobs"
import { cn } from "@/lib/utils"

interface MissingFieldsDialogProps {
  isOpen: boolean
  onClose: () => void
  jobId: string
  jobTitle: string
  company: string
  missingFields: string[]
  onSuccess: () => void
}

export function MissingFieldsDialog({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  company,
  missingFields,
  onSuccess,
}: MissingFieldsDialogProps) {
  const [fullName, setFullName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [location, setLocation] = React.useState("")
  const [linkedin, setLinkedin] = React.useState("")
  const [resumeFile, setResumeFile] = React.useState<File | null>(null)

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isAiGenerating, setIsAiGenerating] = React.useState(false)
  const [isAiAutofilled, setIsAiAutofilled] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleAiAutofill = async () => {
    setIsAiGenerating(true)
    setError(null)
    try {
      const res = await autofillMissingFieldsWithAI({ jobId, missingFields })
      if (res.error) {
        setError(res.error)
      } else if (res.data) {
        if (res.data.fullName) setFullName(res.data.fullName)
        if (res.data.email) setEmail(res.data.email)
        if (res.data.phone) setPhone(res.data.phone)
        if (res.data.location) setLocation(res.data.location)
        if (res.data.linkedin) setLinkedin(res.data.linkedin)
        setIsAiAutofilled(true)
      }
    } catch (err: any) {
      setError(err?.message || "Failed to generate AI autofill values.")
    } finally {
      setIsAiGenerating(false)
    }
  }

  if (!isOpen) return null

  // Check which specific fields are requested.
  // If missingFields is empty (e.g. opened from a Failed card), show ALL fields
  // so the user can correct anything that might have caused the failure.
  const showAll = missingFields.length === 0
  const hasMissing = (name: string) =>
    showAll || missingFields.some((f) => f.toLowerCase().includes(name.toLowerCase()))

  const needsFullName = hasMissing("name") || hasMissing("fullName")
  const needsEmail = hasMissing("email")
  const needsPhone = hasMissing("phone")
  const needsLocation = hasMissing("location")
  const needsLinkedin = hasMissing("linkedin")
  const needsResume = hasMissing("resume")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // 1. If resume is required & uploaded, upload & parse first
      if (needsResume && resumeFile) {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setError("You must be logged in to upload a resume.")
          setIsSubmitting(false)
          return
        }

        const ext = resumeFile.name.split(".").pop() ?? "pdf"
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from("resumes")
          .upload(path, resumeFile)

        if (uploadErr) {
          setError(`Resume upload failed: ${uploadErr.message}`)
          setIsSubmitting(false)
          return
        }

        const res = await parseAndSaveResume({
          storagePath: path,
          fileName: resumeFile.name,
          fileSize: resumeFile.size,
          mimeType: resumeFile.type,
        })

        if (res.error) {
          setError(`Resume processing error: ${res.error}`)
          setIsSubmitting(false)
          return
        }
      }

      // 2. Save missing text fields & restart auto-apply
      const res = await saveMissingFieldsAndApply({
        jobId,
        fields: {
          fullName: needsFullName ? fullName : undefined,
          email: needsEmail ? email : undefined,
          phone: needsPhone ? phone : undefined,
          location: needsLocation ? location : undefined,
          linkedin: needsLinkedin ? linkedin : undefined,
        },
      })

      if (res.error) {
        setError(res.error)
        setIsSubmitting(false)
        return
      }

      // Success!
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative flex flex-col w-full max-w-md max-h-[85vh] overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-2xl transition-all"
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
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20">
            <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2.5} className="size-3.5" />
            {showAll ? "Review & Fix Application Data" : "Complete Missing Information"}
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-foreground truncate">
            {jobTitle}
          </h2>
          <p className="text-xs font-medium text-muted-foreground">
            {showAll
              ? <>Review your profile data for <span className="font-semibold text-foreground">{company}</span>. Fix any incorrect fields and retry.</>
              : <>Provide the required info for <span className="font-semibold text-foreground">{company}</span> to resume your automated application.</>
            }
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-3 shrink-0 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="space-y-4 overflow-y-auto pr-2 max-h-[55vh] [scrollbar-width:thin]">
            {/* AI Agent Autofill Card Header */}
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
                    Use Gemini AI to suggest missing fields
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
          {/* Full Name */}
          {needsFullName && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                Full Name
              </Label>
              <Input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Doe"
                className="h-10 rounded-xl text-xs"
              />
            </div>
          )}

          {/* Email */}
          {needsEmail && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                Email Address
              </Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. john@example.com"
                className="h-10 rounded-xl text-xs"
              />
            </div>
          )}

          {/* Phone */}
          {needsPhone && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <HugeiconsIcon icon={CallIcon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                Phone Number
              </Label>
              <Input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +1 (555) 000-0000"
                className="h-10 rounded-xl text-xs"
              />
            </div>
          )}

          {/* Location */}
          {needsLocation && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <HugeiconsIcon icon={Location01Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                Location / City
              </Label>
              <Input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. New York, NY"
                className="h-10 rounded-xl text-xs"
              />
            </div>
          )}

          {/* LinkedIn URL */}
          {needsLinkedin && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <HugeiconsIcon icon={Link01Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                LinkedIn Profile URL
              </Label>
              <Input
                type="url"
                required
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="https://linkedin.com/in/username"
                className="h-10 rounded-xl text-xs"
              />
            </div>
          )}

          {/* Resume Upload */}
          {needsResume && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <HugeiconsIcon icon={File01Icon} strokeWidth={2} className="size-3.5 text-muted-foreground" />
                Upload Resume (PDF / DOCX)
              </Label>
              <div className="relative flex items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-muted/30 p-4 transition-colors hover:border-primary/50">
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  required
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
                <div className="flex flex-col items-center gap-1 text-center">
                  <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} className="size-6 text-muted-foreground" />
                  <span className="text-xs font-bold text-foreground">
                    {resumeFile ? resumeFile.name : "Click or drag resume file here"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">PDF or DOCX up to 5MB</span>
                </div>
              </div>
            </div>
          )}
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
                  Saving & Applying...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={SparklesIcon} strokeWidth={2.5} className="size-4" />
                  Save & Resume Application
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
