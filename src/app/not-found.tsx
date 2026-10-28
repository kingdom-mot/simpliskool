import { NotFoundView } from "@/components/NotFoundView";

export const metadata = { title: "Page not found · Simpliskool" };

export default function NotFound() {
  return <NotFoundView title="We can't find that page" body={<p>The link may be old or mistyped. Check the address, or start again from the home page.</p>} homeUrl="/" homeLabel="Go to the home page" />;
}
