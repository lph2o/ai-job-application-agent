import { GoogleGenAI } from "@google/genai"
import { extractRawText } from "mammoth"
import { ResumeProfileSchema } from "./schema"

// The user selected this model name. If it ever becomes unavailable, swap to a
// known valid value such as "gemini-2.0-flash-lite" or "gemini-1.5-flash".
const MODEL = process.env.GEMINI_MODEL_NAME ?? "gemini-3.1-flash-lite"

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured")
  }
  return new GoogleGenAI({ apiKey })
}

const RESUME_PROMPT = `You are an expert resume parser. Extract the following information from the resume text and return ONLY valid JSON matching this schema exactly. Use null or empty arrays where information is missing. Do not include markdown, explanations, or code fences.

{
  "fullName": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "title": "string or null",
  "summary": "string or null",
  "skills": ["array of strings"],
  "workExperience": [
    {
      "company": "string",
      "title": "string",
      "duration": "string or null",
      "location": "string or null",
      "responsibilities": ["array of strings"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string or null",
      "fieldOfStudy": "string or null",
      "duration": "string or null",
      "location": "string or null",
      "gpa": "string or null"
    }
  ],
  "projects": [
    {
      "name": "string",
      "description": "string or null",
      "link": "string or null"
    }
  ],
  "certifications": [
    {
      "name": "string",
      "issuer": "string or null",
      "date": "string or null",
      "link": "string or null"
    }
  ],
  "links": [
    {
      "label": "string (e.g. LinkedIn, Portfolio, GitHub)",
      "url": "string"
    }
  ]
}

Resume text:`

async function extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "text/plain") {
    return buffer.toString("utf-8")
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  ) {
    const result = await extractRawText({ buffer })
    return result.value
  }

  throw new Error("Unsupported file type. Please upload a PDF or DOCX file.")
}

async function parseWithGemini(text: string) {
  const client = getGeminiClient()

  const result = await client.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [{ text: `${RESUME_PROMPT}\n\n${text}` }],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  })

  const responseText = result.text ?? ""
  let json: unknown
  try {
    json = JSON.parse(responseText)
  } catch {
    throw new Error("Failed to parse resume. The AI response was not valid JSON.")
  }

  return ResumeProfileSchema.parse(json)
}

export async function parseResumeBuffer(
  buffer: Buffer,
  mimeType: string
) {
  if (mimeType === "application/pdf") {
    const client = getGeminiClient()

    const result = await client.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: buffer.toString("base64"),
                mimeType: "application/pdf",
              },
            },
            { text: RESUME_PROMPT },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    })

    const responseText = result.text ?? ""
    let json: unknown
    try {
      json = JSON.parse(responseText)
    } catch {
      throw new Error("Failed to parse resume. The AI response was not valid JSON.")
    }

    return ResumeProfileSchema.parse(json)
  }

  const text = await extractTextFromBuffer(buffer, mimeType)
  return parseWithGemini(text)
}

