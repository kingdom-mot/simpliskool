import { AdminPage, Panel, requireAdminPage } from "@/components/admin";
import { ActionForm, SubmitButton } from "@/components/forms";
import { initials } from "@/lib/theme";
import { saveProfile } from "./actions";
import { ColourPicker } from "./ColourPicker";
import { LogoForm } from "./LogoForm";

export const metadata = { title: "Settings" };

type SchoolRow = {
  name: string;
  slug: string;
  motto: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  principal_name: string | null;
  about: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {hint && (
        <span id={`${id}-h`} className="text-[13px] text-[#4A5A70]">
          {hint}
        </span>
      )}
      {children}
    </div>
  );
}

export default async function SettingsPage() {
  const ctx = await requireAdminPage(["owner"]);
  const { supabase, school } = ctx;
  const { data: s } = await supabase
    .from("schools")
    .select("name, slug, motto, email, phone, address, principal_name, about, logo_url, primary_color, secondary_color")
    .eq("id", school.id)
    .single<SchoolRow>();
  const row = s ?? { ...school, motto: null, email: null, phone: null, address: null, principal_name: null, about: null };
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com";

  return (
    <AdminPage ctx={ctx} active="settings" crumb={[{ label: "Settings" }]} title="Settings">
      <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
        <a href="#profile" className="s-btn2">School profile</a>
        <a href="#brand" className="s-btn2">Logo and colours</a>
      </nav>

      <Panel title="School profile" id="profile">
        <ActionForm action={saveProfile} className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
          <Field id="name" label="School name">
            <input id="name" name="name" className="input" required minLength={3} maxLength={120} defaultValue={row.name} />
          </Field>
          <Field id="motto" label="Motto (optional)">
            <input id="motto" name="motto" className="input" maxLength={120} defaultValue={row.motto ?? ""} />
          </Field>
          <Field id="email" label="School email">
            <input id="email" name="email" type="email" className="input" autoComplete="email" defaultValue={row.email ?? ""} />
          </Field>
          <Field id="phone" label="School phone">
            <input id="phone" name="phone" type="tel" className="input" autoComplete="tel" defaultValue={row.phone ?? ""} />
          </Field>
          <div className="md:col-span-2">
            <Field id="address" label="Address">
              <input id="address" name="address" className="input" maxLength={300} autoComplete="street-address" defaultValue={row.address ?? ""} />
            </Field>
          </div>
          <Field id="principal_name" label="Principal's name" hint="Shown on report cards.">
            <input id="principal_name" name="principal_name" aria-describedby="principal_name-h" className="input" maxLength={120} defaultValue={row.principal_name ?? ""} />
          </Field>
          <Field id="web" label="Web address" hint="Chosen when the school was created. Contact Simpliskool to change it.">
            <input id="web" readOnly aria-describedby="web-h" className="input bg-brand-cloud" value={`${row.slug}.${rootDomain}`} />
          </Field>
          <div className="md:col-span-2">
            <Field id="about" label="About the school" hint="The introduction on your school website. Up to 2,000 characters.">
              <textarea id="about" name="about" aria-describedby="about-h" rows={5} maxLength={2000} className="input min-h-[120px] py-3" defaultValue={row.about ?? ""} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <SubmitButton>Save details</SubmitButton>
          </div>
        </ActionForm>
      </Panel>

      <Panel title="Logo and colours" id="brand">
        <LogoForm logoUrl={row.logo_url} initials={initials(row.name)} />
        <hr className="border-[#E3EAF3]" />
        <ColourPicker schoolName={row.name} initial={[row.primary_color, row.secondary_color].filter((c): c is string => !!c)} />
      </Panel>
    </AdminPage>
  );
}
