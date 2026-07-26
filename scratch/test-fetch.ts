import 'dotenv/config';
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  console.log('Sending raw fetch to Resend with ipv4first...');
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: 'onboarding@resend.dev',
        subject: 'Raw Fetch Test',
        html: '<p>Raw fetch test with ipv4first</p>'
      })
    });
    console.log('Status:', response.status);
    const json = await response.json();
    console.log('JSON:', json);
  } catch (error: any) {
    console.error('❌ Raw fetch failed:', error);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  }
}

main();
