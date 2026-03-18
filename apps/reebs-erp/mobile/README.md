# Reebs Manager App (iOS + Android)

Minimal Expo app for manager-only access to new orders and bookings with push notifications.

## Quick start

```bash
cd mobile
npm install
npm run start
```

## Required env / config

Backend (Netlify environment variables):
- `MANAGER_PIN_HASH` (hash for the 6-digit PIN)
- `MANAGER_APP_SECRET` (random secret for session tokens)
- `DATABASE_URL`

Generate the PIN hash:
```bash
node scripts/hashManagerPin.js 123456
```

Expo app config:
- `EXPO_PUBLIC_API_BASE_URL` (default: `https://portal.reebspartythemes.com`)
- `expo.extra.apiBaseUrl` in `mobile/app.json` for production
- `expo.extra.expoProjectId` in `mobile/app.json` for push tokens

## Push notification setup

This app uses Expo push tokens and the Expo push service. You still need:
- Apple Developer (APNs) credentials
- Firebase project for Android (FCM)

You can upload credentials using Expo EAS:
```bash
npx expo login
npx expo prebuild
npx expo run:ios
npx expo run:android
```

Then set the Expo project ID in `mobile/app.json`:
```json
"extra": {
  "apiBaseUrl": "https://portal.reebspartythemes.com",
  "expoProjectId": "YOUR_EXPO_PROJECT_ID"
}
```

## Manager API endpoints

The app expects these Netlify Functions:
- `POST /.netlify/functions/managerLogin` (PIN login)
- `POST /.netlify/functions/managerTokens` (register device)
- `GET /.netlify/functions/managerOrders`
- `GET /.netlify/functions/managerBookings`
