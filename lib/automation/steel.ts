import { Steel } from "steel-sdk"

export interface SteelSessionInfo {
  sessionId: string
  websocketUrl: string
  debugUrl?: string
}

function getClient(): Steel | null {
  const apiKey = process.env.STEEL_API_KEY
  if (!apiKey) {
    console.warn("[Steel] STEEL_API_KEY not set.")
    return null
  }
  return new Steel({ steelAPIKey: apiKey })
}

export async function createSteelSession(): Promise<SteelSessionInfo | null> {
  const client = getClient()
  if (!client) return null

  try {
    const session = await client.sessions.create()

    const debugUrl = session.id
      ? `https://app.steel.dev/sessions/${session.id}?interactive=true&showControls=true`
      : undefined

    return {
      sessionId: session.id,
      websocketUrl: session.websocketUrl,
      debugUrl,
    }
  } catch (err) {
    console.error("[Steel] Error creating session:", err)
    return null
  }
}

/**
 * Retrieve an existing Steel session by ID (for reconnection).
 */
export async function getSteelSession(sessionId: string): Promise<SteelSessionInfo | null> {
  const client = getClient()
  if (!client) return null

  try {
    const session = await client.sessions.retrieve(sessionId)
    if (!session) return null

    return {
      sessionId: session.id,
      websocketUrl: session.websocketUrl,
      debugUrl: `https://app.steel.dev/sessions/${session.id}?interactive=true&showControls=true`,
    }
  } catch (err) {
    console.warn("[Steel] Error retrieving session:", err)
    return null
  }
}

export async function releaseSteelSession(sessionId: string): Promise<void> {
  const client = getClient()
  if (!client) return

  try {
    await client.sessions.release(sessionId)
    console.log(`[Steel] Session released: ${sessionId}`)
  } catch (err) {
    console.warn("[Steel] Error releasing session:", err)
  }
}
