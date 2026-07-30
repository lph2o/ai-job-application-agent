import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest/client"
import { detectJobFieldsFunction } from "@/lib/inngest/functions/detect-fields"
import { submitJobApplicationFunction } from "@/lib/inngest/functions/submit-application"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    detectJobFieldsFunction,
    submitJobApplicationFunction,
  ],
})
