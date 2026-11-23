import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { COMPANY, COMPANY_PLACE, PRIVACY_EMAIL, SUBPROCESSORS } from "@/lib/legal";

export const metadata = { title: "Data processing agreement" };

const sections: LegalSection[] = [
  {
    id: "parties",
    title: "Who this agreement is between",
    body: (
      <>
        <p>
          This agreement is between the school that uses Simpliskool (<strong>the controller</strong>) and {COMPANY}, {COMPANY_PLACE} (<strong>the processor</strong>). It forms part of the <Link href="/terms">terms of use</Link> and meets the requirement in section 29 of the Nigeria Data Protection Act 2023 (NDPA) for a written agreement between a data controller and a data processor.
        </p>
        <p>It is accepted by the school owner when the school is created, or in Data protection in the admin portal. The date and the person who accepted are recorded.</p>
      </>
    ),
  },
  {
    id: "scope",
    title: "What is processed and why",
    body: (
      <table>
        <tbody>
          <tr>
            <th scope="row">Purpose</th>
            <td>Providing Simpliskool to the school: records, attendance, results, fees, payroll, messages, the school website and support.</td>
          </tr>
          <tr>
            <th scope="row">People</th>
            <td>Students (most of them children), parents and guardians, staff, admission applicants and their parents.</td>
          </tr>
          <tr>
            <th scope="row">Data</th>
            <td>
              The details listed in our <Link href="/privacy#what">privacy policy</Link>, including children&apos;s data and staff bank and pension details. No special categories (such as health or religion) are asked for, apart from blood group if the school chooses to record it.
            </td>
          </tr>
          <tr>
            <th scope="row">Duration</th>
            <td>For as long as the school uses Simpliskool, plus the 30-day deletion period after it asks for its account to be deleted.</td>
          </tr>
        </tbody>
      </table>
    ),
  },
  {
    id: "instructions",
    title: "Processing only on the school's instructions",
    body: (
      <p>
        We process the school&apos;s personal data only to provide Simpliskool and as the school instructs through its use of Simpliskool, these terms or in writing. We tell the school if we believe an instruction breaks the NDPA. We do not sell the data, use it for advertising, or use it for any purpose of our own.
      </p>
    ),
  },
  {
    id: "staff",
    title: "Confidentiality",
    body: <p>Everyone at {COMPANY} who can access school data is bound to keep it confidential. Access is limited to those who need it to support the school, uses two-step sign-in, is read only, and is logged.</p>,
  },
  {
    id: "security",
    title: "Security",
    body: (
      <>
        <p>We keep appropriate technical and organisational measures in place, as section 39 of the NDPA requires, including:</p>
        <ul>
          <li>encryption of all connections;</li>
          <li>database rules that keep each school&apos;s records apart and limit each user to their role;</li>
          <li>an unchangeable log of sensitive actions;</li>
          <li>checks before a school&apos;s payout bank account is used.</li>
        </ul>
      </>
    ),
  },
  {
    id: "subprocessors",
    title: "Other services we use",
    body: (
      <>
        <p>The school agrees that we may use these services (sub-processors). Each is bound by written terms that protect the data at least as well as this agreement.</p>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Table: scroll sideways to see more">
          <table>
            <caption className="sr-only">Sub-processors</caption>
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Purpose</th>
                <th scope="col">Where</th>
              </tr>
            </thead>
            <tbody>
              {SUBPROCESSORS.map((s) => (
                <tr key={s.name}>
                  <th scope="row">{s.name}</th>
                  <td>{s.what}</td>
                  <td>{s.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>We tell school owners in the admin portal at least 30 days before adding or replacing a sub-processor. The school can object, and if we can&apos;t meet a reasonable objection, the school can end the agreement and have its data deleted.</p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "Transfers outside Nigeria",
    body: <p>Where a sub-processor stores data outside Nigeria, we make sure the transfer is allowed under Part VIII of the NDPA and the Commission&apos;s rules, using binding safeguards such as standard contractual clauses.</p>,
  },
  {
    id: "requests",
    title: "Helping the school with people's rights",
    body: (
      <p>
        Simpliskool lets the school find, correct, download and delete records, and collects privacy requests from parents, students and staff in Data protection in the admin portal. If a request about the school&apos;s records comes to us, we pass it to the school straight away and do not answer it ourselves unless the school asks. We help the school with data protection impact assessments and questions from the Commission where they relate to Simpliskool.
      </p>
    ),
  },
  {
    id: "breaches",
    title: "Personal data breaches",
    body: (
      <p>
        If we become aware of a breach affecting the school&apos;s data, we tell the school owner without undue delay and within 24 hours, with what we know: what happened, the data and people affected, the likely effects, and what we are doing about it. We keep helping as more is known, so the school can notify the Commission within 72 hours and tell the people affected where section 40 of the NDPA requires it.
      </p>
    ),
  },
  {
    id: "end",
    title: "When the agreement ends",
    body: (
      <p>
        The school can download all its data at any time. When the school asks for its account to be deleted, we delete all its personal data 30 days later and confirm when it is done. Backup copies are removed as backups expire, normally within a further 30 days. We keep nothing unless the law requires it.
      </p>
    ),
  },
  {
    id: "audits",
    title: "Information and audits",
    body: <p>We give the school the information it reasonably needs to show it is meeting the NDPA, and answer reasonable written questions about our security. Where the law or the Commission requires an audit, we co-operate with it.</p>,
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about this agreement: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
      </p>
    ),
  },
];

export default function DpaPage() {
  return (
    <LegalPage
      path="/dpa"
      title="Data processing agreement"
      intro={<p>The school is in charge of its records. This agreement sets out how {COMPANY} looks after them on the school&apos;s behalf, as the Nigeria Data Protection Act 2023 requires.</p>}
      sections={sections}
    />
  );
}
