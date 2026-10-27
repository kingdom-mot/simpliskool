import Link from "next/link";
import { AdminPage, classLabel, requireAdminPage, SETUP_ROLES } from "@/components/admin";
import { Empty, Pill } from "@/components/ui";
import { personInitials } from "@/lib/format";

type Row = {
  id: string;
  first_name: string;
  last_name: string;
  admission_no: string;
  status: string;
  signin_method: "pin" | "own";
  classes: { name: string; arm: string } | null;
  guardians: { relationship: string | null; profiles: { full_name: string | null; phone: string | null; email: string | null } | null }[];
};

const PAGE = 50;
const AVATAR = ["#CFF3EC", "#D9E7FF", "#FFEDC2", "#EADBFF", "#FFDDEB", "#D3F8E2"];

export default async function StudentsPage(props: { searchParams: Promise<{ q?: string; class?: string; status?: string; page?: string }> }) {
  const searchParams = await props.searchParams;
  const ctx = await requireAdminPage([...SETUP_ROLES, "bursar"]);
  const { supabase, school, membership } = ctx;
  const canEdit = SETUP_ROLES.includes(membership.role);
  const q = (searchParams.q ?? "").trim();
  const status = ["active", "graduated", "withdrawn"].includes(searchParams.status ?? "") ? searchParams.status! : "active";
  const page = Math.max(1, Number(searchParams.page) || 1);

  const { data: classes } = await supabase.from("classes").select("id, name, arm").eq("school_id", school.id).order("level_order").order("name").order("arm");
  const classId = classes?.some((c) => c.id === searchParams.class) ? searchParams.class! : "";

  let query = supabase
    .from("students")
    .select("id, first_name, last_name, admission_no, status, signin_method, classes(name, arm), guardians(relationship, profiles(full_name, phone, email))", { count: "exact" })
    .eq("school_id", school.id)
    .eq("status", status);
  if (classId) query = query.eq("class_id", classId);
  if (q) {
    const safe = q.replace(/[%,()]/g, " ");
    query = query.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,admission_no.ilike.%${safe}%`);
  }
  const { data, count } = await query.order("last_name").order("first_name").range((page - 1) * PAGE, page * PAGE - 1).returns<Row[]>();
  const rows = data ?? [];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (classId) u.set("class", classId);
    if (status !== "active") u.set("status", status);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return `/admin/students${s ? `?${s}` : ""}`;
  };

  return (
    <AdminPage
      ctx={ctx}
      active="students"
      crumb={[{ label: "People" }]}
      title="Students"
      count={total}
      actions={
        canEdit && (
          <>
            {classId && (
              <Link className="s-btn2" href={`/admin/students/pins?class=${classId}`}>
                Print PIN slips for this class
              </Link>
            )}
            <Link className="s-btn2" href="/admin/students/import">
              Upload from Excel
            </Link>
            <Link className="s-btn" href="/admin/students/new">
              + Add student
            </Link>
          </>
        )
      }
    >
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-[18px] border border-[#E3EAF3] bg-white p-4" role="search" aria-label="Find students">
        <div className="min-w-[220px] flex-[2]">
          <label className="label" htmlFor="s-q">Search</label>
          <input className="sk-input" id="s-q" name="q" type="search" defaultValue={q} placeholder="Name or admission number" />
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="label" htmlFor="s-class">Class</label>
          <select className="sk-input sk-select" id="s-class" name="class" defaultValue={classId}>
            <option value="">All classes</option>
            {(classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c.name, c.arm)}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[150px] flex-1">
          <label className="label" htmlFor="s-status">Status</label>
          <select className="sk-input sk-select" id="s-status" name="status" defaultValue={status}>
            <option value="active">Active</option>
            <option value="graduated">Graduated</option>
            <option value="withdrawn">Left school</option>
          </select>
        </div>
        <button className="s-btn">Show</button>
      </form>

      <div className="overflow-hidden rounded-[18px] border border-[#E3EAF3] bg-white">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="tbl min-w-[760px]">
              <caption className="sr-only">
                Students, showing {rows.length} of {total}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  <th scope="col">Admission no.</th>
                  <th scope="col">Class</th>
                  <th scope="col">Parent</th>
                  <th scope="col">Signs in with</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const name = `${r.first_name} ${r.last_name}`;
                  const parent = r.guardians[0]?.profiles;
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/admin/students/${r.id}`} className="flex items-center gap-2.5 font-bold text-c1 hover:underline">
                          <span aria-hidden="true" className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-xs font-extrabold text-[#1B2433]" style={{ background: AVATAR[i % AVATAR.length] }}>
                            {personInitials(name)}
                          </span>
                          {name}
                        </Link>
                      </td>
                      <td>{r.admission_no}</td>
                      <td>{r.classes ? classLabel(r.classes.name, r.classes.arm) : "—"}</td>
                      <td>
                        {parent ? (
                          <span>
                            <span className="block">{parent.full_name || "Parent"}</span>
                            <span className="text-[13px] text-[#4A5A70]">{parent.phone ? `+${parent.phone.replace(/^\+/, "")}` : parent.email}</span>
                          </span>
                        ) : (
                          <Pill kind="warn">No parent yet</Pill>
                        )}
                      </td>
                      <td>{r.signin_method === "own" ? <Pill kind="info">Own phone or email</Pill> : <Pill kind="info">PIN</Pill>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <Empty>
              {q || classId ? "No students match. Try another search." : "No students yet. Add them one by one or upload your Excel list."}
            </Empty>
          </div>
        )}
        {total > PAGE && (
          <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF3F9] p-4 text-sm text-[#4A5A70]">
            <span>
              Showing {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} of {total}
            </span>
            <span className="flex gap-2">
              {page > 1 ? <Link className="s-btn2" href={qs(page - 1)}>Previous</Link> : <span className="s-btn2 opacity-50" aria-disabled="true">Previous</span>}
              {page < pages ? <Link className="s-btn2" href={qs(page + 1)}>Next</Link> : <span className="s-btn2 opacity-50" aria-disabled="true">Next</span>}
            </span>
          </nav>
        )}
      </div>
    </AdminPage>
  );
}
