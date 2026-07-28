import { z } from "zod"

export const WorkExperienceSchema = z.object({
  company: z.string().trim().min(1, "Company name is required"),
  title: z.string().trim().min(1, "Job title is required"),
  duration: z.string().trim().nullable().optional(),
  location: z.string().trim().nullable().optional(),
  responsibilities: z.array(z.string().trim()).optional(),
})

export const EducationSchema = z.object({
  institution: z.string().trim().min(1, "Institution is required"),
  degree: z.string().trim().nullable().optional(),
  fieldOfStudy: z.string().trim().nullable().optional(),
  duration: z.string().trim().nullable().optional(),
  location: z.string().trim().nullable().optional(),
  gpa: z.string().trim().nullable().optional(),
})

export const ProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required"),
  description: z.string().trim().nullable().optional(),
  link: z.string().trim().nullable().optional(),
})

export const CertificationSchema = z.object({
  name: z.string().trim().min(1, "Certification name is required"),
  issuer: z.string().trim().nullable().optional(),
  date: z.string().trim().nullable().optional(),
  link: z.string().trim().nullable().optional(),
})

export const LinkSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
  url: z.string().trim().min(1, "URL is required"),
})

export const ResumeProfileSchema = z.object({
  fullName: z.string().trim().nullable().optional(),
  email: z.string().trim().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  location: z.string().trim().nullable().optional(),
  title: z.string().trim().nullable().optional(),
  summary: z.string().trim().nullable().optional(),
  skills: z.array(z.string().trim()).optional(),
  workExperience: z.array(WorkExperienceSchema).optional(),
  education: z.array(EducationSchema).optional(),
  projects: z.array(ProjectSchema).optional(),
  certifications: z.array(CertificationSchema).optional(),
  links: z.array(LinkSchema).optional(),
})

export type WorkExperience = z.infer<typeof WorkExperienceSchema>
export type Education = z.infer<typeof EducationSchema>
export type Project = z.infer<typeof ProjectSchema>
export type Certification = z.infer<typeof CertificationSchema>
export type ResumeLink = z.infer<typeof LinkSchema>
export type ResumeProfile = z.infer<typeof ResumeProfileSchema>

export function normalizeProfile(
  data?: ResumeProfile | null
): ResumeProfile {
  return {
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
}
