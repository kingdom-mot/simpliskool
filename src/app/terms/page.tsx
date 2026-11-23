import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { COMPANY, COMPANY_PLACE, PRIVACY_EMAIL } from "@/lib/legal";

export const metadata = { title: "Terms of use" };

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "The agreement",
    body: (
      <>
        <p>
          These terms are an agreement between {COMPANY}, {COMPANY_PLACE} (&quot;we&quot;) and the school that opens a Simpliskool account (&quot;the school&quot;). The person who creates the account, or accepts these terms in the admin portal, confirms they are allowed to agree on the school&apos;s behalf.
        </p>
        <p>
          Our <Link href="/dpa">data processing agreement</Link> is part of these terms and says how we handle the school&apos;s records. Our <Link href="/privacy">privacy policy</Link> explains the same to parents, students and staff.
        </p>
      </>
    ),
  },
  {
    id: "service",
    title: "What Simpliskool provides",
    body: (
      <>
        <p>
          Simpliskool gives the school an admin portal, portals for teachers, parents and students, a school website, and the features switched on for the school&apos;s plan. We may improve or change features, and we tell school owners in good time about any change that removes something they use.
        </p>
        <p>We aim to keep Simpliskool available at all times, but there may be short breaks for maintenance or problems outside our control. We tell schools about planned maintenance in advance.</p>
      </>
    ),
  },
  {
    id: "school",
    title: "The school's responsibilities",
    body: (
      <ul>
        <li>Keep its records accurate and only record what it needs.</li>
        <li>Have a lawful reason under the Nigeria Data Protection Act 2023 for what it records, and get a parent&apos;s or guardian&apos;s consent where consent is needed for a child.</li>
        <li>Tell parents, students and staff how their data is used (the parent privacy notice in Simpliskool helps with this).</li>
        <li>Give staff only the access their role needs, and remove people who leave.</li>
        <li>Answer privacy requests from parents, students and staff. Simpliskool collects them in Data protection in the admin portal.</li>
        <li>Register with the Nigeria Data Protection Commission if the law requires it. Most primary and secondary schools do.</li>
        <li>Keep sign-in codes and PINs private, and tell us straight away about any misuse of its account.</li>
      </ul>
    ),
  },
  {
    id: "use",
    title: "Acceptable use",
    body: (
      <>
        <p>The school and its users must not:</p>
        <ul>
          <li>use Simpliskool for anything unlawful, or to harass, threaten or deceive anyone;</li>
          <li>send messages to people who have not agreed to hear from the school, or send spam;</li>
          <li>try to see another school&apos;s data, get around security, or overload the service;</li>
          <li>upload anything harmful, or anything the school does not have the right to use.</li>
        </ul>
        <p>We may pause an account that breaks these rules, after telling the school unless the risk is urgent.</p>
      </>
    ),
  },
  {
    id: "fees",
    title: "Plans, fees and payments",
    body: (
      <>
        <p>The school pays for the plan it chooses. Pilot schools use Simpliskool free until the end date agreed with them. Prices and SMS credit are shown in the admin portal before the school is charged.</p>
        <p>
          Parents&apos; online fee payments go through Paystack and are paid into the school&apos;s approved bank account, less Paystack&apos;s charges and any Simpliskool fee shown in the admin portal. Refunds of online payments are made through Simpliskool at the school&apos;s request.
        </p>
      </>
    ),
  },
  {
    id: "data",
    title: "The school's data",
    body: (
      <>
        <p>
          The school owns its records. We use them only to provide Simpliskool to the school, as set out in the data processing agreement. The school can download all its data at any time from Data protection in the admin portal.
        </p>
        <p>We may use counts that identify no one (for example, how many schools use attendance) to improve Simpliskool.</p>
      </>
    ),
  },
  {
    id: "ending",
    title: "Ending the agreement",
    body: (
      <>
        <p>
          The school can stop using Simpliskool at any time. To have its records deleted, the owner asks from Data protection in the admin portal. We delete everything 30 days later, so there is time to change its mind or download the data first.
        </p>
        <p>We can end the agreement with 60 days&apos; notice, or straight away if the school seriously breaks these terms or does not pay. Either way, the school can download its data before the account closes.</p>
      </>
    ),
  },
  {
    id: "liability",
    title: "Responsibility if things go wrong",
    body: (
      <>
        <p>We provide Simpliskool with reasonable care and skill. We are not responsible for losses caused by wrong information entered by the school, by the school&apos;s own staff or devices, or by events outside our reasonable control.</p>
        <p>
          Apart from anything the law does not allow us to limit, our total responsibility to a school in any 12 months is limited to the amount the school paid us in that time, or ₦100,000 if that is more.
        </p>
      </>
    ),
  },
  {
    id: "law",
    title: "Law and disputes",
    body: <p>These terms are governed by the laws of the Federal Republic of Nigeria. We will try to settle any disagreement by talking first. If that does not work, the courts of Lagos State will decide.</p>,
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: (
      <p>
        If we change these terms, school owners are asked to accept the new version in the admin portal. Questions: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return <LegalPage path="/terms" title="Terms of use" intro={<p>These terms apply to schools that use Simpliskool. They are short and in plain English on purpose.</p>} sections={sections} />;
}
