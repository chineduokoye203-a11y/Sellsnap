import 'dotenv/config';
import dns from 'dns';
import { Resend } from 'resend';

dns.setDefaultResultOrder('ipv4first');

const apiKey = process.env.RESEND_API_KEY;
console.log('Testing Resend with API key:', apiKey ? `${apiKey.substring(0, 7)}...` : 'undefined');

if (!apiKey) {
  console.error('❌ RESEND_API_KEY is not defined in environment');
  process.exit(1);
}

const resend = new Resend(apiKey);

async function testEmail() {
  try {
    console.log('Sending test email from noreply@sellsnap.app...');
    const response = await resend.emails.send({
      from: 'SellSnap <noreply@sellsnap.app>',
      to: 'onboarding@resend.dev',
      subject: 'Test Email from SellSnap',
      html: '<p>If you see this, custom domain noreply@sellsnap.app is working!</p>'
    });
    console.log('Response:', response);
  } catch (error) {
    console.error('❌ Failed with custom domain:', error);
  }

  try {
    console.log('\nSending test email from onboarding@resend.dev (default sandbox)...');
    const response = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'onboarding@resend.dev',
      subject: 'Test Sandbox Email from SellSnap',
      html: '<p>If you see this, onboarding@resend.dev sandbox is working!</p>'
    });
    console.log('Response:', response);
  } catch (error) {
    console.error('❌ Failed with sandbox:', error);
  }
}

testEmail();
