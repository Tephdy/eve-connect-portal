import "server-only";

export function receiptEmailHtml(input: {
  tenant_name: string;
  receipt_number: string;
  invoice_number: string | null;
  amount: string;
  method: string;
  paid_at: string;
  property_name: string;
  unit_number: string;
}): string {
  return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
  <h2 style="color: #2b5797;">Payment Receipt</h2>
  <p>Hi ${input.tenant_name},</p>
  <p>Thank you for your payment. Details below:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 6px 0; color: #666;">Receipt No.</td><td style="text-align: right;"><strong>${input.receipt_number}</strong></td></tr>
    <tr><td style="padding: 6px 0; color: #666;">Invoice No.</td><td style="text-align: right;">${input.invoice_number ?? "—"}</td></tr>
    <tr><td style="padding: 6px 0; color: #666;">Property</td><td style="text-align: right;">${input.property_name}</td></tr>
    <tr><td style="padding: 6px 0; color: #666;">Unit</td><td style="text-align: right;">${input.unit_number}</td></tr>
    <tr><td style="padding: 6px 0; color: #666;">Method</td><td style="text-align: right;">${input.method}</td></tr>
    <tr><td style="padding: 6px 0; color: #666;">Date</td><td style="text-align: right;">${input.paid_at}</td></tr>
    <tr style="border-top: 2px solid #2b5797;"><td style="padding: 12px 0; font-weight: 600;">Amount paid</td><td style="padding: 12px 0; text-align: right; font-weight: 700; color: #1e7a3a;">${input.amount}</td></tr>
  </table>
  <p style="color: #666; font-size: 13px;">This is an automated receipt. Please keep it for your records.</p>
</body>
</html>`;
}

export function reminderEmailHtml(input: {
  recipient_name: string;
  title: string;
  items: { label: string; value: string; href?: string }[];
  cta_label?: string;
  cta_href?: string;
  severity?: "info" | "warning" | "danger";
}): string {
  const color =
    input.severity === "danger"
      ? "#b91c1c"
      : input.severity === "warning"
      ? "#b45309"
      : "#1d4ed8";
  const bg =
    input.severity === "danger"
      ? "#fef2f2"
      : input.severity === "warning"
      ? "#fffbeb"
      : "#eff6ff";

  const rows = input.items
    .map(
      (it) => `<tr>
      <td style="padding: 8px 0; color: #666; vertical-align: top;">${it.label}</td>
      <td style="padding: 8px 0; text-align: right; font-weight: 500; color: #111;">
        ${it.href ? `<a href="${it.href}" style="color: ${color}; text-decoration: none;">${it.value}</a>` : it.value}
      </td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
  <div style="padding: 16px 20px; background: ${bg}; border-left: 4px solid ${color}; border-radius: 6px; margin-bottom: 24px;">
    <h2 style="margin: 0; color: ${color}; font-size: 18px;">${input.title}</h2>
  </div>

  <p>Hi ${input.recipient_name},</p>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    ${rows}
  </table>

  ${
    input.cta_label && input.cta_href
      ? `<a href="${input.cta_href}" style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: ${color}; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">${input.cta_label}</a>`
      : ""
  }

  <p style="color: #999; font-size: 12px; margin-top: 32px;">
    You're receiving this because you have an account on the Apartment Portal.<br/>
    Manage your notification preferences in Settings.
  </p>
</body>
</html>`;
}
