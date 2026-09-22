import "server-only";
import * as bwipjs from "bwip-js";

/**
 * Returns an inline SVG string for a Code 128 barcode encoding `text`.
 * The SVG is self-contained (no external references) so it prints reliably.
 */
export function code128Svg(
  text: string,
  opts?: { height?: number; scale?: number }
): string {
  const svg = (bwipjs as unknown as {
    toSVG: (opts: Record<string, unknown>) => string;
  }).toSVG({
    bcid: "code128",
    text,
    scale: opts?.scale ?? 2,
    height: opts?.height ?? 10,
    includetext: false,
    textxalign: "center",
    backgroundcolor: "FFFFFF",
    paddingwidth: 2,
    paddingheight: 2,
  });
  return svg;
}
