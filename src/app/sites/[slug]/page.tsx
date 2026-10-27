import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SchoolSiteView, type Post, type School } from "./SchoolSiteView";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.from("schools").select("name, about").eq("slug", params.slug).maybeSingle<{ name: string; about: string | null }>();
  return { title: data ? `${data.name}` : "School", description: data?.about?.slice(0, 160) ?? undefined };
}

export default async function SchoolSite(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: school } = await supabase
    .from("schools")
    .select("id, name, slug, logo_url, primary_color, secondary_color, about, address, phone, email")
    .eq("slug", params.slug)
    .eq("status", "active")
    .maybeSingle<School>();
  if (!school) notFound();

  const { data: news } = await supabase
    .from("website_posts")
    .select("id, title, body, image_url, published_at")
    .eq("school_id", school.id)
    .eq("kind", "news")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(3)
    .returns<Post[]>();

  return <SchoolSiteView school={school} news={news ?? []} />;
}

