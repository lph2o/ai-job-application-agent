"use client"

import React from "react"
import { HugeiconsIcon, type HugeiconsProps } from "@hugeicons/react"
import {
  Location01Icon,
  Clock01Icon,
  Money01Icon,
  ArrowUpRightIcon,
  Bookmark01Icon,
  Bookmark02Icon,
  CheckmarkCircle02Icon,
  UserIcon,
  Calendar01Icon,
  Link01Icon,
} from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PlatformLogo } from "@/components/jobs/platform-logo"
import { getPlatform } from "@/lib/jobs/schema"
import { cn } from "@/lib/utils"

/** Strip only dangerous tags/attributes — keeps formatting HTML intact */
function sanitizeHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*(["'])[^"']*\1/gi, "")
    .replace(/javascript:/gi, "")
}

function isHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text)
}

type HugeIconType = NonNullable<HugeiconsProps["icon"]>

interface JobCardProps {
  id: string
  title: string
  company: string
  companyLogo?: string | null
  location?: string | null
  salary?: string | null
  jobType?: string | null
  experienceLevel?: string | null
  description?: string | null
  tags?: string[]
  platform: string
  matchScore: number
  jobUrl: string
  savedStatus: boolean
  appliedStatus?: boolean
  onSave: (id: string, saved: boolean) => void
  onApply: (id: string) => void
}

/* ─── Platform accent colours ─────────────────────────────────────────────── */
const platformStyles: Record<string, { badge: string; accent: string; ring: string }> = {
  greenhouse: {
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    accent: "from-emerald-500/40 via-emerald-500/10 to-transparent",
    ring: "ring-emerald-500/20",
  },
  lever: {
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    accent: "from-blue-500/40 via-blue-500/10 to-transparent",
    ring: "ring-blue-500/20",
  },
  workable: {
    badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    accent: "from-violet-500/40 via-violet-500/10 to-transparent",
    ring: "ring-violet-500/20",
  },
  wellfound: {
    badge: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    accent: "from-orange-500/40 via-orange-500/10 to-transparent",
    ring: "ring-orange-500/20",
  },
}

/* ─── Score ring (SVG) ─────────────────────────────────────────────────────── */
function ScoreRing({ score }: { score: number }) {
  const r = 18
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  const color =
    score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#6b7280"

  return (
    <div className="relative flex items-center justify-center">
      <svg width={46} height={46} viewBox="0 0 48 48" className="-rotate-90">
        <circle cx={24} cy={24} r={r} fill="none" strokeWidth={3.5}
          className="stroke-muted/60" />
        <circle
          cx={24} cy={24} r={r} fill="none"
          stroke={color} strokeWidth={3.5}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] font-extrabold tabular-nums leading-none" style={{ color }}>
          {score}%
        </span>
      </div>
    </div>
  )
}

/* ─── Meta chip ────────────────────────────────────────────────────────────── */
function MetaChip({
  icon,
  label,
  colorClass,
}: {
  icon: HugeIconType
  label: string
  colorClass?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
        colorClass ?? "bg-muted/50 text-muted-foreground ring-border/40"
      )}
    >
      <HugeiconsIcon icon={icon} strokeWidth={2} className="size-3.5 shrink-0 opacity-75" />
      {label}
    </span>
  )
}

/* ─── Skill tag ────────────────────────────────────────────────────────────── */
function SkillTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-primary/8 px-2 py-0.5 text-[11px] font-semibold text-primary ring-1 ring-inset ring-primary/20">
      {label}
    </span>
  )
}

