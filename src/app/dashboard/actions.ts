"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { homeForRole, SCHOOL_COOKIE, type Role } from "@/lib/auth";

export async function chooseSchool(formData: FormData) {
  const schoolId = String(formData.get("school_id"));
  const role = String(formData.get("role")) as Role;
  (await cookies()).set(SCHOOL_COOKIE, schoolId, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 180 });
  redirect(homeForRole(role));
}
