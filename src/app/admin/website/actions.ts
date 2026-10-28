"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setFlash } from "@/lib/flash";
import { z } from "zod";
import type { ActionState } from "@/components/forms";
import { requireSchool } from "@/lib/auth";
import { removeSchoolImage, uploadSchoolImage } from "@/lib/upload";
import { asWebsite, type SitePage, type Website } from "@/lib/website";

const ADMINS = ["owner", "admin"] as const;
const uuid = z.string().uuid();

async function current() {
  const ctx = await requireSchool([...ADMINS]);
  const { data } = await ctx.supabase.from("schools").select("website, slug").eq("id", ctx.school.id).single<{ website: unknown; slug: string }>();
  return { ctx, w: asWebsite(data?.website), slug: data?.slug ?? ctx.school.slug };
}
async function save(ctx: Awaited<ReturnType<typeof requireSchool>>, slug: string, w: Website) {
  const { error } = await ctx.supabase.from("schools").update({ website: w }).eq("id", ctx.school.id);
  revalidatePath("/admin/website");
  revalidatePath(`/sites/${slug}`);
  return error;
}
const clean = (v: FormDataEntryValue | null, n: number) => String(v ?? "").trim().slice(0, n);

export async function togglePage(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, w, slug } = await current();
  const page = String(fd.get("page")) as SitePage;
  if (!["about", "admissions", "news", "gallery", "contact"].includes(page)) return { error: "Something went wrong." };
  const on = fd.get("on") === "1";
  const err = await save(ctx, slug, { ...w, pages: { ...w.pages, [page]: on } });
  if (err) return { error: "We couldn't save." };
  return { ok: true, message: on ? "Page shown on your website." : "Page hidden from visitors.", at: Date.now() };
}

export async function saveHome(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, w, slug } = await current();
  const next: Website = { ...w, headline: clean(fd.get("headline"), 120) || undefined, intro: clean(fd.get("intro"), 600) || undefined };
  const photo = fd.get("photo");
  const alt = clean(fd.get("hero_alt"), 200);
  if (photo instanceof File && photo.size > 0) {
    if (alt.length < 3) return { error: "Describe the photo for people who can't see it, like \"Students in the science lab\"." };
    const up = await uploadSchoolImage(photo, ctx.school.id, "hero");
    if ("error" in up) return { error: up.error };
    await removeSchoolImage(w.hero_url, ctx.school.id);
    next.hero_url = up.url;
  }
  if (next.hero_url) {
    if (alt.length < 3) return { error: "Describe the photo for people who can't see it." };
    next.hero_alt = alt;
  }
  if (fd.get("remove_photo") === "1") {
    await removeSchoolImage(w.hero_url, ctx.school.id);
    delete next.hero_url;
    delete next.hero_alt;
  }
  const err = await save(ctx, slug, next);
  if (err) return { error: "We couldn't save." };
  return { ok: true, message: "Home page saved. It's live on your website.", at: Date.now() };
}

export async function saveAbout(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, w, slug } = await current();
  const highlights = [0, 1, 2]
    .map((i) => ({ title: clean(fd.get(`h_title_${i}`), 60), text: clean(fd.get(`h_text_${i}`), 240) }))
    .filter((h) => h.title);
  const err = await save(ctx, slug, { ...w, about_text: clean(fd.get("about_text"), 4000) || undefined, highlights: highlights.length ? highlights : undefined });
  if (err) return { error: "We couldn't save." };
  return { ok: true, message: "About us saved.", at: Date.now() };
}

export async function saveAdmissions(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { ctx, w, slug } = await current();
  const classes = [...new Set(fd.getAll("classes").map((c) => String(c).trim().slice(0, 40)).filter(Boolean))].slice(0, 30);
  const err = await save(ctx, slug, { ...w, admissions_open: fd.get("open") === "1", admission_classes: classes, admission_requirements: clean(fd.get("requirements"), 600) || undefined });
  if (err) return { error: "We couldn't save." };
  return { ok: true, message: fd.get("open") === "1" ? "Admissions are open on your website." : "Admissions are closed: the form is hidden.", at: Date.now() };
}

export async function savePost(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireSchool([...ADMINS]);
  const kind = fd.get("kind") === "gallery" ? "gallery" : "news";
  const title = clean(fd.get("title"), 160);
  const body = clean(fd.get("body"), 8000);
  const alt = clean(fd.get("image_alt"), 200);
  const album = clean(fd.get("album"), 80);
  if (kind === "news" && title.length < 3) return { error: "Give the post a title." };
  const photo = fd.get("photo");
  let image: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    if (alt.length < 3) return { error: "Describe the photo for people who can't see it." };
    const up = await uploadSchoolImage(photo, ctx.school.id, kind);
    if ("error" in up) return { error: up.error };
    image = up.url;
  }
  if (kind === "gallery" && !image) return { error: "Choose a photo to add." };
  const publish = kind === "gallery" || fd.get("publish") === "1";
  const { error } = await ctx.supabase.from("website_posts").insert({
    school_id: ctx.school.id,
    kind,
    title: kind === "gallery" ? title || alt.slice(0, 160) : title,
    body: body || null,
    image_url: image,
    image_alt: image ? alt : null,
    album: album || null,
    published_at: publish ? new Date().toISOString() : null,
  });
  if (error) {
    await removeSchoolImage(image, ctx.school.id);
    return { error: "We couldn't save it. Please try again." };
  }
  revalidatePath("/admin/website");
  revalidatePath(`/sites/${ctx.school.slug}`);
  return { ok: true, message: kind === "gallery" ? "Photo added to the gallery." : publish ? "Post published on your website." : "Draft saved.", at: Date.now() };
}

export async function setPostPublished(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireSchool([...ADMINS]);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const on = fd.get("on") === "1";
  const { error } = await ctx.supabase.from("website_posts").update({ published_at: on ? new Date().toISOString() : null }).eq("id", id.data).eq("school_id", ctx.school.id);
  if (error) return { error: "We couldn't save." };
  revalidatePath("/admin/website");
  revalidatePath(`/sites/${ctx.school.slug}`);
  return { ok: true, message: on ? "Published." : "Moved back to drafts.", at: Date.now() };
}

export async function deletePost(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireSchool([...ADMINS]);
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return { error: "Something went wrong." };
  const { data } = await ctx.supabase.from("website_posts").delete().eq("id", id.data).eq("school_id", ctx.school.id).select("image_url, kind");
  if (!data?.length) return { error: "We couldn't delete it." };
  await removeSchoolImage(data[0].image_url, ctx.school.id);
  revalidatePath("/admin/website");
  revalidatePath(`/sites/${ctx.school.slug}`);
  // The deleted item disappears from the list, so the confirmation is shown on the page.
  await setFlash(data[0].kind === "gallery" ? "Photo deleted." : "Post deleted.", "/admin/website");
  redirect(`/admin/website?page=${data[0].kind === "gallery" ? "gallery" : "news"}`);
}
