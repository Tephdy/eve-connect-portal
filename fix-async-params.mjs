#!/usr/bin/env node
/**
 * fix-async-params.mjs
 * Finds Next.js 14 params/searchParams signatures and rewrites them for Next 15.
 * Usage: node fix-async-params.mjs [--dry]
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";

const DRY = process.argv.includes("--dry");
const ROOT = process.cwd();
const APP_DIR = join(ROOT, "src", "app");

async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (e.isFile() && /page\.tsx$/.test(e.name)) out.push(full);
  }
  return out;
}

const files = await walk(APP_DIR);
console.log("");
console.log("Scanning " + files.length + " page.tsx files.\n");

const problems = [];

for (const file of files) {
  const src = await readFile(file, "utf8");
  const rel = relative(ROOT, file).replace(/\\/g, "/");

  // Signature: `params: { ... }` without Promise<>
  const badParams = /\bparams\s*:\s*(?!Promise<)\{/.test(src);
  const badSearch = /\bsearchParams\s*:\s*(?!Promise<)\{/.test(src);

  if (badParams || badSearch) {
    problems.push({ rel, badParams, badSearch });
    console.log("  ! " + rel +
      (badParams ? "  [params]" : "") +
      (badSearch ? "  [searchParams]" : ""));
  }
}

console.log("");
if (problems.length === 0) {
  console.log("All page.tsx files already use the Next 15 async signature.");
  console.log("");
  process.exit(0);
}

console.log(problems.length + " file(s) need the Next 15 async signature.");
console.log("");
console.log("Run `node fix-async-params.mjs --apply` to patch them.");
console.log("");

if (!process.argv.includes("--apply")) process.exit(0);

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

for (const { rel } of problems) {
  const full = join(ROOT, rel);
  let src = await readFile(full, "utf8");

  // 1. Wrap the type in Promise<...> if not already
  src = src.replace(
    /(\bparams\s*:\s*)(?!Promise<)(\{[^{}]*\})/g,
    "$1Promise<$2>"
  );
  src = src.replace(
    /(\bsearchParams\s*:\s*)(?!Promise<)(\{[^{}]*\})/g,
    "$1Promise<$2>"
  );

  // 2. Insert await lines at the top of the default exported function body.
  //    Handles:  export default async function Name({ params, searchParams }: {...}) {
  const headerRe = /(export\s+default\s+async\s+function\s+\w+\s*\([\s\S]*?\)\s*\{)/;
  src = src.replace(headerRe, (header) => {
    const takesParams = /\bparams\b/.test(header) && !/:\s*Promise<[^>]*>\s*[;,)]/.test(header) === false
      ? true
      : /\bparams\b/.test(header);

    const takesSearch = /\bsearchParams\b/.test(header);

    let inject = "";
    if (takesParams && !/const\s+_params\s*=\s*await\s+params/.test(src)) {
      inject += "\n  const _params = await params;";
    }
    if (takesSearch && !/const\s+_sp\s*=\s*await\s+searchParams/.test(src)) {
      inject += "\n  const _sp = await searchParams;";
    }
    return header + inject;
  });

  // 3. Rewrite bare uses inside the body.
  //    Careful: don't touch the header itself, and don't touch Promise<...>.
  //    We do a targeted replace of `params.` and `searchParams.` at word
  //    boundaries, then restore the header if it got mangled (it won't,
  //    because headers use `params,` or `params }`, not `params.`).
  src = src.replace(/(?<![\w.$])params\./g, "_params.");
  src = src.replace(/(?<![\w.$])searchParams\./g, "_sp.");

  await writeFile(full, src, "utf8");
  console.log("  + patched " + rel);
}

console.log("");
console.log("Done. Run: npm run build");
console.log("");