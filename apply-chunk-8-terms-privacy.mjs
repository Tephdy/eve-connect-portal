// apply-chunk-8-terms-privacy.mjs
// Adds Terms + Privacy pages, mandatory agreement checkbox on signup,
// and records the agreed version in core.tenant_user.
//
// 5 new files, 4 modifies. Signature-guarded.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { dirname } from "node:path";

// ===========================================================================
// PART 1 — New files
// ===========================================================================

const NEW_FILES = [
  {
    path: "public/legal/terms.md",
    content: `# Terms and Conditions

**Effective date:** 6 October 2026
**Version:** 1.0

These Terms and Conditions ("Terms") govern your access to and use of the
Eve's Residences Tenant Portal (the "Portal"). By creating an account and
using the Portal, you agree to be bound by these Terms.

## 1. About the Portal

The Portal is a self-service tool provided by Eve's Residences management
("we", "us", "our") to tenants ("you") for the following purposes:

- Viewing your lease agreement, unit details, and occupancy information
- Viewing your invoices, payment history, and deposit records
- Submitting meter readings and unit inspection checklists where applicable
- Receiving notifications about upcoming due dates and lease events
- Submitting move-out notices when required

The Portal is not a substitute for the physical Contract of Lease signed
between you and Eve's Residences. In the event of any conflict between
information shown in the Portal and the signed Contract of Lease, the
signed Contract of Lease prevails.

## 2. Account Responsibilities

You are responsible for:

- Providing accurate, current, and complete information in your profile
- Maintaining the confidentiality of your login credentials
- All activity that occurs under your account
- Notifying us immediately if you suspect unauthorized access

You may not:

- Share your account with another person
- Use the Portal to submit false or misleading information
- Attempt to access data belonging to other tenants
- Interfere with the operation or security of the Portal

## 3. Invoices and Payments

Amounts shown in the Portal reflect our internal records at the time of
viewing. While we aim for accuracy:

- The Portal is not a receipt. Official Receipts (ORs) are issued separately.
- If you believe an amount is incorrect, contact the management office
  directly. Do not rely solely on the Portal for disputes.
- Making a payment through a channel outside the Portal (bank transfer,
  GCash, Maya) does not automatically update your Portal record until the
  Accounting department confirms the payment.

## 4. Notifications

The Portal may display reminders about upcoming rent due dates, contract
expiration, or renewal periods. These are informational only.

- Failure of the Portal to display a notification does not waive your
  obligations under the Contract of Lease.
- The absence of a notification does not extend any deadline.

## 5. Changes to the Portal

We may modify, suspend, or discontinue any part of the Portal at any time.
We may also update these Terms. When we do:

- The effective version shown above will change.
- You will be asked to accept the new version on your next login.
- Continued use of the Portal after acceptance constitutes your agreement.

## 6. Termination

We may suspend or terminate your access to the Portal if you violate these
Terms, if your lease ends, or for any other lawful reason. Termination of
Portal access does not affect your obligations under the Contract of Lease.

## 7. Limitation of Liability

The Portal is provided "as is". To the maximum extent permitted by law:

- We do not warrant that the Portal will be uninterrupted or error-free.
- We are not liable for indirect, incidental, or consequential damages
  arising from your use of the Portal.
- Nothing in these Terms limits any rights you have under the Philippine
  Consumer Act or other applicable law.

## 8. Governing Law

These Terms are governed by the laws of the Republic of the Philippines.
Any dispute arising from these Terms shall be brought before the proper
courts of Rizal Province.

## 9. Contact

Eve's Residences Management
# 69 Matahimik St., Riverside II, Brgy. Sto. Domingo, Cainta, Rizal
Facebook Messenger: Eve's Residences Official Page
`,
  },

  {
    path: "public/legal/privacy.md",
    content: `# Privacy Policy

**Effective date:** 6 October 2026
**Version:** 1.0

This Privacy Policy explains how Eve's Residences management ("we", "us",
"our") collects, uses, stores, and protects your personal information when
you use the Eve's Residences Tenant Portal (the "Portal").

We process personal information in accordance with the **Data Privacy Act
of 2012 (Republic Act No. 10173)** and its Implementing Rules and
Regulations.

## 1. Information We Collect

**Information you provide:**

- **Identity:** Full name, date of birth, gender, nationality, civil status,
  government-issued ID number
- **Contact:** Mobile number, email address, Facebook/Messenger name
- **Address:** Permanent address, recent address
- **Employment:** Company name, position, work status, company contact
  details (only if you choose to provide them)
- **Emergency contacts:** Names and contact details of two persons you
  designate
- **Unit inspection:** Condition reports and comments you submit for your
  leased unit
- **Profile photo** (if you upload one)

**Information we collect automatically:**

- Login timestamps and IP addresses
- Actions taken within the Portal (for audit and security purposes)
- Session data managed by our authentication provider (Supabase)

**Information we generate:**

- Lease records, invoices, payment records, deposit records, meter readings,
  and audit log entries associated with your account

## 2. How We Use Your Information

We use your personal information to:

- Provide you with access to the Portal and your own records
- Verify your identity when you contact us
- Process rent, utility, and other charges associated with your lease
- Send you notifications about upcoming due dates and lease events
- Comply with legal, tax, and regulatory obligations
- Respond to inquiries and resolve disputes
- Maintain internal records in accordance with business practices

We do **not**:

- Sell your personal information to third parties
- Share your information with advertisers
- Use your information for purposes other than those listed above without
  your consent

## 3. Who Can Access Your Information

**Within Eve's Residences:**

- Authorized staff (Accounting, Property Representatives, Management) may
  access your records as required to perform their duties
- Access is logged and can be audited
- Staff are bound by confidentiality obligations

**Service providers:**

We use the following third-party services that may process your data:

- **Supabase** - database hosting, authentication, file storage
- **Vercel** - application hosting
- **Resend** - transactional email delivery (if applicable)
- **Google Drive** - receipt image archival (if applicable)

These providers process your data only on our instructions and are bound
by their own data protection commitments.

**Legal disclosures:**

We may disclose your information if required by law, court order, or
lawful request from a government authority.

## 4. How We Protect Your Information

We implement reasonable and appropriate security measures, including:

- Role-based access controls that limit staff access to what they need
- Row-level security policies in our database that prevent unauthorized
  access to tenant records
- Encrypted connections (HTTPS) for all Portal traffic
- Audit logging of sensitive operations
- Regular review of access permissions

However, no system is 100% secure. If you suspect a security incident
affecting your account, contact us immediately.

## 5. How Long We Keep Your Information

We retain your personal information for as long as:

- You have an active lease with us, or
- It is required by law, regulation, or our legitimate business purposes
  (typically up to 5 years after the end of your lease, consistent with
  Philippine record-keeping requirements for financial and contractual
  records)

After the retention period, we securely delete or anonymize your data.

## 6. Your Rights

Under the Data Privacy Act, you have the right to:

- **Be informed** about how your data is processed
- **Object** to the processing of your data in certain circumstances
- **Access** the personal information we hold about you
- **Correct** any inaccurate or outdated information
- **Erasure or blocking** of your data in certain circumstances
- **Damages** for violations of your rights
- **Data portability** where applicable
- **File a complaint** with the National Privacy Commission

To exercise any of these rights, contact us using the details below. We
will respond within the timeframe required by law.

## 7. Cookies and Sessions

The Portal uses cookies strictly necessary for authentication and session
management. We do not use advertising or tracking cookies.

## 8. Changes to This Policy

We may update this Privacy Policy to reflect changes in our practices or
applicable law. When we do:

- The effective version shown above will change
- You will be asked to accept the new version on your next login

## 9. Contact and Data Protection Officer

For privacy-related inquiries, requests, or complaints:

**Eve's Residences Management**
# 69 Matahimik St., Riverside II, Brgy. Sto. Domingo, Cainta, Rizal
Facebook Messenger: Eve's Residences Official Page
`,
  },

  {
    path: "src/app/(public)/portal/terms/page.tsx",
    content: `import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-static";

async function loadMarkdown(): Promise<string> {
  const filePath = path.join(process.cwd(), "public", "legal", "terms.md");
  return readFile(filePath, "utf8");
}

function renderMarkdown(md: string): string {
  const lines = md.split("\\n");
  const out: string[] = [];
  let inList = false;

  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>")
      .replace(
        /\\[([^\\]]+)\\]\\(([^)]+)\\)/g,
        '<a href="$2" class="text-brand-600 underline dark:text-brand-400">$1</a>'
      );

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^#\\s+/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push('<h1 class="mt-8 mb-4 text-3xl font-bold tracking-tight text-ink-900">' + inline(line.replace(/^#\\s+/, "")) + "</h1>");
      continue;
    }
    if (/^##\\s+/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push('<h2 class="mt-8 mb-3 text-xl font-semibold tracking-tight text-ink-900">' + inline(line.replace(/^##\\s+/, "")) + "</h2>");
      continue;
    }
    if (/^###\\s+/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push('<h3 class="mt-6 mb-2 text-lg font-semibold text-ink-900">' + inline(line.replace(/^###\\s+/, "")) + "</h3>");
      continue;
    }
    if (/^-\\s+/.test(line)) {
      if (!inList) { out.push('<ul class="my-3 list-disc space-y-1 pl-6 text-ink-700">'); inList = true; }
      out.push("<li>" + inline(line.replace(/^-\\s+/, "")) + "</li>");
      continue;
    }
    if (line === "") {
      if (inList) { out.push("</ul>"); inList = false; }
      continue;
    }
    if (inList) { out.push("</ul>"); inList = false; }
    out.push('<p class="my-3 text-ink-700">' + inline(line) + "</p>");
  }

  if (inList) out.push("</ul>");
  return out.join("\\n");
}

export default async function TermsPage() {
  const md = await loadMarkdown();
  const html = renderMarkdown(md);

  return (
    <div className="min-h-screen bg-ink-50/60 dark:bg-[#0a0b0f]">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/portal/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 transition-colors hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to portal
        </Link>

        <article
          className="mt-6 rounded-2xl border border-ink-200 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-[#111318] md:p-10"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
`,
  },

  {
    path: "src/app/(public)/portal/privacy/page.tsx",
    content: `import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-static";

async function loadMarkdown(): Promise<string> {
  const filePath = path.join(process.cwd(), "public", "legal", "privacy.md");
  return readFile(filePath, "utf8");
}

function renderMarkdown(md: string): string {
  const lines = md.split("\\n");
  const out: string[] = [];
  let inList = false;

  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\\*\\*([^*]+)\\*\\*/g, "<strong>$1</strong>")
      .replace(
        /\\[([^\\]]+)\\]\\(([^)]+)\\)/g,
        '<a href="$2" class="text-brand-600 underline dark:text-brand-400">$1</a>'
      );

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^#\\s+/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push('<h1 class="mt-8 mb-4 text-3xl font-bold tracking-tight text-ink-900">' + inline(line.replace(/^#\\s+/, "")) + "</h1>");
      continue;
    }
    if (/^##\\s+/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push('<h2 class="mt-8 mb-3 text-xl font-semibold tracking-tight text-ink-900">' + inline(line.replace(/^##\\s+/, "")) + "</h2>");
      continue;
    }
    if (/^###\\s+/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push('<h3 class="mt-6 mb-2 text-lg font-semibold text-ink-900">' + inline(line.replace(/^###\\s+/, "")) + "</h3>");
      continue;
    }
    if (/^-\\s+/.test(line)) {
      if (!inList) { out.push('<ul class="my-3 list-disc space-y-1 pl-6 text-ink-700">'); inList = true; }
      out.push("<li>" + inline(line.replace(/^-\\s+/, "")) + "</li>");
      continue;
    }
    if (line === "") {
      if (inList) { out.push("</ul>"); inList = false; }
      continue;
    }
    if (inList) { out.push("</ul>"); inList = false; }
    out.push('<p class="my-3 text-ink-700">' + inline(line) + "</p>");
  }

  if (inList) out.push("</ul>");
  return out.join("\\n");
}

export default async function PrivacyPage() {
  const md = await loadMarkdown();
  const html = renderMarkdown(md);

  return (
    <div className="min-h-screen bg-ink-50/60 dark:bg-[#0a0b0f]">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/portal/login"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-500 transition-colors hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to portal
        </Link>

        <article
          className="mt-6 rounded-2xl border border-ink-200 bg-white p-6 shadow-sm dark:border-white/[0.06] dark:bg-[#111318] md:p-10"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
`,
  },

  {
    path: "supabase/migrations/20261006000100_tenant_user_terms.sql",
    content: `-- Records the terms/privacy version agreed to by each linked tenant.

alter table core.tenant_user
  add column if not exists terms_version_agreed text,
  add column if not exists terms_agreed_at timestamptz;

notify pgrst, 'reload schema';
`,
  },
];

