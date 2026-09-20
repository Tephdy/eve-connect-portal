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
