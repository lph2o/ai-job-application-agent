"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { File01Icon, Download01Icon, Clock01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface Resume {
  id: string
  file_name: string
  storage_path: string
  file_size: number
  created_at: string
  signedUrl: string | null
}

interface ResumeListProps {
  resumes: Resume[]
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function ResumeList({ resumes }: ResumeListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Uploaded Resumes</CardTitle>
        <CardDescription>
          Your previously uploaded resumes are listed below.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {resumes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <HugeiconsIcon icon={File01Icon} strokeWidth={2} className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No resumes uploaded yet</p>
            <p className="text-sm text-muted-foreground">
              Upload your resume during onboarding to see it here.
            </p>
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {resumes.map((resume) => (
              <div
                key={resume.id}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HugeiconsIcon icon={File01Icon} strokeWidth={2} className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {resume.file_name}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-normal">
                        {formatFileSize(resume.file_size)}
                      </Badge>
                      <span className="flex items-center gap-1 text-sm text-muted-foreground">
                        <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-3" />
                        {formatDate(resume.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                {resume.signedUrl ? (
                  <Button
                    render={
                      <a
                        href={resume.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <HugeiconsIcon icon={Download01Icon} strokeWidth={2} className="size-3" />
                        Download
                      </a>
                    }
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    nativeButton={false}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
