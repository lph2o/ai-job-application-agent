"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ProfileCompletenessCard } from "@/components/profile/profile-completeness-card";
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs
            defaultValue="personal"
            orientation="vertical"
            className="flex-col gap-6 lg:flex-row"
          >
            {/* Outer Bezel for Tabs */}
            <div className="h-fit w-full rounded-2xl bg-muted/30 p-1.5 ring-1 ring-black/5 dark:ring-white/10 lg:w-56">
              <TabsList className="h-fit w-full flex-col items-stretch rounded-xl bg-background/80 p-1.5">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.key}
                    value={tab.key}
                    className="w-full justify-start gap-2.5 px-3 py-2.5 text-sm font-medium data-active:bg-primary/10 data-active:text-primary data-active:shadow-none"
                  >
                    <HugeiconsIcon icon={tab.icon} strokeWidth={2} className="size-4" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="flex-1">
              <TabsContent value="personal">
                <div className="overflow-hidden rounded-2xl bg-muted/30 p-1.5 ring-1 ring-black/5 dark:ring-white/10">
                  <Card className="rounded-xl border-0 bg-background shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                    <CardHeader>
                      <span className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Basics</span>
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={UserIcon} strokeWidth={2} className="size-5 text-primary" />
                        <CardTitle>Personal Information</CardTitle>
                      </div>
                      <CardDescription>
                        Basic details and contact information.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input id="fullName" {...form.register("fullName")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="title">Professional Title</Label>
                      <Input id="title" {...form.register("title")} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        {...form.register("email")}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone</Label>
                      <Input id="phone" {...form.register("phone")} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="location">Location</Label>
                      <Input id="location" {...form.register("location")} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="summary">Professional Summary</Label>
                      <Textarea
                        id="summary"
                        rows={4}
                        {...form.register("summary")}
                      />
                    </div>
                  </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="skills">
                <div className="overflow-hidden rounded-2xl bg-muted/30 p-1.5 ring-1 ring-black/5 dark:ring-white/10">
                  <Card className="rounded-xl border-0 bg-background shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                  <CardHeader>
                      <span className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Expertise</span>
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={WrenchIcon} strokeWidth={2} className="size-5 text-primary" />
                      <CardTitle>Skills</CardTitle>
                    </div>
                    <CardDescription>
                      Comma-separated list of skills.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Controller
                      control={form.control}
                      name="skills"
                      render={({ field }) => (
                        <Input
                          value={tagsToString(field.value)}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            )
                          }
                          placeholder="e.g. React, TypeScript, Node.js"
                        />
                      )}
                    />
                  </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="workExperience">
                <div className="overflow-hidden rounded-2xl bg-muted/30 p-1.5 ring-1 ring-black/5 dark:ring-white/10">
                  <Card className="rounded-xl border-0 bg-background shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <span className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Career</span>
                      <div className="flex items-center gap-2"><HugeiconsIcon icon={BriefcaseIcon} strokeWidth={2} className="size-5 text-primary" />
                        <CardTitle>Work Experience</CardTitle>
                      </div>
                      <CardDescription>
                        Add your roles and responsibilities.
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
                    >
                      <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1 size-3" /> Add Role
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {workFields.map((field, index) => (
                      <div key={field.id} className="rounded-lg border p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-sm font-medium">
                            Role {index + 1}
                          </h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeWork(index)}
                          >
                            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Company</Label>
                            <Input
                              {...form.register(
                                `workExperience.${index}.company`,
                              )}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Job Title</Label>
                            <Input
                              {...form.register(
                                `workExperience.${index}.title`,
                              )}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Duration</Label>
                            <Input
                              {...form.register(
                                `workExperience.${index}.duration`,
                              )}
                              placeholder="e.g. Jan 2020 - Present"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Location</Label>
                            <Input
                              {...form.register(
                                `workExperience.${index}.location`,
                              )}
                            />
                          </div>
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label>Responsibilities</Label>
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
                                  placeholder="One responsibility per line"
                                />
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {workFields.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No work experience added yet. Click &quot;Add Role&quot;
                        to start.
                      </p>
                    )}
                  </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="education">
                <div className="overflow-hidden rounded-2xl bg-muted/30 p-1.5 ring-1 ring-black/5 dark:ring-white/10">
                  <Card className="rounded-xl border-0 bg-background shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <span className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Academic</span>
                      <div className="flex items-center gap-2"><HugeiconsIcon icon={GraduationCapIcon} strokeWidth={2} className="size-5 text-primary" />
                        <CardTitle>Education</CardTitle>
                      </div>
                      <CardDescription>
                        Degrees, diplomas, and institutions.
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
                    >
                      <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1 size-3" /> Add Education
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {eduFields.map((field, index) => (
                      <div key={field.id} className="rounded-lg border p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-sm font-medium">
                            Education {index + 1}
                          </h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeEdu(index)}
                          >
                            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Institution</Label>
                            <Input
                              {...form.register(
                                `education.${index}.institution`,
                              )}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Degree</Label>
                            <Input
                              {...form.register(`education.${index}.degree`)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Field of Study</Label>
                            <Input
                              {...form.register(
                                `education.${index}.fieldOfStudy`,
                              )}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Duration</Label>
                            <Input
                              {...form.register(`education.${index}.duration`)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Location</Label>
                            <Input
                              {...form.register(`education.${index}.location`)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>GPA</Label>
                            <Input
                              {...form.register(`education.${index}.gpa`)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {eduFields.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No education added yet. Click &quot;Add Education&quot;
                        to start.
                      </p>
                    )}
                  </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="projects">
                <div className="overflow-hidden rounded-2xl bg-muted/30 p-1.5 ring-1 ring-black/5 dark:ring-white/10">
                  <Card className="rounded-xl border-0 bg-background shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <span className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Portfolio</span>
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={FolderIcon} strokeWidth={2} className="size-5 text-primary" />
                        <CardTitle>Projects</CardTitle>
                      </div>
                      <CardDescription>
                        Notable projects you have worked on.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        appendProject({ name: "", description: "", link: "" })
                      }
                    >
                      <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1 size-3" /> Add Project
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {projectFields.map((field, index) => (
                      <div key={field.id} className="rounded-lg border p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-sm font-medium">
                            Project {index + 1}
                          </h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeProject(index)}
                          >
                            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Name</Label>
                            <Input
                              {...form.register(`projects.${index}.name`)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Link</Label>
                            <Input
                              {...form.register(`projects.${index}.link`)}
                            />
                          </div>
                          <div className="space-y-1.5 sm:col-span-2">
                            <Label>Description</Label>
                            <Textarea
                              rows={3}
                              {...form.register(
                                `projects.${index}.description`,
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {projectFields.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No projects added yet. Click &quot;Add Project&quot; to
                        start.
                      </p>
                    )}
                  </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="certifications">
                <div className="overflow-hidden rounded-2xl bg-muted/30 p-1.5 ring-1 ring-black/5 dark:ring-white/10">
                  <Card className="rounded-xl border-0 bg-background shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <span className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Credentials</span>
                      <div className="flex items-center gap-2"><HugeiconsIcon icon={Certificate01Icon} strokeWidth={2} className="size-5 text-primary" />
                        <CardTitle>Certifications</CardTitle>
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
                    >
                      <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1 size-3" /> Add Certification
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {certFields.map((field, index) => (
                      <div key={field.id} className="rounded-lg border p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-sm font-medium">
                            Certification {index + 1}
                          </h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeCert(index)}
                          >
                            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label>Name</Label>
                            <Input
                              {...form.register(`certifications.${index}.name`)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Issuer</Label>
                            <Input
                              {...form.register(
                                `certifications.${index}.issuer`,
                              )}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Date</Label>
                            <Input
                              {...form.register(`certifications.${index}.date`)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Link</Label>
                            <Input
                              {...form.register(`certifications.${index}.link`)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {certFields.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No certifications added yet. Click &quot;Add
                        Certification&quot; to start.
                      </p>
                    )}
                  </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="links">
                <div className="overflow-hidden rounded-2xl bg-muted/30 p-1.5 ring-1 ring-black/5 dark:ring-white/10">
                  <Card className="rounded-xl border-0 bg-background shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <span className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">Online</span>
                      <div className="flex items-center gap-2"><HugeiconsIcon icon={LinkIcon} strokeWidth={2} className="size-5 text-primary" />
                        <CardTitle>Links</CardTitle>
                      </div>
                      <CardDescription>
                        LinkedIn, portfolio, GitHub, and other links.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => appendLink({ label: "", url: "" })}
                    >
                      <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="mr-1 size-3" /> Add Link
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {linkFields.map((field, index) => (
                      <div key={field.id} className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label>Label</Label>
                          <Input
                            {...form.register(`links.${index}.label`)}
                            placeholder="e.g. LinkedIn"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>URL</Label>
                          <Input
                            {...form.register(`links.${index}.url`)}
                            placeholder="https://..."
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeLink(index)}
                          >
                            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {linkFields.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No links added yet. Click &quot;Add Link&quot; to start.
                      </p>
                    )}
                  </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-6">
            <ProfileCompletenessCard data={watchedData} />
          </div>
        </div>
      </div>

      <div className="sticky bottom-6 z-20 mx-auto flex w-max items-center gap-4 rounded-full bg-background/80 p-1.5 pr-2.5 shadow-lg shadow-black/5 ring-1 ring-black/10 backdrop-blur-md transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:ring-white/10 dark:shadow-black/20">
        {saveMessage && (
          <p
            className={cn(
              "pl-3 text-sm font-medium",
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
          className="group relative rounded-full pl-5 pr-2 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97]"
        >
          <span className="mr-3">{isSaving ? "Saving..." : "Save Profile"}</span>
          <span className="flex size-7 items-center justify-center rounded-full bg-black/10 transition-all duration-300 group-hover:translate-x-0.5 group-hover:scale-105 dark:bg-white/15">
            <HugeiconsIcon icon={FloppyDiskIcon} strokeWidth={2} className="size-3.5" />
          </span>
        </Button>
      </div>
    </form>
  );
}
