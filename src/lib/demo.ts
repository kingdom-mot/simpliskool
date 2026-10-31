import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The public demo: Bright Future Academy (Lekki and Ajah), with made-up people.
 * Every demo person signs in with an address on this domain, which never
 * receives email; anything they do is wiped by the nightly reset.
 */
export const DEMO_DOMAIN = "demo.simpliskool.com";
export const isDemoEmail = (email: string | null | undefined) => !!email && email.toLowerCase().endsWith(`@${DEMO_DOMAIN}`);

type Person = { key: string; email: string; name: string };
const at = (local: string) => `${local}@${DEMO_DOMAIN}`;

const LEKKI_TEACHERS = ["Mrs Grace Udoh", "Mr Ibrahim Musa", "Mrs Folake Adebayo", "Mr Emeka Nwankwo", "Miss Ruth Okoro", "Mrs Bisi Lawal", "Mr Segun Ogunleye", "Mrs Amaka Obi", "Mrs Halima Yusuf", "Mr Victor Etim"];
const AJAH_TEACHERS = ["Mrs Joy Okeke", "Mr Tunde Bakare", "Mrs Kemi Afolabi", "Miss Precious Eze"];
const TITLES_F = ["Mrs Ngozi", "Mrs Funmi", "Mrs Aisha", "Mrs Ifeoma", "Mrs Bukola", "Mrs Nkechi", "Mrs Halima", "Mrs Tola", "Mrs Amaka", "Mrs Yetunde"];
const TITLES_M = ["Mr Tunde", "Mr Chinedu", "Mr Emeka", "Mr Ibrahim", "Mr Seun", "Mr Kelechi", "Mr Femi", "Mr Uche", "Mr Musa", "Dr Segun"];
const SURNAMES = ["Adeyemi", "Okafor", "Bello", "Eze", "Olaniyan", "Nwosu", "Abubakar", "Okonkwo", "Balogun", "Ogunleye", "Ibrahim", "Adebayo", "Chukwu", "Afolabi", "Onyekachi", "Lawal", "Obi", "Oyelaran", "Nnamdi", "Akinola", "Danjuma", "Ekwueme", "Fashola", "Gbadamosi", "Ikwuemesi"];

function parents(prefix: string, n: number, first?: string): Person[] {
  const out: Person[] = [];
  for (let i = 1; i <= n; i++) {
    const t = (i % 2 ? TITLES_F : TITLES_M)[i % 10];
    const name = i === 1 && first ? first : `${t} ${SURNAMES[(i * 7) % SURNAMES.length]}`;
    out.push({ key: `${prefix}${i}`, email: at(i === 1 && first ? "parent" : `${prefix}${i}`), name });
  }
  return out;
}

const PEOPLE = {
  owner: { key: "owner", email: at("owner"), name: "Mrs Adaeze Okonkwo" },
  principal: { key: "principal", email: at("principal"), name: "Mr Babatunde Adeyemi" },
  principal2: { key: "principal2", email: at("principal.ajah"), name: "Mrs Funke Alabi" },
  bursar: { key: "bursar", email: at("bursar"), name: "Mr Chinedu Eze" },
  finance: { key: "finance", email: at("finance"), name: "Mr Kunle Bakare" },
  student: { key: "student", email: at("student"), name: "Tolu Okafor" },
  teachers: LEKKI_TEACHERS.map((name, i) => ({ key: `t${i + 1}`, email: at(i === 0 ? "teacher" : `teacher${i + 1}`), name })),
  teachers2: AJAH_TEACHERS.map((name, i) => ({ key: `ta${i + 1}`, email: at(`teacher.ajah${i + 1}`), name })),
  parents: parents("parent", 64, "Mrs Ngozi Okafor"),
  parents2: parents("parent.ajah", 24),
};