/* ─── Main component ───────────────────────────────────────────────────────── */
export function JobCard({
  id,
  title,
  company,
  companyLogo,
  location,
  salary,
  jobType,
  experienceLevel,
  description,
  tags,
  platform,
  matchScore,
  jobUrl,
  savedStatus,
  appliedStatus = false,
  onSave,
  onApply,
}: JobCardProps) {
  const [expanded, setExpanded] = React.useState(false)
  const platformMeta = getPlatform(platform)
  const ps = platformStyles[platform] ?? {
    badge: "bg-muted/60 text-muted-foreground",
    accent: "from-muted/30 via-muted/10 to-transparent",
    ring: "ring-border/30",
  }

  const hasDescription = !!description?.trim()
  const descIsHtml = hasDescription && isHtml(description!)
  const isLong = hasDescription && description!.length > 120

  return (
    <Card
      className={cn(
        "group/job relative overflow-hidden border border-border/50 bg-card/80 backdrop-blur-sm",
        "transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        "hover:-translate-y-0.5 hover:border-border/80 hover:bg-card hover:shadow-xl hover:shadow-black/8",
        appliedStatus && "border-emerald-500/25 bg-emerald-500/3"
      )}
    >
      {/* Platform accent top-bar */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r opacity-80",
          ps.accent
        )}
      />

      <CardContent className="p-5">
        {/* ── Row 1: Logo · Title · Score ──────────────────────────────────── */}
        <div className="flex items-start gap-3.5">
          {/* Logo */}
          <div
            className={cn(
              "relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl",
              "bg-gradient-to-br from-muted/80 to-muted ring-1 ring-inset shadow-inner",
              ps.ring,
              "transition-transform duration-300 group-hover/job:scale-105"
            )}
          >
            {companyLogo ? (
              <img src={companyLogo} alt={company} className="size-full rounded-2xl object-cover" />
            ) : (
              <span className="text-sm font-extrabold uppercase tracking-wide text-primary">
                {company.substring(0, 2)}
              </span>
            )}
          </div>

          {/* Title + Company */}
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex flex-wrap items-start gap-2">
              <h3 className="text-sm font-bold leading-snug tracking-tight text-foreground transition-colors group-hover/job:text-primary">
                {title}
              </h3>
              {appliedStatus && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2.5} className="size-3" />
                  Applied
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-muted-foreground">{company}</p>

            {/* Platform badge */}
            <span
              className={cn(
                "mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                ps.badge,
                ps.ring
              )}
            >
              <PlatformLogo platform={platform} size="xs" />
              {platformMeta?.label ?? platform}
            </span>
          </div>

          {/* Match Score Ring */}
          <div className="shrink-0 flex flex-col items-center gap-0.5">
            <ScoreRing score={matchScore} />
            <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Match
            </span>
          </div>
        </div>

        {/* ── Row 2: Meta chips ─────────────────────────────────────────────── */}
        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {location && (
            <MetaChip
              icon={Location01Icon}
              label={location}
              colorClass="bg-sky-500/8 text-sky-700 dark:text-sky-400 ring-sky-500/20"
            />
          )}
          {jobType && (
            <MetaChip
              icon={Clock01Icon}
              label={jobType}
              colorClass="bg-violet-500/8 text-violet-700 dark:text-violet-400 ring-violet-500/20"
            />
          )}
          {experienceLevel && (
            <MetaChip
              icon={UserIcon}
              label={experienceLevel}
              colorClass="bg-amber-500/8 text-amber-700 dark:text-amber-400 ring-amber-500/20"
            />
          )}
          {salary && (
            <MetaChip
              icon={Money01Icon}
              label={salary}
              colorClass="bg-emerald-500/8 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20"
            />
          )}
        </div>

        {/* ── Row 3: Description reveal ─────────────────────────────────────── */}
        {hasDescription && (
          <div className="mt-3 space-y-1">
            {descIsHtml ? (
              <div
                className={cn(
                  "job-desc-html overflow-hidden transition-all duration-300",
                  expanded ? "max-h-[2000px]" : "max-h-[3.6rem]"
                )}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(description!) }}
              />
            ) : (
              <p
                className={cn(
                  "text-[12px] leading-relaxed text-muted-foreground transition-all duration-300",
                  expanded ? "line-clamp-none whitespace-pre-line" : "line-clamp-2"
                )}
              >
                {description}
              </p>
            )}
            {isLong && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setExpanded((prev) => !prev)
                }}
                className="cursor-pointer text-[11px] font-bold text-primary hover:underline focus-visible:outline-none inline-flex items-center gap-1 py-0.5"
              >
                {expanded ? "Show less ↑" : "Show more ↓"}
              </button>
            )}
          </div>
        )}

        {/* ── Row 4: Skills / Tags ──────────────────────────────────────────── */}
        {tags && tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.slice(0, 7).map((tag) => (
              <SkillTag key={tag} label={tag} />
            ))}
            {tags.length > 7 && (
              <span className="inline-flex items-center rounded-md bg-muted/50 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-inset ring-border/40">
                +{tags.length - 7} more
              </span>
            )}
          </div>
        )}

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <div className="mt-4 border-t border-border/40" />

        {/* ── Row 5: Source + Actions ───────────────────────────────────────── */}
        <div className="mt-3 flex items-center justify-between gap-2">
          {/* Source domain */}
          <a
            href={jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <HugeiconsIcon icon={Link01Icon} strokeWidth={2} className="size-3" />
            {platformMeta?.domain ?? "View source"}
          </a>

          <div className="flex items-center gap-2">
            {/* Bookmark */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => onSave(id, !savedStatus)}
              className={cn(
                "size-8 rounded-xl border-border/50 transition-all duration-200",
                savedStatus
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                  : "text-muted-foreground hover:border-border hover:text-foreground"
              )}
              aria-label={savedStatus ? "Unsave job" : "Save job"}
            >
              <HugeiconsIcon
                icon={savedStatus ? Bookmark02Icon : Bookmark01Icon}
                strokeWidth={2}
                className="size-4"
              />
            </Button>

            {/* Apply */}
            <Button
              size="sm"
              onClick={() => !appliedStatus && onApply(id)}
              disabled={appliedStatus}
              className={cn(
                "group/apply h-8 gap-1.5 rounded-xl px-4 text-[12px] font-bold shadow-sm transition-all duration-300 active:scale-[0.97]",
                appliedStatus
                  ? "cursor-default bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25"
              )}
            >
              {appliedStatus ? (
                <>
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2.5} className="size-3.5" />
                  Applied
                </>
              ) : (
                <>
                  Apply Now
                  <HugeiconsIcon
                    icon={ArrowUpRightIcon}
                    strokeWidth={2.5}
                    className="size-3.5 transition-transform duration-300 group-hover/apply:translate-x-0.5 group-hover/apply:-translate-y-0.5"
                  />
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
