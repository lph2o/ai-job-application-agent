import { z } from "zod"

export const JobSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  platform: z.enum(["greenhouse", "lever", "workable", "wellfound"]),
  title: z.string(),
  company: z.string(),
  company_logo: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  salary: z.string().nullable().optional(),
  job_type: z.string().nullable().optional(),
  experience_level: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  match_score: z.number().int().min(0).max(100).optional(),
  job_url: z.string().url(),
  source_url: z.string().nullable().optional(),
  applied_status: z.boolean().optional(),
  saved_status: z.boolean().optional(),
  fetched_at: z.string(),
  created_at: z.string(),
})

export type Job = z.infer<typeof JobSchema>

export const PLATFORMS = [
  {
    key: "greenhouse" as const,
    label: "Greenhouse",
    domain: "greenhouse.io/jobs",
    logo: "/platforms/greenhouse.png",
  },
  {
    key: "lever" as const,
    label: "Lever",
    domain: "lever.co",
    logo: "/platforms/lever.png",
  },
  {
    key: "workable" as const,
    label: "Workable",
    domain: "workable.com",
    logo: "/platforms/workable.png",
  },
  {
    key: "wellfound" as const,
    label: "Wellfound",
    domain: "wellfound.com/jobs",
    logo: "/platforms/wellfound.png",
  },
] as const

export type Platform = (typeof PLATFORMS)[number]["key"]

export function getPlatform(key: string) {
  return PLATFORMS.find((platform) => platform.key === key)
}
