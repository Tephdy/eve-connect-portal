import "server-only";
import QRCode from "qrcode";

const cache = new Map<string, string>();

/**
 * Returns a data-URI: "data:image/png;base64,iVBORw0KGgo..."
 * Cached in-process because the same contract URL is regenerated on
 * every preview, print, and re-download.
 */
export async function qrDataUri(text: string): Promise<string> {
  const hit = cache.get(text);
  if (hit) return hit;

  const buffer = await QRCode.toBuffer(text, {
    type: "png",
    errorCorrectionLevel: "H", // highest — survives ~30% damage
    margin: 1,
    width: 200,
    color: { dark: "#111111", light: "#ffffff" },
  });
  const uri = "data:image/png;base64," + buffer.toString("base64");
  cache.set(text, uri);
  return uri;
}
