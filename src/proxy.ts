import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { schoolSlugFromHost } from "@/lib/tenant";

export async function proxy(request: NextRequest) {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com";
  const slug = schoolSlugFromHost(request.headers.get("host"), rootDomain);

  // School subdomains serve that school's public website.
  if (slug) {
    const url = request.nextUrl.clone();
    url.pathname = `/sites/${slug}${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;
    return NextResponse.rewrite(url);
  }

  return updateSession(request, NextResponse.next({ request }));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