// ===========================================================================
// PART 2 — Modifies
// ===========================================================================

// --- accept-invite-form.tsx ---
const INVITE_FORM_PATH = "src/app/(public)/portal/accept-invite/accept-invite-form.tsx";
const INVITE_FORM_SIG = `      <Button type="submit" loading={pending} className="w-full">
        Create account and continue
      </Button>`;

const INVITE_FORM_NEW = `"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { acceptInviteAction } from "./actions";

export function AcceptInviteForm({ token }: { token: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!agreed) {
      setError("You must accept the Terms and Privacy Policy to continue");
      return;
    }

    start(async () => {
      const res = await acceptInviteAction({
        token,
        email: trimmed,
        password,
        agreed_terms_version: "1.0",
      });
      if (!res.ok) {
        setError(res.error);
        toast.push(res.error, "error");
        return;
      }
      toast.push("Welcome", "success");
      router.push("/portal");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        autoComplete="email"
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 8 characters"
        required
        autoComplete="new-password"
      />
      <Input
        label="Confirm password"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
        autoComplete="new-password"
      />

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-200 bg-ink-50/40 p-3 transition-colors hover:bg-ink-50 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:bg-white/[0.04]">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-ink-300 text-brand-600 focus:ring-2 focus:ring-brand-500/30 dark:border-white/[0.15]"
        />
        <span className="text-xs leading-relaxed text-ink-700 dark:text-ink-300">
          I have read and agree to the{" "}
          <Link
            href="/portal/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-600 underline hover:text-brand-700 dark:text-brand-400"
          >
            Terms and Conditions
          </Link>{" "}
          and{" "}
          <Link
            href="/portal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-600 underline hover:text-brand-700 dark:text-brand-400"
          >
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      {error && (
        <div className="rounded-md border border-danger-500/30 bg-danger-500/5 px-3 py-2 text-xs text-danger-700 dark:text-danger-500">
          {error}
        </div>
      )}

      <Button
        type="submit"
        loading={pending}
        disabled={!agreed}
        className="w-full"
      >
        Create account and continue
      </Button>
    </form>
  );
}
`;

