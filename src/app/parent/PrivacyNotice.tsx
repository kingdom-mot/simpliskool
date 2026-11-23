import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/forms";
import { acknowledgeNotice } from "./privacy-actions";

/** Shown to a parent until they confirm they've read it (once per version of the notice). */
export function PrivacyNotice({ schoolName }: { schoolName: string }) {
  return (
    <section aria-labelledby="pn-h" className="flex flex-col gap-2 rounded-[18px] border-2 border-c2 bg-white p-[18px]">
      <h2 id="pn-h" className="text-base !text-c1">
        Your family&apos;s privacy
      </h2>
      <p className="text-sm text-[#263449]">
        {schoolName} uses Simpliskool to keep your child&apos;s records: class, attendance, results, fees and messages. The school is in charge of these records. Simpliskool keeps them safe for the school and never sells them or uses them for advertising.
      </p>
      <p className="text-sm text-[#263449]">
        You can ask the school to show you, correct or delete your family&apos;s data at any time from{" "}
        <Link className="font-bold text-c2 underline" href="/parent/contact#privacy-h">
          Contact the school
        </Link>
        . Read the full{" "}
        <Link className="font-bold text-c2 underline" href="/privacy">
          privacy policy
        </Link>
        .
      </p>
      <ActionForm action={acknowledgeNotice}>
        <SubmitButton pending="Saving…">I understand</SubmitButton>
      </ActionForm>
    </section>
  );
}
