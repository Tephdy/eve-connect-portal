import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const cache = new Map<string, string>();

/**
 * Reads a PNG from public/ and returns a data URI.
 * Defaults to public/eves_logo.png.
 */
const DEFAULT_LOGO = "eves_logo.png";

export async function getLogoDataUri(filename: string = DEFAULT_LOGO): Promise<string> {
  const hit = cache.get(filename);
  if (hit) return hit;

  const path = join(process.cwd(), "public", filename);
  const buf = await readFile(path);
  const uri = "data:image/png;base64," + buf.toString("base64");
  cache.set(filename, uri);
  return uri;
}
