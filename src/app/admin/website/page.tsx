import Link from "next/link";
import { AdminPage, Panel, requireAdminPage } from "@/components/admin";
import { Flash } from "@/components/Flash";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Empty, Pill } from "@/components/ui";
import { SECTIONS } from "@/lib/nigeria";
import { DEFAULT_HIGHLIGHTS, SITE_PAGES, asWebsite, pageOn, type SitePage } from "@/lib/website";
import { deletePost, saveAbout, saveAdmissions, saveHome, savePost, setPostPublished, togglePage } from "./actions";

export const metadata = { title: "School website" };

type Post = { id: string; kind: "news" | "gallery"; title: string; body: string | null; image_url: string | null; image_alt: string | null; album: string | null; published_at: string | null; created_at: string };

export default async function WebsiteEditor(props: { searchParams: Promise<{ page?: string }> }) {
  const sp = await props.searchParams;
  const ctx = await requireAdminPage(["owner", "admin"]);
  const { supabase, school } = ctx;
  const [{ data: s }, { data: posts }, { count: newApps }, { data: classRows }] = await Promise.all([
    supabase.from("schools").select("website, about").eq("id", school.id).single<{ website: unknown; about: string | null }>(),
    supabase.from("website_posts").select("id, kind, title, body, image_url, image_alt, album, published_at, created_at").eq("school_id", school.id).order("created_at", { ascending: false }).returns<Post[]>(),
    supabase.from("admission_applications").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("status", "new"),
    supabase.from("classes").select("name").eq("school_id", school.id).returns<{ name: string }[]>(),
  ]);
  const w = asWebsite(s?.website);
  const page = SITE_PAGES.find((p) => p.key === sp.page)?.key ?? "home";
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com";
  const live = `${school.slug}.${rootDomain}`;
  const news = (posts ?? []).filter((p) => p.kind === "news");
  const gallery = (posts ?? []).filter((p) => p.kind === "gallery");
  const levels = [...new Set([...SECTIONS.flatMap((x) => x.classes), ...(classRows ?? []).map((c) => c.name.trim())])];
  const offered = w.admission_classes ?? [];
  const hl = w.highlights?.length ? w.highlights : DEFAULT_HIGHLIGHTS;
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" });

  return (
    <AdminPage
      ctx={ctx}
      active="website"
      crumb={[{ label: "Communication" }]}
      title="School website"
      actions={
        <a className="s-btn" href={`https://${live}`}>
          Preview site
        </a>
      }
    >
      <Flash />
      <p className="-mt-2 text-sm text-brand-slate">
        Live at <strong>{live}</strong> · changes show on your website as soon as you save.
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <section aria-labelledby="pages-h" className="flex flex-col gap-2 rounded-[18px] border border-[#E3EAF3] bg-white p-3">
          <h2 id="pages-h" className="px-1 text-base !text-c1">
            Pages
          </h2>
          <ul className="flex flex-col gap-1">
            {SITE_PAGES.map((p) => {
              const on = p.key === "home" || pageOn(w, p.key as SitePage);
              return (
                <li key={p.key} className={`flex items-center justify-between gap-2 rounded-xl px-2 py-1 ${page === p.key ? "bg-brand-cloud" : ""}`}>
                  <Link href={`/admin/website?page=${p.key}`} aria-current={page === p.key ? "page" : undefined} className={`flex min-h-[44px] flex-1 items-center text-sm ${page === p.key ? "font-extrabold text-c1" : "font-semibold text-brand-slate"}`}>
                    {p.label}
                  </Link>
                  {p.key !== "home" && (
                    <ActionForm action={togglePage}>
                      <input type="hidden" name="page" value={p.key} />
                      <input type="hidden" name="on" value={on ? "0" : "1"} />
                      <button role="switch" aria-checked={on} aria-label={`Show ${p.label} on the website`} className={`relative h-7 w-12 rounded-full transition ${on ? "bg-c2" : "bg-[#6B7A90]"}`}>
                        <span aria-hidden="true" className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`} />
                      </button>
                    </ActionForm>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="px-1 text-[13px] text-[#4A5A70]">Switch a page off to hide it from visitors.</p>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          {page === "home" && (
            <Panel id="home-h" title="Home">
              <ActionForm action={saveHome} className="flex flex-col gap-3">
                <div>
                  <label className="label" htmlFor="w-head">
                    Headline
                  </label>
                  <input id="w-head" name="headline" className="sk-input" maxLength={120} defaultValue={w.headline ?? ""} placeholder={school.name} />
                </div>
                <div>
                  <label className="label" htmlFor="w-intro">
                    Introduction
                  </label>
                  <textarea id="w-intro" name="intro" rows={4} maxLength={600} className="sk-input py-3" defaultValue={w.intro ?? s?.about ?? ""} />
                </div>
                <fieldset className="flex flex-col gap-2 rounded-xl border border-[#E3EAF3] p-3">
                  <legend className="label">Main photo</legend>
                  {w.hero_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.hero_url} alt={w.hero_alt ?? ""} className="max-h-48 w-full max-w-md rounded-xl object-cover" />
                  )}
                  <label className="label" htmlFor="w-photo">
                    {w.hero_url ? "Change photo" : "Add a photo"} (PNG, JPG or WebP, up to 3 MB)
                  </label>
                  <input id="w-photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
                  <label className="label" htmlFor="w-alt">
                    Photo description (for screen readers)
                  </label>
                  <input id="w-alt" name="hero_alt" className="sk-input" maxLength={200} defaultValue={w.hero_alt ?? ""} placeholder="e.g. Students in the science lab" />
                  {w.hero_url && (
                    <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" name="remove_photo" value="1" className="h-5 w-5" /> Remove the photo
                    </label>
                  )}
                </fieldset>
                <div>
                  <SubmitButton pending="Saving…">Save home page</SubmitButton>
                </div>
              </ActionForm>
            </Panel>
          )}

          {page === "about" && (
            <Panel id="about-h" title="About us">
              <ActionForm action={saveAbout} className="flex flex-col gap-3">
                <div>
                  <label className="label" htmlFor="w-about">
                    Page text
                  </label>
                  <span id="w-about-h" className="mb-1 block text-[13px] text-[#4A5A70]">
                    Your school&apos;s story, mission, values and facilities.
                  </span>
                  <textarea id="w-about" name="about_text" rows={8} maxLength={4000} aria-describedby="w-about-h" className="sk-input py-3" defaultValue={w.about_text ?? ""} />
                </div>
                <fieldset className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-3">
                  <legend className="label">Three reasons families choose you</legend>
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex flex-col gap-2 rounded-xl bg-brand-cloud p-3">
                      <label className="label" htmlFor={`h-t-${i}`}>
                        Reason {i + 1}
                      </label>
                      <input id={`h-t-${i}`} name={`h_title_${i}`} className="sk-input" maxLength={60} defaultValue={hl[i]?.title ?? ""} />
                      <label className="sr-only" htmlFor={`h-x-${i}`}>
                        Reason {i + 1} details
                      </label>
                      <textarea id={`h-x-${i}`} name={`h_text_${i}`} rows={3} maxLength={240} className="sk-input py-2" defaultValue={hl[i]?.text ?? ""} />
                    </div>
                  ))}
                </fieldset>
                <div>
                  <SubmitButton>Save about us</SubmitButton>
                </div>
              </ActionForm>
            </Panel>
          )}

          {page === "admissions" && (
            <Panel id="adm-h" title="Admissions" actions={<Link className="s-btn2" href="/admin/admissions">See applications{newApps ? ` (${newApps} new)` : ""}</Link>}>
              <ActionForm action={saveAdmissions} className="flex flex-col gap-3">
                <label className="flex min-h-[44px] items-center gap-2 text-sm font-bold text-brand-slate">
                  <input type="checkbox" name="open" value="1" defaultChecked={w.admissions_open !== false} className="h-5 w-5" /> Admissions are open (show the application form)
                </label>
                <fieldset className="flex flex-col gap-2">
                  <legend className="label">Classes taking new students (none ticked: all classes)</legend>
                  <div className="flex flex-wrap gap-2">
                    {levels.map((c) => (
                      <label key={c} className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-[1.5px] border-[#DCE5F0] px-3 text-sm font-bold has-[:checked]:border-c1 has-[:checked]:bg-c1 has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-c2">
                        <input type="checkbox" name="classes" value={c} defaultChecked={offered.includes(c)} className="sr-only" />
                        {c}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label className="label" htmlFor="w-req">
                    What to bring to the assessment
                  </label>
                  <textarea id="w-req" name="requirements" rows={3} maxLength={600} className="sk-input py-3" defaultValue={w.admission_requirements ?? "Last school report, birth certificate and two passport photographs."} />
                </div>
                <div>
                  <SubmitButton>Save admissions</SubmitButton>
                </div>
              </ActionForm>
            </Panel>
          )}

          {page === "news" && (
            <>
              <Panel id="news-h" title="News and events">
                {news.length ? (
                  <ul className="flex flex-col gap-2">
                    {news.map((n) => (
                      <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E3EAF3] p-3">
                        <div className="min-w-0">
                          <span className="font-bold text-brand-slate">{n.title}</span>
                          <span className="block text-xs text-[#4A5A70]">{n.published_at ? `Published ${day(n.published_at)}` : `Draft · ${day(n.created_at)}`}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill kind={n.published_at ? "good" : "warn"}>{n.published_at ? "Published" : "Draft"}</Pill>
                          <ActionForm action={setPostPublished}>
                            <input type="hidden" name="id" value={n.id} />
                            <input type="hidden" name="on" value={n.published_at ? "0" : "1"} />
                            <SubmitButton className="s-btn2">
                              {n.published_at ? "Unpublish" : "Publish"}
                              <span className="sr-only"> {n.title}</span>
                            </SubmitButton>
                          </ActionForm>
                          <ActionForm action={deletePost}>
                            <input type="hidden" name="id" value={n.id} />
                            <SubmitButton className="s-btn-danger" pending="Deleting…">
                              Delete<span className="sr-only"> {n.title}</span>
                            </SubmitButton>
                          </ActionForm>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>No news yet.</Empty>
                )}
              </Panel>
              <Panel id="write-h" title="+ Write a news post">
                <ActionForm action={savePost} resetOnSuccess className="flex flex-col gap-3">
                  <input type="hidden" name="kind" value="news" />
                  <div>
                    <label className="label" htmlFor="np-title">
                      Title
                    </label>
                    <input id="np-title" name="title" className="sk-input" required maxLength={160} />
                  </div>
                  <div>
                    <label className="label" htmlFor="np-body">
                      Story
                    </label>
                    <textarea id="np-body" name="body" rows={6} maxLength={8000} className="sk-input py-3" />
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="np-photo">
                        Photo (optional)
                      </label>
                      <input id="np-photo" name="photo" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
                    </div>
                    <div>
                      <label className="label" htmlFor="np-alt">
                        Photo description
                      </label>
                      <input id="np-alt" name="image_alt" className="sk-input" maxLength={200} />
                    </div>
                  </div>
                  <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" name="publish" value="1" defaultChecked className="h-5 w-5" /> Publish now (untick to save as a draft)
                  </label>
                  <div>
                    <SubmitButton pending="Saving…">Save post</SubmitButton>
                  </div>
                </ActionForm>
              </Panel>
            </>
          )}

          {page === "gallery" && (
            <>
              <Panel id="gal-h" title="Gallery">
                {gallery.length ? (
                  <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {gallery.map((g) => (
                      <li key={g.id} className="flex flex-col gap-1.5 overflow-hidden rounded-xl border border-[#E3EAF3]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.image_url ?? ""} alt={g.image_alt ?? ""} className="h-32 w-full object-cover" />
                        <div className="flex flex-col gap-1 p-2">
                          <span className="text-xs text-[#4A5A70]">{g.album ?? "No album"}</span>
                          <span className="line-clamp-2 text-sm text-brand-slate">{g.image_alt}</span>
                          <ActionForm action={deletePost}>
                            <input type="hidden" name="id" value={g.id} />
                            <SubmitButton className="s-btn-danger !min-h-[40px] text-xs" pending="Deleting…">
                              Delete<span className="sr-only"> photo: {g.image_alt}</span>
                            </SubmitButton>
                          </ActionForm>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty>No photos yet.</Empty>
                )}
              </Panel>
              <Panel id="addph-h" title="+ Add photos">
                <ActionForm action={savePost} resetOnSuccess className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-3">
                  <input type="hidden" name="kind" value="gallery" />
                  <div>
                    <label className="label" htmlFor="gp-photo">
                      Photo
                    </label>
                    <input id="gp-photo" name="photo" type="file" required accept="image/png,image/jpeg,image/webp" className="text-sm" />
                  </div>
                  <div>
                    <label className="label" htmlFor="gp-alt">
                      Description
                    </label>
                    <input id="gp-alt" name="image_alt" className="sk-input" required minLength={3} maxLength={200} placeholder="e.g. Blue House winning the relay" />
                  </div>
                  <div>
                    <label className="label" htmlFor="gp-album">
                      Album (optional)
                    </label>
                    <input id="gp-album" name="album" className="sk-input" maxLength={80} placeholder="Sports day 2026" />
                  </div>
                  <div className="sm:col-span-3">
                    <SubmitButton pending="Uploading…">Add photo</SubmitButton>
                  </div>
                </ActionForm>
                <p className="text-[13px] text-[#4A5A70]">Add a short description to each photo so everyone can enjoy them. Group photos into albums like &quot;Sports day 2026&quot;.</p>
              </Panel>
            </>
          )}

          {page === "contact" && (
            <Panel id="ct-h" title="Contact">
              <p className="text-sm text-brand-slate">Contact details come from School settings, so you only update them in one place.</p>
              <Link className="s-btn2 self-start" href="/admin/settings#profile">
                Edit contact details
              </Link>
            </Panel>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
