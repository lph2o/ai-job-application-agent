import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const publicRoutes = ["/", "/sign-in", "/sign-up"]
const authRoutes = ["/sign-in", "/sign-up"]

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data } = await supabase.auth.getClaims()
  const user = data?.claims
  const { pathname } = request.nextUrl

  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/inngest")
  const isAuthRoute = authRoutes.includes(pathname)
  const isProtectedRoute = pathname.startsWith("/dashboard")

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/sign-in"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    url.search = ""
    return NextResponse.redirect(url)
  }

  if (!user && !isPublicRoute && !pathname.startsWith("/auth")) {
    const url = request.nextUrl.clone()
    url.pathname = "/sign-in"
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
