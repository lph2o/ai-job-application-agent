"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  Delete02Icon,
  FloppyDiskIcon,
  UserIcon,
  WrenchIcon,
  BriefcaseIcon,
  GraduationCapIcon,
  FolderIcon,
  Certificate01Icon,
  LinkIcon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ProfileCompletenessCard } from "@/components/profile/profile-completeness-card";
import { ProfileSectionShell } from "@/components/profile/profile-section-shell";
import { updateProfile } from "@/app/actions/onboarding";
import {
  ResumeProfileSchema,
  type ResumeProfile,
  normalizeProfile,
} from "@/lib/resume/schema";
import { cn } from "@/lib/utils";

function tagsToString(tags?: string[]) {
  return (tags ?? []).join(", ");
}

const tabs = [
  { key: "personal", label: "Personal", icon: UserIcon },
  { key: "skills", label: "Skills", icon: WrenchIcon },
  { key: "workExperience", label: "Experience", icon: BriefcaseIcon },
  { key: "education", label: "Education", icon: GraduationCapIcon },
  { key: "projects", label: "Projects", icon: FolderIcon },
  { key: "certifications", label: "Certifications", icon: Certificate01Icon },
  { key: "links", label: "Links", icon: LinkIcon },
] as const;

export function ProfileForm({
  initialData,
}: {
  initialData?: ResumeProfile | null;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);

  const form = useForm<ResumeProfile>({
    resolver: zodResolver(ResumeProfileSchema),
    defaultValues: normalizeProfile(initialData),
  });

  const {
    fields: workFields,
    append: appendWork,
    remove: removeWork,
  } = useFieldArray({ control: form.control, name: "workExperience" });

  const {
    fields: eduFields,
    append: appendEdu,
    remove: removeEdu,
  } = useFieldArray({ control: form.control, name: "education" });

  const {
    fields: projectFields,
    append: appendProject,
    remove: removeProject,
  } = useFieldArray({ control: form.control, name: "projects" });

  const {
    fields: certFields,
    append: appendCert,
    remove: removeCert,
  } = useFieldArray({ control: form.control, name: "certifications" });

  const {
    fields: linkFields,
    append: appendLink,
    remove: removeLink,
  } = useFieldArray({ control: form.control, name: "links" });

  const watchedData = form.watch();

  const onSubmit = async (data: ResumeProfile) => {
    setIsSaving(true);
    setSaveMessage(null);
    const result = await updateProfile(data);
    setIsSaving(false);
    if (result.error) {
      setSaveMessage(`Error: ${result.error}`);
    } else {
      setSaveMessage("Profile saved successfully");
      router.refresh();
    }
  };

  const searchParams = useSearchParams();
  const missingParam = searchParams.get("missing");
  const missingFieldsList = missingParam ? missingParam.split(",").filter(Boolean) : [];

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {missingFieldsList.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2.5} className="size-5" />
            </div>
            <div className="space-y-1 text-xs">
              <h4 className="font-bold text-sm">Action Required for Automated Application</h4>
              <p className="leading-relaxed">
                The automated job application process identified missing required fields in your profile:{" "}
                <span className="font-bold underline">{missingFieldsList.join(", ")}</span>.
              </p>
              <p className="opacity-90">Please fill in these details below and click &quot;Save Profile&quot; to continue.</p>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="personal" className="space-y-6">
        <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="inline-flex h-auto w-max min-w-full gap-1.5 rounded-2xl bg-card/60 p-1.5 border border-border/50 backdrop-blur-md shadow-sm">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold tracking-tight transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-active:bg-primary data-active:text-primary-foreground data-active:shadow-md"
              >
                <HugeiconsIcon icon={tab.icon} strokeWidth={2.5} className="size-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-6">
            <TabsContent value="personal">
              <ProfileSectionShell>
                <Card className="border-0 bg-transparent shadow-none">
                  <CardHeader>
                    <span className="mb-1 text-[11px] font-bold uppercase tracking-widest text-primary">Basics</span>
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={UserIcon} strokeWidth={2.5} className="size-5 text-primary" />
                      <CardTitle className="text-xl font-bold">Personal Information</CardTitle>
                    </div>
                    <CardDescription>
                      Basic details and contact information.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2 pt-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Full Name</Label>
                      <Input
                        {...form.register("fullName")}
                        placeholder="John Doe"
                        className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Title / Headline</Label>
                      <Input
                        {...form.register("title")}
                        placeholder="e.g. Senior React Developer"
                        className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Email</Label>
                      <Input
                        {...form.register("email")}
                        type="email"
                        placeholder="john@example.com"
                        className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Phone</Label>
                      <Input
                        {...form.register("phone")}
                        placeholder="+1 (555) 000-0000"
                        className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold">Location</Label>
                      <Input
                        {...form.register("location")}
                        placeholder="City, Country or Remote"
                        className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-semibold">Professional Summary</Label>
                      <Textarea
                        rows={4}
                        {...form.register("summary")}
                        placeholder="A brief summary of your expertise and goals..."
                        className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                      />
                    </div>
                  </CardContent>
                </Card>
              </ProfileSectionShell>
            </TabsContent>

            <TabsContent value="skills">
              <ProfileSectionShell>
                <Card className="border-0 bg-transparent shadow-none">
                  <CardHeader>
                    <span className="mb-1 text-[11px] font-bold uppercase tracking-widest text-primary">Competencies</span>
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={WrenchIcon} strokeWidth={2.5} className="size-5 text-primary" />
                      <CardTitle className="text-xl font-bold">Skills & Technologies</CardTitle>
                    </div>
                    <CardDescription>
                      Enter your technical and soft skills, separated by commas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <Controller
                      control={form.control}
                      name="skills"
                      render={({ field }) => (
                        <Textarea
                          rows={4}
                          value={tagsToString(field.value)}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            )
                          }
                          placeholder="React, TypeScript, Next.js, Node.js, GraphQL, PostgreSQL, Tailwind CSS"
                          className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                        />
                      )}
                    />
                  </CardContent>
                </Card>
              </ProfileSectionShell>
            </TabsContent>

            <TabsContent value="workExperience">
              <ProfileSectionShell>
                <Card className="border-0 bg-transparent shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <span className="mb-1 text-[11px] font-bold uppercase tracking-widest text-primary">Career</span>
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={BriefcaseIcon} strokeWidth={2.5} className="size-5 text-primary" />
                        <CardTitle className="text-xl font-bold">Work Experience</CardTitle>
                      </div>
                      <CardDescription>
                        Manage your professional roles and achievements.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        appendWork({
                          company: "",
                          title: "",
                          duration: "",
                          location: "",
                          responsibilities: [],
                        })
                      }
                      className="rounded-xl font-semibold gap-1.5 shadow-sm"
                    >
                      <HugeiconsIcon icon={Add01Icon} strokeWidth={2.5} className="size-4" /> Add Role
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2">
                    {workFields.length > 0 ? (
                      <Accordion type="multiple" defaultValue={workFields.map((_, i) => `work-${i}`)} className="space-y-3 border-0">
                        {workFields.map((field, index) => {
                          const companyName = form.watch(`workExperience.${index}.company`);
                          const jobTitle = form.watch(`workExperience.${index}.title`);
                          const duration = form.watch(`workExperience.${index}.duration`);

                          return (
                            <AccordionItem
                              key={field.id}
                              value={`work-${index}`}
                              className="rounded-2xl border border-border/60 bg-card/60 p-1 shadow-2xs overflow-hidden"
                            >
                              <div className="flex items-center justify-between pr-3">
                                <AccordionTrigger className="p-4 hover:no-underline font-semibold text-sm">
                                  <div className="flex items-center gap-2.5 text-left">
                                    <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                                      {index + 1}
                                    </div>
                                    <div>
                                      <span className="font-bold text-foreground">
                                        {jobTitle || companyName ? `${jobTitle || "Role"} ${companyName ? `at ${companyName}` : ""}` : `Role ${index + 1}`}
                                      </span>
                                      {duration && (
                                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                                          ({duration})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </AccordionTrigger>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeWork(index);
                                  }}
                                  className="size-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                                >
                                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                                </Button>
                              </div>
                              <AccordionContent className="px-4 pb-4 pt-1">
                                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border/40">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Company</Label>
                                    <Input
                                      {...form.register(`workExperience.${index}.company`)}
                                      placeholder="Acme Inc."
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Job Title</Label>
                                    <Input
                                      {...form.register(`workExperience.${index}.title`)}
                                      placeholder="Senior Software Engineer"
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Duration</Label>
                                    <Input
                                      {...form.register(`workExperience.${index}.duration`)}
                                      placeholder="Jan 2022 - Present"
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Location</Label>
                                    <Input
                                      {...form.register(`workExperience.${index}.location`)}
                                      placeholder="San Francisco, CA or Remote"
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-1.5 sm:col-span-2">
                                    <Label className="text-xs font-semibold">Responsibilities & Achievements</Label>
                                    <Controller
                                      control={form.control}
                                      name={`workExperience.${index}.responsibilities`}
                                      render={({ field }) => (
                                        <Textarea
                                          rows={3}
                                          value={field.value?.join("\n")}
                                          onChange={(e) =>
                                            field.onChange(
                                              e.target.value
                                                .split("\n")
                                                .map((line) => line.trim())
                                                .filter(Boolean),
                                            )
                                          }
                                          placeholder="One accomplishment or duty per line..."
                                          className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                        />
                                      )}
                                    />
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    ) : (
                      <p className="text-xs font-medium text-muted-foreground text-center py-6 border border-dashed rounded-2xl border-border/60">
                        No work experience added yet. Click &quot;Add Role&quot; to start.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </ProfileSectionShell>
            </TabsContent>

            <TabsContent value="education">
              <ProfileSectionShell>
                <Card className="border-0 bg-transparent shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <span className="mb-1 text-[11px] font-bold uppercase tracking-widest text-primary">Academic</span>
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={GraduationCapIcon} strokeWidth={2.5} className="size-5 text-primary" />
                        <CardTitle className="text-xl font-bold">Education</CardTitle>
                      </div>
                      <CardDescription>
                        Degrees, diplomas, and certifications.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        appendEdu({
                          institution: "",
                          degree: "",
                          fieldOfStudy: "",
                          duration: "",
                          location: "",
                          gpa: "",
                        })
                      }
                      className="rounded-xl font-semibold gap-1.5 shadow-sm"
                    >
                      <HugeiconsIcon icon={Add01Icon} strokeWidth={2.5} className="size-4" /> Add Education
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2">
                    {eduFields.length > 0 ? (
                      <Accordion type="multiple" defaultValue={eduFields.map((_, i) => `edu-${i}`)} className="space-y-3 border-0">
                        {eduFields.map((field, index) => {
                          const inst = form.watch(`education.${index}.institution`);
                          const degree = form.watch(`education.${index}.degree`);

                          return (
                            <AccordionItem
                              key={field.id}
                              value={`edu-${index}`}
                              className="rounded-2xl border border-border/60 bg-card/60 p-1 shadow-2xs overflow-hidden"
                            >
                              <div className="flex items-center justify-between pr-3">
                                <AccordionTrigger className="p-4 hover:no-underline font-semibold text-sm">
                                  <div className="flex items-center gap-2.5 text-left">
                                    <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                                      {index + 1}
                                    </div>
                                    <span className="font-bold text-foreground">
                                      {degree || inst ? `${degree || "Degree"} ${inst ? `at ${inst}` : ""}` : `Education ${index + 1}`}
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeEdu(index);
                                  }}
                                  className="size-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                                >
                                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                                </Button>
                              </div>
                              <AccordionContent className="px-4 pb-4 pt-1">
                                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border/40">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Institution</Label>
                                    <Input
                                      {...form.register(`education.${index}.institution`)}
                                      placeholder="Stanford University"
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Degree</Label>
                                    <Input
                                      {...form.register(`education.${index}.degree`)}
                                      placeholder="Bachelor of Science"
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Field of Study</Label>
                                    <Input
                                      {...form.register(`education.${index}.fieldOfStudy`)}
                                      placeholder="Computer Science"
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Duration</Label>
                                    <Input
                                      {...form.register(`education.${index}.duration`)}
                                      placeholder="2018 - 2022"
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Location</Label>
                                    <Input
                                      {...form.register(`education.${index}.location`)}
                                      placeholder="Stanford, CA"
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">GPA (Optional)</Label>
                                    <Input
                                      {...form.register(`education.${index}.gpa`)}
                                      placeholder="3.8 / 4.0"
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    ) : (
                      <p className="text-xs font-medium text-muted-foreground text-center py-6 border border-dashed rounded-2xl border-border/60">
                        No education added yet. Click &quot;Add Education&quot; to start.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </ProfileSectionShell>
            </TabsContent>

            <TabsContent value="projects">
              <ProfileSectionShell>
                <Card className="border-0 bg-transparent shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <span className="mb-1 text-[11px] font-bold uppercase tracking-widest text-primary">Portfolio</span>
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={FolderIcon} strokeWidth={2.5} className="size-5 text-primary" />
                        <CardTitle className="text-xl font-bold">Projects</CardTitle>
                      </div>
                      <CardDescription>
                        Notable projects you have built or contributed to.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        appendProject({ name: "", description: "", link: "" })
                      }
                      className="rounded-xl font-semibold gap-1.5 shadow-sm"
                    >
                      <HugeiconsIcon icon={Add01Icon} strokeWidth={2.5} className="size-4" /> Add Project
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2">
                    {projectFields.length > 0 ? (
                      <Accordion type="multiple" defaultValue={projectFields.map((_, i) => `proj-${i}`)} className="space-y-3 border-0">
                        {projectFields.map((field, index) => {
                          const projName = form.watch(`projects.${index}.name`);

                          return (
                            <AccordionItem
                              key={field.id}
                              value={`proj-${index}`}
                              className="rounded-2xl border border-border/60 bg-card/60 p-1 shadow-2xs overflow-hidden"
                            >
                              <div className="flex items-center justify-between pr-3">
                                <AccordionTrigger className="p-4 hover:no-underline font-semibold text-sm">
                                  <div className="flex items-center gap-2.5 text-left">
                                    <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                                      {index + 1}
                                    </div>
                                    <span className="font-bold text-foreground">
                                      {projName || `Project ${index + 1}`}
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeProject(index);
                                  }}
                                  className="size-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                                >
                                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                                </Button>
                              </div>
                              <AccordionContent className="px-4 pb-4 pt-1">
                                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border/40">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Name</Label>
                                    <Input
                                      {...form.register(`projects.${index}.name`)}
                                      placeholder="AI Job Application Agent"
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">URL / Link</Label>
                                    <Input
                                      {...form.register(`projects.${index}.link`)}
                                      placeholder="https://github.com/..."
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-1.5 sm:col-span-2">
                                    <Label className="text-xs font-semibold">Description</Label>
                                    <Textarea
                                      rows={3}
                                      {...form.register(`projects.${index}.description`)}
                                      placeholder="Overview of technologies used and key outcomes..."
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    ) : (
                      <p className="text-xs font-medium text-muted-foreground text-center py-6 border border-dashed rounded-2xl border-border/60">
                        No projects added yet. Click &quot;Add Project&quot; to start.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </ProfileSectionShell>
            </TabsContent>

            <TabsContent value="certifications">
              <ProfileSectionShell>
                <Card className="border-0 bg-transparent shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <span className="mb-1 text-[11px] font-bold uppercase tracking-widest text-primary">Credentials</span>
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={Certificate01Icon} strokeWidth={2.5} className="size-5 text-primary" />
                        <CardTitle className="text-xl font-bold">Certifications</CardTitle>
                      </div>
                      <CardDescription>
                        Professional certifications and credentials.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        appendCert({ name: "", issuer: "", date: "", link: "" })
                      }
                      className="rounded-xl font-semibold gap-1.5 shadow-sm"
                    >
                      <HugeiconsIcon icon={Add01Icon} strokeWidth={2.5} className="size-4" /> Add Certification
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2">
                    {certFields.length > 0 ? (
                      <Accordion type="multiple" defaultValue={certFields.map((_, i) => `cert-${i}`)} className="space-y-3 border-0">
                        {certFields.map((field, index) => {
                          const certName = form.watch(`certifications.${index}.name`);

                          return (
                            <AccordionItem
                              key={field.id}
                              value={`cert-${index}`}
                              className="rounded-2xl border border-border/60 bg-card/60 p-1 shadow-2xs overflow-hidden"
                            >
                              <div className="flex items-center justify-between pr-3">
                                <AccordionTrigger className="p-4 hover:no-underline font-semibold text-sm">
                                  <div className="flex items-center gap-2.5 text-left">
                                    <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">
                                      {index + 1}
                                    </div>
                                    <span className="font-bold text-foreground">
                                      {certName || `Certification ${index + 1}`}
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeCert(index);
                                  }}
                                  className="size-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                                >
                                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                                </Button>
                              </div>
                              <AccordionContent className="px-4 pb-4 pt-1">
                                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border/40">
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Certification Name</Label>
                                    <Input
                                      {...form.register(`certifications.${index}.name`)}
                                      placeholder="AWS Certified Solutions Architect"
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Issuer</Label>
                                    <Input
                                      {...form.register(`certifications.${index}.issuer`)}
                                      placeholder="Amazon Web Services"
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Issue Date</Label>
                                    <Input
                                      {...form.register(`certifications.${index}.date`)}
                                      placeholder="2023"
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Credential Link</Label>
                                    <Input
                                      {...form.register(`certifications.${index}.link`)}
                                      placeholder="https://..."
                                      className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                                    />
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    ) : (
                      <p className="text-xs font-medium text-muted-foreground text-center py-6 border border-dashed rounded-2xl border-border/60">
                        No certifications added yet. Click &quot;Add Certification&quot; to start.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </ProfileSectionShell>
            </TabsContent>

            <TabsContent value="links">
              <ProfileSectionShell>
                <Card className="border-0 bg-transparent shadow-none">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <span className="mb-1 text-[11px] font-bold uppercase tracking-widest text-primary">Online</span>
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={LinkIcon} strokeWidth={2.5} className="size-5 text-primary" />
                        <CardTitle className="text-xl font-bold">Links & Social Profiles</CardTitle>
                      </div>
                      <CardDescription>
                        LinkedIn, GitHub, Personal Website, etc.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => appendLink({ label: "", url: "" })}
                      className="rounded-xl font-semibold gap-1.5 shadow-sm"
                    >
                      <HugeiconsIcon icon={Add01Icon} strokeWidth={2.5} className="size-4" /> Add Link
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2">
                    {linkFields.map((field, index) => (
                      <div key={field.id} className="flex items-end gap-3 rounded-2xl border border-border/60 bg-card/60 p-3">
                        <div className="grid flex-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Label</Label>
                            <Input
                              {...form.register(`links.${index}.label`)}
                              placeholder="e.g. LinkedIn"
                              className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">URL</Label>
                            <Input
                              {...form.register(`links.${index}.url`)}
                              placeholder="https://linkedin.com/in/..."
                              className="rounded-xl border-border bg-background/80 shadow-2xs focus-visible:border-primary"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLink(index)}
                          className="size-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                        >
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
                        </Button>
                      </div>
                    ))}
                    {linkFields.length === 0 && (
                      <p className="text-xs font-medium text-muted-foreground text-center py-6 border border-dashed rounded-2xl border-border/60">
                        No links added yet. Click &quot;Add Link&quot; to start.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </ProfileSectionShell>
            </TabsContent>
          </div>

          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6">
              <ProfileCompletenessCard
                data={watchedData}
                onGenerateComplete={(generated) => {
                  form.reset(generated)
                  setSaveMessage("AI-generated sections added. Review and save.");
                }}
              />
            </div>
          </div>
        </div>
      </Tabs>

      <div className="sticky bottom-6 z-20 mx-auto flex w-max items-center gap-4 rounded-full bg-background/90 p-2 pr-3 shadow-xl shadow-black/10 ring-1 ring-border/80 backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:shadow-black/40">
        {saveMessage && (
          <p
            className={cn(
              "pl-3 text-xs font-bold",
              saveMessage.startsWith("Error")
                ? "text-destructive"
                : "text-primary",
            )}
          >
            {saveMessage}
          </p>
        )}
        <Button
          type="submit"
          disabled={isSaving}
          size="lg"
          className="group relative rounded-full pl-6 pr-2.5 font-bold text-xs shadow-md transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]"
        >
          <span className="mr-3">{isSaving ? "Saving..." : "Save Profile"}</span>
          <span className="flex size-7 items-center justify-center rounded-full bg-black/10 transition-all duration-300 group-hover:translate-x-0.5 group-hover:scale-105 dark:bg-white/15">
            <HugeiconsIcon icon={FloppyDiskIcon} strokeWidth={2.5} className="size-4" />
          </span>
        </Button>
      </div>
    </form>
  );
}
