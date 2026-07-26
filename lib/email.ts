import nodemailer from 'nodemailer';
import { env } from './env';
import { logger } from './logger';

let transporter: nodemailer.Transporter | null = null;
let fromAddress = 'SellSnap <noreply@sellsnap.app>';

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  if (env.SMTP_HOST && env.SMTP_PORT) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT),
      secure: env.SMTP_SECURE === 'true',
      auth: env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
    });
    if (env.FROM_EMAIL) {
      fromAddress = `SellSnap <${env.FROM_EMAIL}>`;
    }
    await transporter.verify();
    return transporter;
  }

  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  fromAddress = `SellSnap <${testAccount.user}>`;
  logger.info('email.using_ethereal', {
    user: testAccount.user,
    url: 'https://ethereal.email',
  });
  return transporter;
}

function baseTemplate(title: string, body: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
              <tr>
                <td style="padding:32px 32px 16px 32px;text-align:center;background:linear-gradient(135deg,#7c3aed,#6366f1)">
                  <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700">SellSnap</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:32px">
                  <h2 style="margin:0 0 16px 0;color:#18181b;font-size:20px;font-weight:600">${title}</h2>
                  ${body}
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px;border-top:1px solid #e4e4e7;text-align:center">
                  <p style="margin:0;color:#a1a1aa;font-size:12px">SellSnap &mdash; Sell digital products, get paid instantly</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attempt = 1,
): Promise<{ success: boolean; error?: string }> {
  try {
    const t = await getTransporter();
    const info = await t.sendMail({
      from: fromAddress,
      to,
      subject,
      html,
    });

    if (info.messageId) {
      logger.info('email.sent', { to, subject, messageId: info.messageId });
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('email.send_failed', { to, subject, attempt, error: message });

    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 500;
      await new Promise(r => setTimeout(r, delay));
      return sendEmail(to, subject, html, attempt + 1);
    }

    return { success: false, error: message };
  }
}

export async function sendOrderNotificationEmail(
  sellerEmail: string,
  productName: string,
  amountNGN: number,
  buyerEmail: string,
): Promise<{ success: boolean; error?: string }> {
  return sendEmail(
    sellerEmail,
    `New Payment Received for ${productName}`,
    baseTemplate('Payment Received', `
      <p style="margin:0 0 16px 0;color:#52525b;font-size:15px;line-height:1.6">
        You've received a new payment for your product!
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border-radius:8px;padding:16px;margin-bottom:16px">
        <tr>
          <td style="padding-bottom:8px;color:#71717a;font-size:13px">Product</td>
          <td style="padding-bottom:8px;color:#18181b;font-size:14px;font-weight:600;text-align:right">${productName}</td>
        </tr>
        <tr>
          <td style="padding-bottom:8px;color:#71717a;font-size:13px">Amount</td>
          <td style="padding-bottom:8px;color:#18181b;font-size:14px;font-weight:600;text-align:right">₦${amountNGN.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="color:#71717a;font-size:13px">Buyer</td>
          <td style="color:#18181b;font-size:14px;font-weight:600;text-align:right">${buyerEmail}</td>
        </tr>
      </table>
      <a href="${env.NEXT_PUBLIC_APP_URL}/dashboard" style="display:inline-block;padding:12px 24px;background-color:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">View Dashboard</a>
    `),
  );
}

export async function sendBuyerReceiptEmail(
  buyerEmail: string,
  productName: string,
  amountNGN: number,
  sellerBusinessName: string,
): Promise<{ success: boolean; error?: string }> {
  return sendEmail(
    buyerEmail,
    `Receipt — ${productName}`,
    baseTemplate('Payment Confirmed', `
      <p style="margin:0 0 16px 0;color:#52525b;font-size:15px;line-height:1.6">
        Thank you for your purchase! Here is your receipt.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;border-radius:8px;padding:16px;margin-bottom:16px">
        <tr>
          <td style="padding-bottom:8px;color:#71717a;font-size:13px">Product</td>
          <td style="padding-bottom:8px;color:#18181b;font-size:14px;font-weight:600;text-align:right">${productName}</td>
        </tr>
        <tr>
          <td style="padding-bottom:8px;color:#71717a;font-size:13px">Seller</td>
          <td style="padding-bottom:8px;color:#18181b;font-size:14px;font-weight:600;text-align:right">${sellerBusinessName}</td>
        </tr>
        <tr>
          <td style="color:#71717a;font-size:13px">Amount Paid</td>
          <td style="color:#18181b;font-size:14px;font-weight:600;text-align:right">₦${amountNGN.toLocaleString()}</td>
        </tr>
      </table>
      <p style="margin:16px 0 0 0;color:#a1a1aa;font-size:13px">If you have any questions, please contact the seller directly.</p>
    `),
  );
}

export async function sendPasswordResetEmail(
  userEmail: string,
  resetToken: string,
): Promise<{ success: boolean; error?: string }> {
  const resetUrl = `${env.NEXT_PUBLIC_APP_URL}/auth/reset-password/${resetToken}`;

  return sendEmail(
    userEmail,
    'Reset your password',
    baseTemplate('Password Reset', `
      <p style="margin:0 0 16px 0;color:#52525b;font-size:15px;line-height:1.6">
        We received a request to reset your password. Click the button below to set a new one.
      </p>
      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background-color:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;margin-bottom:16px">Reset Password</a>
      <p style="margin:0;color:#a1a1aa;font-size:13px;line-height:1.5">
        Or copy and paste this link into your browser:<br/>
        <span style="color:#52525b;word-break:break-all">${resetUrl}</span>
      </p>
      <p style="margin:16px 0 0 0;color:#a1a1aa;font-size:13px">
        This link expires in 1 hour. If you did not request this, you can safely ignore this email.
      </p>
    `),
  );
}

export async function sendWelcomeEmail(
  userEmail: string,
  userName: string,
): Promise<{ success: boolean; error?: string }> {
  return sendEmail(
    userEmail,
    'Welcome to SellSnap',
    baseTemplate('Welcome to SellSnap', `
      <p style="margin:0 0 16px 0;color:#52525b;font-size:15px;line-height:1.6">
        Hi ${userName},
      </p>
      <p style="margin:0 0 16px 0;color:#52525b;font-size:15px;line-height:1.6">
        Welcome to SellSnap! You can now create product pages and start selling digital products instantly.
      </p>
      <a href="${env.NEXT_PUBLIC_APP_URL}/dashboard/products/new" style="display:inline-block;padding:12px 24px;background-color:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">Create Your First Product</a>
    `),
  );
}
