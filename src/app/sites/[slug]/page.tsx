import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApplyForm } from "./ApplyForm";

type School = {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  about: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
};

type Post = { id: string; title: string; body: string | null; image_url: string | null; published_at: string };

export default async function SchoolSite({ params }: { params: { slug: string } }) {
  const supabase = createClient();
  const { data: school } = await supabase
    .from("schools")
    .select("id, name, logo_url, primary_color, secondary_color, about, address, phone, email")
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

  return (
    <div className="min-h-screen bg-white">
      <header style={{ backgroundColor: school.primary_color }} className="text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-5">
          {school.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logo_url} alt="" className="h-14 w-14 rounded-lg bg-white object-contain p-1" />
          )}
          <h1 className="text-2xl font-semibold">{school.name}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-4 py-10">
        <section>
          <h2 className="text-xl font-semibold" style={{ color: school.primary_color }}>About us</h2>
          <p className="mt-3 whitespace-pre-line text-slate-700">{school.about ?? `Welcome to ${school.name}.`}</p>
        </section>

        {news && news.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold" style={{ color: school.primary_color }}>Latest news</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {news.map((n) => (
                <article key={n.id} className="card">
                  <p className="text-xs text-slate-500">{new Date(n.published_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</p>
                  <h3 className="mt-1 font-semibold">{n.title}</h3>
                  {n.body && <p className="mt-2 line-clamp-3 text-sm text-slate-600">{n.body}</p>}
                </article>
              ))}
            </div>
          </section>
        )}

        <section id="admissions" className="card">
          <h2 className="text-xl font-semibold" style={{ color: school.primary_color }}>Apply for admission</h2>
          <p className="mb-5 mt-1 text-sm text-slate-600">Fill in this form and the school will contact you.</p>
          <ApplyForm schoolId={school.id} color={school.secondary_color} />
        </section>

        <section>
          <h2 className="text-xl font-semibold" style={{ color: school.primary_color }}>Contact</h2>
          <div className="mt-3 space-y-1 text-sm text-slate-700">
            {school.address && <p>{school.address}</p>}
            {school.phone && <p>{school.phone}</p>}
            {school.email && <p>{school.email}</p>}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        Powered by Simpliskool · Simplifying school management
      </footer>
    </div>
  );
}
