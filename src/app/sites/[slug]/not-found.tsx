import { headers } from "next/headers";
import { NotFoundView } from "@/components/NotFoundView";
import { schoolSlugFromHost } from "@/lib/tenant";

export const metadata = { title: "School not found · Simpliskool" };

/** Shown on a school address no school uses, e.g. test.simpliskool.com. */
export default async function SchoolNotFound() {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "simpliskool.com";
  const code = schoolSlugFromHost((await headers()).get("host"), rootDomain);
  const home = `https://www.${rootDomain}`;
  return (
    <NotFoundView
      title="No school at this address"
      body={
        <>
          <p>
            {code ? (
              <>
                No school uses the code <strong className="text-brand-navy">{code}</strong> yet.
              </>
            ) : (
              <>We can&apos;t find this school.</>
            )}{" "}
            Check the spelling with your school, or ask them for their Simpliskool link.
          </p>
          <p className="mt-3 text-sm">Run a school? You can set one up on Simpliskool.</p>
        </>
      }
      homeUrl={home}
      homeLabel="Go to Simpliskool"
    />
  );
}
