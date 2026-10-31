import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SCHOOL_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.cookies.delete(SCHOOL_COOKIE);
  response.cookies.delete("sk_2fa");
  response.cookies.delete("sk_view");
  response.cookies.delete("sk_group");
  return response;
}