// --- accept-invite/actions.ts ---
const INVITE_ACTIONS_PATH = "src/app/(public)/portal/accept-invite/actions.ts";
const INVITE_ACTIONS_SIG_INPUT = `export async function acceptInviteAction(input: {
  token: string;
  email: string;
  password: string;
}): Promise<ActionResult<{ email: string }>> {`;
const INVITE_ACTIONS_NEW_INPUT = `export async function acceptInviteAction(input: {
  token: string;
  email: string;
  password: string;
  agreed_terms_version: string;
}): Promise<ActionResult<{ email: string }>> {`;

const INVITE_ACTIONS_SIG_INSERT = `  const { error: linkErr } = await admin
    .schema("core")
    .from("tenant_user")
    .insert({
      auth_user_id: newUserId,
      tenant_id: invite.tenant_id,
      relationship: "self",
      verified_at: new Date().toISOString(),
    });`;
const INVITE_ACTIONS_NEW_INSERT = `  const { error: linkErr } = await admin
    .schema("core")
    .from("tenant_user")
    .insert({
      auth_user_id: newUserId,
      tenant_id: invite.tenant_id,
      relationship: "self",
      verified_at: new Date().toISOString(),
      terms_version_agreed: input.agreed_terms_version,
      terms_agreed_at: new Date().toISOString(),
    });`;

