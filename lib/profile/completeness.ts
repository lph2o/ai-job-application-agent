import type { ResumeProfile } from "@/lib/resume/schema"

export interface CompletenessSection {
  key: string
  label: string
  percentage: number
  filled: number
  total: number
}

export interface CompletenessResult {
  percentage: number
  sections: CompletenessSection[]
}

function countFilled(items: (string | null | undefined | string[])[]): number {
  return items.filter((item) => {
    if (Array.isArray(item)) return item.length > 0
    return typeof item === "string" && item.trim().length > 0
  }).length
}

export function calculateProfileCompleteness(
  data: ResumeProfile | null | undefined
): CompletenessResult {
  const normalized = {
    fullName: data?.fullName ?? "",
    email: data?.email ?? "",
    phone: data?.phone ?? "",
    location: data?.location ?? "",
    title: data?.title ?? "",
    summary: data?.summary ?? "",
    skills: data?.skills ?? [],
    workExperience: data?.workExperience ?? [],
    education: data?.education ?? [],
    projects: data?.projects ?? [],
    certifications: data?.certifications ?? [],
    links: data?.links ?? [],
  }

  const personalFilled = countFilled([
    normalized.fullName,
    normalized.email,
    normalized.phone,
    normalized.location,
    normalized.title,
    normalized.summary,
  ])

  const skillsFilled = normalized.skills.length > 0 ? 1 : 0

  const workItems = normalized.workExperience.map((item) =>
    countFilled([
      item.company,
      item.title,
      item.duration,
      item.location,
      item.responsibilities,
    ])
  )
  const workFilled = workItems.reduce((acc, curr) => acc + curr, 0)
  const workMax = Math.max(workItems.length * 5, 5)

  const educationItems = normalized.education.map((item) =>
    countFilled([
      item.institution,
      item.degree,
      item.fieldOfStudy,
      item.duration,
      item.location,
      item.gpa,
    ])
  )
  const educationFilled = educationItems.reduce((acc, curr) => acc + curr, 0)
  const educationMax = Math.max(educationItems.length * 6, 6)

  const projectItems = normalized.projects.map((item) =>
    countFilled([item.name, item.description, item.link])
  )
  const projectsFilled = projectItems.reduce((acc, curr) => acc + curr, 0)
  const projectsMax = Math.max(projectItems.length * 3, 3)

  const certItems = normalized.certifications.map((item) =>
    countFilled([item.name, item.issuer, item.date, item.link])
  )
  const certificationsFilled = certItems.reduce((acc, curr) => acc + curr, 0)
  const certificationsMax = Math.max(certItems.length * 4, 4)

  const linkItems = normalized.links.map((item) =>
    countFilled([item.label, item.url])
  )
  const linksFilled = linkItems.reduce((acc, curr) => acc + curr, 0)
  const linksMax = Math.max(linkItems.length * 2, 2)

  const totalFilled =
    personalFilled +
    skillsFilled +
    workFilled +
    educationFilled +
    projectsFilled +
    certificationsFilled +
    linksFilled

  const totalMax =
    6 +
    1 +
    workMax +
    educationMax +
    projectsMax +
    certificationsMax +
    linksMax

  const percentage =
    totalMax === 0 ? 0 : Math.min(100, Math.round((totalFilled / totalMax) * 100))

  return {
    percentage,
    sections: [
      {
        key: "personal",
        label: "Personal Info",
        percentage: Math.round((personalFilled / 6) * 100),
        filled: personalFilled,
        total: 6,
      },
      {
        key: "skills",
        label: "Skills",
        percentage: skillsFilled * 100,
        filled: skillsFilled,
        total: 1,
      },
      {
        key: "workExperience",
        label: "Experience",
        percentage: workMax === 0 ? 0 : Math.round((workFilled / workMax) * 100),
        filled: workFilled,
        total: workMax,
      },
      {
        key: "education",
        label: "Education",
        percentage: educationMax === 0 ? 0 : Math.round((educationFilled / educationMax) * 100),
        filled: educationFilled,
        total: educationMax,
      },
      {
        key: "projects",
        label: "Projects",
        percentage: projectsMax === 0 ? 0 : Math.round((projectsFilled / projectsMax) * 100),
        filled: projectsFilled,
        total: projectsMax,
      },
      {
        key: "certifications",
        label: "Certifications",
        percentage: certificationsMax === 0 ? 0 : Math.round((certificationsFilled / certificationsMax) * 100),
        filled: certificationsFilled,
        total: certificationsMax,
      },
      {
        key: "links",
        label: "Links",
        percentage: linksMax === 0 ? 0 : Math.round((linksFilled / linksMax) * 100),
        filled: linksFilled,
        total: linksMax,
      },
    ],
  }
}

export function getProgressColor(percentage: number): string {
  if (percentage < 30) return "text-destructive"
  if (percentage < 60) return "text-amber-500"
  if (percentage < 80) return "text-blue-500"
  return "text-emerald-500"
}

export function getProgressBackgroundColor(percentage: number): string {
  if (percentage < 30) return "bg-destructive/10"
  if (percentage < 60) return "bg-amber-500/10"
  if (percentage < 80) return "bg-blue-500/10"
  return "bg-emerald-500/10"
}
