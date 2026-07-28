import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] focus-visible:ring-2 focus-visible:ring-primary/20 dark:border-white/15 dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.03)] dark:focus-visible:border-white/20 dark:focus-visible:shadow-[inset_0_2px_4px_rgba(255,255,255,0.05)] dark:focus-visible:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm/relaxed dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
