import "server-only";
import { classLabel } from "@/lib/teaching";
import { currentTerms, type GroupCtx } from "@/lib/group";

export type Debtor = { name: string; branch: string; cls: string; owing: number; lastPaid: string | null };
export type Pay = { at: string; branch: string; name: string; amount: number; method: string; receipt: string | null };

/** Largest balances this term and the latest payments, across the branches in view. */
export async function groupMoney(ctx: GroupCtx, schoolIds: string[]) {
  const terms = await currentTerms(ctx);
  const termIds = schoolIds.map((s) => terms.get(s)?.id).filter((x): x is string => !!x);
  const name = new Map(ctx.branches.map((b) => [b.id, b.name]));
  type Inv = { id: string; school_id: string; total_kobo: number; paid_kobo: number; balance_kobo: number; students: { first_name: string; last_name: string; classes: { name: string; arm: string } | null } | null; payments: { paid_at: string | null; status: string }[] };
  const { data: inv } = termIds.length
    ? await ctx.admin.from("invoices").select("id, school_id, total_kobo, paid_kobo, balance_kobo, students(first_name, last_name, classes(name, arm)), payments(paid_at, status)").in("term_id", termIds).gt("balance_kobo", 0).order("balance_kobo", { ascending: false }).limit(200).returns<Inv[]>()
    : { data: [] as Inv[] };
  const debtors: Debtor[] = (inv ?? []).map((i) => {
    const last = i.payments.filter((p) => p.status === "success" && p.paid_at).map((p) => p.paid_at!).sort().pop() ?? null;
    return { name: `${i.students?.first_name ?? ""} ${i.students?.last_name ?? ""}`.trim(), branch: name.get(i.school_id) ?? "", cls: i.students?.classes ? classLabel(i.students.classes.name, i.students.classes.arm) : "", owing: Number(i.balance_kobo), lastPaid: last };
  });
  type P = { paid_at: string | null; created_at: string; school_id: string; amount_kobo: number; method: string; receipt_no: string | null; invoices: { students: { first_name: string; last_name: string } | null } | null };
  const { data: pays } = schoolIds.length
    ? await ctx.admin.from("payments").select("paid_at, created_at, school_id, amount_kobo, method, receipt_no, invoices(students(first_name, last_name))").in("school_id", schoolIds).eq("status", "success").order("created_at", { ascending: false }).limit(25).returns<P[]>()
    : { data: [] as P[] };
  const payments: Pay[] = (pays ?? []).map((p) => ({ at: p.paid_at ?? p.created_at, branch: name.get(p.school_id) ?? "", name: `${p.invoices?.students?.first_name ?? ""} ${p.invoices?.students?.last_name ?? ""}`.trim(), amount: Number(p.amount_kobo), method: p.method, receipt: p.receipt_no }));
  return { debtors, payments };
}
