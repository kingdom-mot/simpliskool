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
  const cols = "id, name, slug, logo_url, primary_color, secondary_color, about, address, phone, email";
  const find = (c: string) => supabase.from("schools").select(c).eq("slug", params.slug).eq("status", "active").maybeSingle<School>();
  const first = await find(`${cols}, motto, website`);
  // Before the newer database files are run, those columns are missing; still show the site.
  const school = first.error ? (await find(cols)).data : first.data;
  if (!school) notFound();

  const posts = (kind: string, n: number) =>
    supabase.from("website_posts").select("*").eq("school_id", school.id).eq("kind", kind).not("published_at", "is", null).order("published_at", { ascending: false }).limit(n).returns<Post[]>();
  const [{ data: news }, { data: gallery }] = await Promise.all([posts("news", 6), posts("gallery", 12)]);

  return <SchoolSiteView school={school} news={news ?? []} gallery={gallery ?? []} />;
}

