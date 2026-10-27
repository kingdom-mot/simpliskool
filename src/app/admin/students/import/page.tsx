import Link from "next/link";
import { AdminPage, classLabel, requireAdminPage } from "@/components/admin";
import { Empty } from "@/components/ui";
import { ImportWizard } from "./ImportWizard";

export default async function ImportPage() {
  const ctx = await requireAdminPage();
  const { data: classes } = await ctx.supabase.from("classes").select("name, arm").eq("school_id", ctx.school.id).order("level_order").order("name").order("arm");
  return (
    <AdminPage ctx={ctx} active="students" crumb={[{ label: "Students", href: "/admin/students" }]} title="Upload students and parents">
      {classes?.length ? (
        <ImportWizard classNames={classes.map((c) => classLabel(c.name, c.arm))} schoolName={ctx.school.name} />
      ) : (
        <Empty>
          Add your classes before uploading students, so each student can go into a class.{" "}
          <Link className="s-link" href="/admin/classes">
            Set up classes
          </Link>
        </Empty>
      )}
    </AdminPage>
  );
}
