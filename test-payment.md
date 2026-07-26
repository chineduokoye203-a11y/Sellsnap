# Payment Testing Guide

## Issue Fixed
The "Pay Now" button was not working because:
1. Form had conflicting `action` attribute and `onSubmit` handler
2. API was returning a redirect instead of JSON
3. No error feedback was shown to users

## Fixes Applied
1. Removed `action="/api/orders"` from form - now uses client-side onSubmit only
2. Changed API to return JSON with `{ ok: true, url: paymentUrl }` instead of redirect
3. Added error state and loading state to the checkout form
4. Added error display styling

## To Test Payments

### 1. Get Flutterwave Test Keys
1. Go to https://dashboard.flutterwave.com/settings/apis
2. Make sure you're in **Test Mode** (toggle at top of dashboard)
3. Copy your **Test API Public Key** and **Secret Key**

### 2. Update .env file
Replace the placeholder values in `.env`:
```
FLUTTERWAVE_PUBLIC_KEY="FLWPUBK_TEST-your-actual-key-here"
FLUTTERWAVE_SECRET_KEY="FLWSECK_TEST-your-actual-key-here"
```

### 3. Set up Webhook (for payment verification)
1. In Flutterwave dashboard, go to Settings > Webhooks
2. Set webhook URL to: `https://your-domain.com/api/webhooks/flutterwave`
3. Set webhook secret hash to match `FLUTTERWAVE_SECRET_HASH` in your .env (currently: "sellsnap-secret-hash")

### 4. Test the Flow
1. Start dev server: `npm run dev`
2. Visit a product page: `http://localhost:3000/p/[product-slug]`
3. Enter email and name
4. Click "Pay Now"
5. You should be redirected to Flutterwave test payment page
6. Use test card: 5531 8866 5393 4469, CVV: 564, PIN: 3310, OTP: 12345

## Current Status
- ✅ Form submission fixed
- ✅ Error handling added
- ✅ Loading states added
- ⚠️ Need real Flutterwave keys for actual payments
- ⚠️ Webhook needs to be configured for production