// --- middleware.ts ---
const MW_PATH = "src/middleware.ts";
const MW_SIG = `const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/_next",
  "/api/cron",
  "/portal/accept-invite",
  "/portal/login",
  "/portal/logout",
];`;
const MW_NEW = `const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/_next",
  "/api/cron",
  "/portal/accept-invite",
  "/portal/login",
  "/portal/logout",
  "/portal/terms",
  "/portal/privacy",
];`;

// ===========================================================================
// Runner
// ===========================================================================

function ensureDirForFile(p) {
  const dir = dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

console.log("=== apply-chunk-8-terms-privacy.mjs ===");
console.log("");

console.log("--- Part 1: new files ---");
let newWritten = 0;
let newSkipped = 0;
for (const f of NEW_FILES) {
  if (existsSync(f.path)) {
    console.log("SKIP   " + f.path + "  (already exists)");
    newSkipped++;
    continue;
  }
  ensureDirForFile(f.path);
  writeFileSync(f.path, f.content, "utf8");
  console.log("WRITE  " + f.path);
  newWritten++;
}
console.log("");
console.log("New files: " + newWritten + " written, " + newSkipped + " skipped");
console.log("");

console.log("--- Part 2: modifies ---");

// 2a. accept-invite-form.tsx
if (!existsSync(INVITE_FORM_PATH)) {
  console.error("MISSING  " + INVITE_FORM_PATH);
} else {
  const src = readFileSync(INVITE_FORM_PATH, "utf8");
  if (src.includes("agreed_terms_version")) {
    console.log("SKIP   " + INVITE_FORM_PATH + "  (already patched)");
  } else if (!src.includes(INVITE_FORM_SIG)) {
    console.error("ABORT  " + INVITE_FORM_PATH + "  (signature not found)");
  } else {
    copyFileSync(INVITE_FORM_PATH, INVITE_FORM_PATH + ".bak");
    writeFileSync(INVITE_FORM_PATH, INVITE_FORM_NEW, "utf8");
    console.log("REPLACE " + INVITE_FORM_PATH);
  }
}

// 2b. accept-invite/actions.ts
if (!existsSync(INVITE_ACTIONS_PATH)) {
  console.error("MISSING  " + INVITE_ACTIONS_PATH);
} else {
  let src = readFileSync(INVITE_ACTIONS_PATH, "utf8");

  if (src.includes("terms_version_agreed")) {
    console.log("SKIP   " + INVITE_ACTIONS_PATH + "  (already patched)");
  } else {
    const hasInput = src.includes(INVITE_ACTIONS_SIG_INPUT);
    const hasInsert = src.includes(INVITE_ACTIONS_SIG_INSERT);

    if (!hasInput) {
      console.error("ABORT  " + INVITE_ACTIONS_PATH + "  (input signature not found)");
    } else if (!hasInsert) {
      console.error("ABORT  " + INVITE_ACTIONS_PATH + "  (insert signature not found)");
    } else {
      src = src.replace(INVITE_ACTIONS_SIG_INPUT, INVITE_ACTIONS_NEW_INPUT);
      src = src.replace(INVITE_ACTIONS_SIG_INSERT, INVITE_ACTIONS_NEW_INSERT);
      copyFileSync(INVITE_ACTIONS_PATH, INVITE_ACTIONS_PATH + ".bak");
      writeFileSync(INVITE_ACTIONS_PATH, src, "utf8");
      console.log("PATCH  " + INVITE_ACTIONS_PATH);
    }
  }
}

// 2c. middleware.ts
if (!existsSync(MW_PATH)) {
  console.error("MISSING  " + MW_PATH);
} else {
  const src = readFileSync(MW_PATH, "utf8");
  if (src.includes(`"/portal/terms"`)) {
    console.log("SKIP   " + MW_PATH + "  (already patched)");
  } else if (!src.includes(MW_SIG)) {
    console.error("ABORT  " + MW_PATH + "  (PUBLIC_PATHS signature not found)");
  } else {
    copyFileSync(MW_PATH, MW_PATH + ".bak");
    writeFileSync(MW_PATH, src.replace(MW_SIG, MW_NEW), "utf8");
    console.log("PATCH  " + MW_PATH);
  }
}

console.log("");
console.log("=== Done ===");
console.log("");
console.log("Next steps:");
console.log("  1. Apply the migration:");
console.log("     supabase/migrations/20261006000100_tenant_user_terms.sql");
console.log("     - Use 'npx supabase db push' OR paste into the SQL editor");
console.log("     - THEN restart the Supabase project (Settings -> General)");
console.log("");
console.log("  2. npm run typecheck");
console.log("  3. git add . && git commit -m \"Add Terms and Privacy with mandatory agreement\" && git push");
console.log("  4. Wait for Vercel deploy, then test:");
console.log("     - /portal/terms  and  /portal/privacy  render");
console.log("     - The invite form has a checkbox and submit is disabled until checked");