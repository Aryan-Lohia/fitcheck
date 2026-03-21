const BRAND_COLOR = "#6C5CE7";

export function emailLayout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 0">
<tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
    <tr><td style="background-color:${BRAND_COLOR};padding:24px 32px">
      <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px">FitCheck</span>
    </td></tr>
    <tr><td style="padding:32px">${body}</td></tr>
    <tr><td style="padding:16px 32px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center">
      &copy; ${new Date().getFullYear()} FitCheck. All rights reserved.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}