/** The demo roles visitors can pick. */
export const PERSONAS = [
  { key: "owner", who: PEOPLE.owner.name, role: "School owner", desc: "Fees, attendance and results across the school, payroll approval, settings and the school website.", go: "/admin" },
  { key: "group", who: PEOPLE.owner.name, role: "Proprietor (2 branches)", desc: "Lekki and Ajah side by side: fees collected, attendance, results, payroll and shared settings.", go: "/group" },
  { key: "principal", who: PEOPLE.principal.name, role: "Principal", desc: "Lesson notes to review, results and report cards, staff clock-in and admissions.", go: "/admin" },
  { key: "bursar", who: PEOPLE.bursar.name, role: "Bursar", desc: "Fee setup, payments and receipts, who owes what, reminders and payroll.", go: "/admin" },
  { key: "teacher", who: PEOPLE.teachers[0].name, role: "Teacher (JSS 2 Mathematics)", desc: "Today's classes, the register, score entry, lesson notes, homework, CBT tests and the AI assistant.", go: "/teacher" },
  { key: "parent", who: PEOPLE.parents[0].name, role: "Parent (2 children)", desc: "Phone-first: fees and receipts, report cards, attendance, homework and school notices.", go: "/parent" },
  { key: "student", who: PEOPLE.student.name, role: "Student (JSS 2)", desc: "Timetable, homework to hand in, CBT tests, shared lesson notes and results.", go: "/student" },
] as const;
export type PersonaKey = (typeof PERSONAS)[number]["key"];

/** Creates any demo people who don't exist yet; returns email → user id. */
async function ensurePeople(admin: ReturnType<typeof createAdminClient>) {
  const all: Person[] = [PEOPLE.owner, PEOPLE.principal, PEOPLE.principal2, PEOPLE.bursar, PEOPLE.finance, PEOPLE.student, ...PEOPLE.teachers, ...PEOPLE.teachers2, ...PEOPLE.parents, ...PEOPLE.parents2];
  const { data: have } = await admin.from("profiles").select("id, email").ilike("email", `%@${DEMO_DOMAIN}`).limit(1000).returns<{ id: string; email: string }[]>();
  const ids = new Map((have ?? []).map((p) => [p.email.toLowerCase(), p.id]));
  const missing = all.filter((p) => !ids.has(p.email));
  for (let i = 0; i < missing.length; i += 8) {
    await Promise.all(
      missing.slice(i, i + 8).map(async (p) => {
        const { data } = await admin.auth.admin.createUser({ email: p.email, email_confirm: true, user_metadata: { full_name: p.name } });
        if (data?.user) {
          ids.set(p.email, data.user.id);
          await admin.from("profiles").update({ full_name: p.name, email: p.email }).eq("id", data.user.id);
        }
      }),
    );
  }
  // Keep names right even if someone renamed themselves during the day.
  await Promise.all(all.filter((p) => ids.has(p.email)).map((p) => admin.from("profiles").update({ full_name: p.name, phone: null }).eq("id", ids.get(p.email)!)));
  const id = (p: Person) => {
    const v = ids.get(p.email);
    if (!v) throw new Error(`Couldn't create demo person ${p.email}`);
    return v;
  };
  return { id, ids };
}

/** Wipes and rebuilds the demo schools (a few seconds). */
export async function resetDemo() {
  const admin = createAdminClient();
  const { id } = await ensurePeople(admin);
  const { data, error } = await admin.rpc("demo_reset", {
    p: {
      owner: id(PEOPLE.owner),
      principal: id(PEOPLE.principal),
      principal2: id(PEOPLE.principal2),
      bursar: id(PEOPLE.bursar),
      finance: id(PEOPLE.finance),
      student: id(PEOPLE.student),
      teachers: PEOPLE.teachers.map(id),
      teachers2: PEOPLE.teachers2.map(id),
      parents: PEOPLE.parents.map(id),
      parents2: PEOPLE.parents2.map(id),
    },
  });
  if (error) throw new Error(/function/i.test(error.message) ? "Run database file 0019_demo.sql in Supabase first." : error.message);
  return data as { lekki: string; ajah: string; group: string; students: number };
}

/** The demo person to sign in as, and the school (or group) to open. */
export async function personaTarget(key: PersonaKey) {
  const admin = createAdminClient();
  const { data: schools } = await admin.from("schools").select("id, slug, group_id").eq("is_demo", true).returns<{ id: string; slug: string; group_id: string | null }[]>();
  const lekki = schools?.find((s) => s.slug === "demo");
  if (!lekki) return null;
  const email = key === "group" || key === "owner" ? PEOPLE.owner.email : key === "teacher" ? PEOPLE.teachers[0].email : key === "parent" ? PEOPLE.parents[0].email : PEOPLE[key].email;
  return { email, school: lekki.id, group: lekki.group_id, go: PERSONAS.find((p) => p.key === key)!.go };
}

/** True while someone signed in to the demo is using the app (emails, texts and payments are then switched off). */
export async function isDemoRequest() {
  try {
    const { currentUser } = await import("@/lib/auth");
    return isDemoEmail((await currentUser())?.email);
  } catch {
    return false; // no request (cron, background job)
  }
}
