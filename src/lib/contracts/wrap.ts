export function wrapPrintableHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en-PH">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 24px; color: #111; }
  h1 { font-size: 22px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  p  { margin: 8px 0; }
  .meta { text-align: center; color: #666; font-size: 13px; margin-bottom: 32px; }
  .signature-block { margin-top: 64px; display: flex; gap: 40px; }
  .signature-block > div { flex: 1; }
  .sig-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 6px; font-size: 12px; }
  .sig-img { max-width: 240px; max-height: 90px; margin-top: 12px; }
  @media print { body { margin: 0; padding: 24px; } }
</style>
</head>
<body>${body}</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
