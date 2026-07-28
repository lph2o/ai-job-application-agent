"use client"

import { createClient } from "./client"

export interface UploadProgressEvent {
  loaded: number
  total: number
  percentage: number
}

export interface UploadWithProgressOptions {
  bucket: string
  path: string
  file: File
  onProgress?: (event: UploadProgressEvent) => void
}

export async function uploadFileWithProgress({
  bucket,
  path,
  file,
  onProgress,
}: UploadWithProgressOptions): Promise<{ path: string }> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error("Unauthorized")
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase configuration missing")
  }

  const url = new URL(
    `/storage/v1/object/${bucket}/${path}`,
    supabaseUrl
  ).toString()

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && onProgress) {
        const percentage = Math.round((event.loaded / event.total) * 100)
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage,
        })
      }
    })

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          resolve({ path: response.Key || `${bucket}/${path}` })
        } catch {
          resolve({ path: `${bucket}/${path}` })
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`))
      }
    })

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed due to network error"))
    })

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload aborted"))
    })

    xhr.open("POST", url)
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`)
    xhr.setRequestHeader("apikey", supabaseKey)
    xhr.setRequestHeader("x-upsert", "false")
    xhr.setRequestHeader("Content-Type", file.type)
    xhr.send(file)
  })
}
