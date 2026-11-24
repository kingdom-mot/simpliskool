import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { COMPANY, COMPANY_PLACE, PRIVACY_EMAIL } from "@/lib/legal";

export const metadata = { title: "Privacy policy" };

const sections: LegalSection[] = [
  {
    id: "who",
    title: "Who we are and who is responsible",
    body: (
      <>
        <p>
          Simpliskool is school management software made by {COMPANY}, {COMPANY_PLACE} (&quot;we&quot;, &quot;us&quot;). Schools use it to keep student records, take attendance, publish results, collect fees and talk to parents.
        </p>
        <p>
          <strong>For school records, the school is in charge.</strong> Each school decides what it records about its students, parents and staff and why. Under the Nigeria Data Protection Act 2023 (NDPA) the school is the <em>data controller</em> and we are its <em>data processor</em>: we hold and process the records only to provide Simpliskool to that school, following its instructions and our{" "}
          <Link href="/dpa">data processing agreement</Link> with it.
        </p>
        <p>
          <strong>For our own records, we are in charge.</strong> We are the data controller for the details of people who sign up or ask us about Simpliskool, the school owners we have a contract with, and the security logs we keep to run the service.
        </p>
        <p>If you are a parent, student or member of staff and have a question about your school&apos;s records, start with your school. You can also contact us and we will help the school answer you.</p>
      </>
    ),
  },
  {
    id: "what",
    title: "What we hold",
    body: (
      <>
        <p>What is held depends on what each school uses. It can include:</p>
        <ul>
          <li>
            <strong>Students:</strong> name, admission number, class, date of birth, gender, photo, address, state of origin, blood group, attendance, scores, report cards, homework and test answers, and fees owed and paid.
          </li>
          <li>
            <strong>Parents and guardians:</strong> name, phone number, email, relationship to the child, messages to the school, and payments made.
          </li>
          <li>
            <strong>Staff:</strong> name, phone number, email, role, classes and subjects, clock-in and clock-out times with the phone&apos;s location at that moment only (to confirm they were at school; we never track staff during the day), lesson notes and, for payroll, salary, bank account and pension details.
          </li>
          <li>
            <strong>Admission applications</strong> made on a school&apos;s website: the child&apos;s details and the parent&apos;s contact details.
          </li>
          <li>
            <strong>Sign-in and security details:</strong> the email or phone number used to sign in, when someone signed in, and a log of sensitive actions (for example who changed a payout account).
          </li>
        </ul>
        <p>
          Card details for online fee payments are entered on Paystack&apos;s pages. We never see or store card numbers. Student PINs are stored only in a scrambled form that cannot be read back.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children's data",
    body: (
      <>
        <p>
          Most students are under 18, so most student records are children&apos;s data. The NDPA gives children extra protection. Where a school relies on consent to use a child&apos;s data, that consent must come from a parent or legal guardian (section 31).
        </p>
        <ul>
          <li>Parents see a privacy notice the first time they open the parent app, and we keep a record that they saw it.</li>
          <li>Online admission forms ask the person applying to confirm they are the child&apos;s parent or guardian before the form is sent.</li>
          <li>Students sign in with a PIN their school gives them, and only see their own timetable, homework, tests and results.</li>
          <li>We never use children&apos;s data for advertising or marketing, we never sell it, and we never build profiles of children for anyone else.</li>
        </ul>
      </>
    ),
  },
  {
    id: "use",
    title: "How the data is used",
    body: (
      <>
        <p>We use school records only to:</p>
        <ul>
          <li>run Simpliskool for the school: show the right records to the right people, work out results and fees, and keep everything in one place;</li>
          <li>send the emails and text messages the school asks us to send (absence alerts, receipts, fee reminders, announcements);</li>
          <li>take online fee payments for the school through Paystack;</li>
          <li>keep the service secure, find and fix problems, and answer the school&apos;s requests for help;</li>
          <li>meet our legal duties.</li>
        </ul>
        <p>
          Some optional features use AI to help teachers write. When a teacher asks for a suggested report card comment, only the student&apos;s first name and their results are sent. The lesson-planning assistant only receives the lesson topic. Teachers check and edit every suggestion before it is used.
        </p>
      </>
    ),
  },
  {
    id: "basis",
    title: "Our lawful reasons",
    body: (
      <>
        <p>Under section 25 of the NDPA, personal data can only be used for a lawful reason. For school records, the school chooses its lawful reasons, such as:</p>
        <ul>
          <li>a contract with parents to educate their child and collect fees;</li>
          <li>legal duties the school has;</li>
          <li>the school&apos;s legitimate interests in running the school and keeping children safe;</li>
          <li>consent, for anything optional (for example photos on the school website), given by a parent or guardian for a child.</li>
        </ul>
        <p>For our own records, we rely on our contract with the school, our legal duties, and our legitimate interest in keeping Simpliskool secure.</p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>Records are only shown to the people the school lets in (its staff, the parents of each child, the student) and to the trusted service providers that host and run Simpliskool, take online fee payments and send our texts and emails. They work for us under contracts that require them to protect the data.</p>
        <p>
          A small number of {COMPANY} staff can view a school&apos;s records, read only, when the school asks for help. Every such view is logged. We share data with the police or a regulator only when the law requires it, and we tell the school unless the law forbids it.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "Data stored outside Nigeria",
    body: (
      <>
        <p>
          Some of these service providers keep data in data centres outside Nigeria. Part VIII of the NDPA allows this only with proper protection. We use providers that offer strong security and binding data protection terms, including standard contractual clauses, and we follow the Nigeria Data Protection Commission&apos;s rules on transfers as they are issued.
        </p>
      </>
    ),
  },
  {
    id: "keep",
    title: "How long it is kept",
    body: (
      <>
        <ul>
          <li>School records are kept for as long as the school uses Simpliskool. The school decides how long to keep each record and can delete records at any time.</li>
          <li>A school can download all its data at any time from Data protection in its admin portal.</li>
          <li>If a school leaves and asks us to delete its account, we delete all its records 30 days after the request. Copies in our backups are removed as the backups expire, normally within a further 30 days.</li>
          <li>A school can erase a former student&apos;s personal details while keeping their marks and payments under &quot;Former student&quot;, so the school&apos;s results and accounts still add up.</li>
          <li>Security logs (who did what, and when) can&apos;t be changed and are kept to protect schools and look into problems.</li>
        </ul>
      </>
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    body: (
      <ul>
        <li>All connections are encrypted (HTTPS).</li>
        <li>Database rules make sure each school can only ever see its own records, and each person only sees what their role allows.</li>
        <li>{COMPANY} staff must use two-step sign-in, can only view a school read only, and every sensitive action is written to a log that cannot be changed.</li>
        <li>Changes to where a school&apos;s fee money is paid are checked before online payments start again.</li>
      </ul>
    ),
  },
  {
    id: "breaches",
    title: "If something goes wrong",
    body: (
      <p>
        If personal data is lost, stolen or seen by someone who should not see it, we tell the affected school without delay, and within 24 hours of finding out. This lets the school tell the Nigeria Data Protection Commission within the 72 hours the NDPA requires (section 40). Where the risk to people is high, they are told directly. We keep a record of every incident.
      </p>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>Under sections 34 to 38 of the NDPA you can:</p>
        <ul>
          <li>be told how your data is used (this policy and your school&apos;s notice);</li>
          <li>get a copy of your data;</li>
          <li>have wrong data corrected;</li>
          <li>have data deleted when it is no longer needed or was used unlawfully;</li>
          <li>object to some uses, or ask for them to be paused;</li>
          <li>get your data in a format you can take elsewhere;</li>
          <li>withdraw consent you gave, at any time;</li>
          <li>complain to the Nigeria Data Protection Commission.</li>
        </ul>
        <p>
          For school records, ask your school. Parents can send a privacy request from <strong>Contact the school</strong> in the parent app, and the school sees it straight away. A parent can act for their child. For our own records, email us at <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact us or complain",
    body: (
      <>
        <p>
          {COMPANY}, {COMPANY_PLACE}. Email <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> with &quot;Privacy&quot; in the subject.
        </p>
        <p>
          If you are not happy with how we or a school handled your data, you can complain to the Nigeria Data Protection Commission at <a href="https://ndpc.gov.ng">ndpc.gov.ng</a>.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: <p>We will update this page when anything changes and show the new date at the top. If a change affects schools, we tell school owners in their admin portal before it takes effect.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      path="/privacy"
      title="Privacy policy"
      intro={
        <p>
          This policy explains what personal data Simpliskool holds, why, who can see it, and the rights students, parents and staff have under the Nigeria Data Protection Act 2023. It is written to be read by parents and school staff, not just lawyers.
        </p>
      }
      sections={sections}
    />
  );
}
