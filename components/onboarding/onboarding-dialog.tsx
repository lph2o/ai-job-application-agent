"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Pdf01Icon,
  Doc01Icon,
  Upload01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  Loading03Icon,
  Alert02Icon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { parseAndSaveResume } from "@/app/actions/onboarding"
import { uploadFileWithProgress } from "@/lib/supabase/upload"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".doc"]

const MAX_SIZE_MB = 5
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

function getFileIcon(mimeType: string) {
  if (mimeType === "application/pdf") {
    return <HugeiconsIcon icon={Pdf01Icon} strokeWidth={2} className="size-6 text-destructive" />
  }
  return <HugeiconsIcon icon={Doc01Icon} strokeWidth={2} className="size-6 text-primary" />
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function OnboardingDialog({ open }: { open: boolean }) {
  const router = useRouter()
  const [file, setFile] = React.useState<File | null>(null)
  const [status, setStatus] = React.useState<
    "idle" | "uploading" | "parsing" | "done" | "error"
  >("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const isAcceptedExtension = (selected: File) => {
    const dotIndex = selected.name.lastIndexOf(".")
    if (dotIndex < 0) return false
    const extension = selected.name.slice(dotIndex).toLowerCase()
    return ACCEPTED_EXTENSIONS.includes(extension)
  }

  const validateFile = (selected: File): string | null => {
    const isAcceptedType =
      ACCEPTED_TYPES.includes(selected.type) || isAcceptedExtension(selected)
    if (!isAcceptedType) {
      return "Please upload a PDF or DOCX file."
    }
    if (selected.size > MAX_SIZE_BYTES) {
      return `File size exceeds ${MAX_SIZE_MB}MB limit.`
    }
    return null
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    if (selected) {
      const validationError = validateFile(selected)
      if (validationError) {
        setError(validationError)
        setFile(null)
        return
      }
      setFile(selected)
      setError(null)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging((prev) => (prev ? prev : true))
  }

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)

    const droppedFile = event.dataTransfer.files?.[0]
    if (!droppedFile) return

    const validationError = validateFile(droppedFile)
    if (validationError) {
      setError(validationError)
      setFile(null)
      return
    }

    setFile(droppedFile)
    setError(null)
  }

  const handleRemoveFile = () => {
    setFile(null)
    setError(null)
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!file) return

    setStatus("uploading")
    setProgress(0)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setStatus("error")
        setError("You must be signed in to upload a resume.")
        return
      }

      const ext = file.name.split(".").pop() ?? "bin"
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`

      await uploadFileWithProgress({
        bucket: "resumes",
        path,
        file,
        onProgress: ({ percentage }) => {
          setProgress(percentage)
        },
      })

      setStatus("parsing")

      const result = await parseAndSaveResume({
        storagePath: path,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      })

      if (result.error) {
        setStatus("error")
        setError(result.error)
        return
      }

      setStatus("done")
      router.refresh()
      window.setTimeout(() => {
        router.push("/dashboard/profile")
      }, 900)
    } catch (err) {
      console.error("Upload error:", err)
      setStatus("error")
      setError("An unexpected error occurred. Please try again.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-base font-semibold">
            Welcome! Let&apos;s set up your profile
          </DialogTitle>
          <DialogDescription>
            Upload your resume and we&apos;ll automatically extract your profile
            information. You can edit everything afterward.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!file ? (
            <label
              htmlFor="resume-upload"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "group relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 outline-none focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 active:scale-[0.98]",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/20 hover:bg-muted/40",
                error && "border-destructive bg-destructive/5"
              )}
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-background ring-1 ring-border transition-colors group-hover:bg-primary/10">
                <HugeiconsIcon
                  icon={Upload01Icon}
                  strokeWidth={2}
                  className="size-6 text-muted-foreground transition-colors group-hover:text-primary"
                />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Click or drag and drop your resume
                </p>
                <p className="text-sm text-muted-foreground">
                  PDF or DOCX up to {MAX_SIZE_MB}MB
                </p>
              </div>
              <input
                ref={inputRef}
                id="resume-upload"
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={handleFileChange}
                className="sr-only"
                disabled={status === "uploading" || status === "parsing"}
                aria-invalid={!!error}
                aria-describedby="upload-help"
              />
              <span id="upload-help" className="sr-only">
                Accepted formats: PDF or DOCX, maximum {MAX_SIZE_MB}MB.
              </span>
            </label>
          ) : (
            <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition-all duration-200">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {getFileIcon(file.type)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {file.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                disabled={status === "uploading" || status === "parsing" || status === "done"}
                className="rounded-full p-2 text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95 disabled:opacity-50"
                aria-label="Remove selected file"
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-4" />
              </button>
            </div>
          )}

          {error && status !== "uploading" && (
            <div
              className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
              role="status"
              aria-live="polite"
            >
              <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {status === "uploading" && (
            <Progress value={progress} className="flex-col gap-2">
              <div className="flex w-full items-center justify-between">
                <span className="text-sm font-medium">Uploading resume...</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {progress}%
                </span>
              </div>
            </Progress>
          )}

          {status === "parsing" && (
            <div
              className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm text-foreground"
              role="status"
              aria-live="polite"
            >
              <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-5 animate-spin" />
              <span>Parsing resume with AI...</span>
            </div>
          )}

          {status === "done" && (
            <div
              className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm font-medium text-foreground"
              role="status"
              aria-live="polite"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} className="size-4" />
              </div>
              <span>Resume uploaded and parsed successfully!</span>
            </div>
          )}

          {status === "done" ? null : (
            <Button
              type="submit"
              disabled={!file || status === "uploading" || status === "parsing"}
              className="w-full transition-all duration-200 active:scale-[0.98]"
            >
              {status === "uploading" ? (
                <><HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="mr-2 size-4 animate-spin" />
                  Uploading resume...
                </>
              ) : status === "parsing" ? (
                <><HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="mr-2 size-4 animate-spin" />
                  Parsing resume...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} className="mr-2 size-4" />
                  Upload & Parse Resume
                </>
              )}
            </Button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
