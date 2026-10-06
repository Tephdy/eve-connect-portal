import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-static";

async function loadMarkdown(): Promise<string> {
  const filePath = path.join(process.cwd(), "public", "legal", "privacy.md");
  return readFile(filePath, "utf8");
}

function renderMarkdown(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;

  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" class="text-brand-600 underline dark:text-brand-400">$1</a>'
      );

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (/^#\s+/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push('<h1 class="mt-8 mb-4 text-3xl font-bold tracking-tight text-ink-900">' + inline(line.replace(/^#\s+/, "")) + "</h1>");
      continue;
    }
    if (/^##\s+/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push('<h2 class="mt-8 mb-3 text-xl font-semibold tracking-tight text-ink-900">' + inline(line.replace(/^##\s+/, "")) + "</h2>");
      continue;
    }
    if (/^###\s+/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push('<h3 class="mt-6 mb-2 text-lg font-semibold text-ink-900">' + inline(line.replace(/^###\s+/, "")) + "</h3>");
      continue;
    }
    if (/^-\s+/.test(line)) {
      if (!inList) { out.push('<ul class="my-3 list-disc space-y-1 pl-6 text-ink-700">'); inList = true; }
      out.push("<li>" + inline(line.replace(/^-\s+/, "")) + "</li>");
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
  return out.join("\n");
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
