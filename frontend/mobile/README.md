# RemindMe Mobile (Expo Go)

This React Native app runs directly in Expo Go—no EAS build or APK is required for development and testing. App data is saved locally first and syncs to the RemindMe backend whenever the phone can reach it.

## Run in a Browser

From `mobile`, run:

```bash
npm run web
```

Expo opens the app at `http://localhost:8081`. The browser version supports the same login, classroom, schedule, task, note, announcement, file-selection, and backend-sync flows as Expo Go, using browser storage for local data.

The native scheduled-reminder API is intentionally skipped on web because browsers cannot schedule Expo local notifications. Reminders still appear in the app's Notifications screen.

## Run on Your Phone

1. Install Expo Go from the Play Store.
2. Put your phone and development computer on the same Wi-Fi network.
3. Start the backend with `npm run start:lan` in `backend`.
4. Start the mobile app with `npm start` in `mobile`.
5. Scan the QR code in Expo Go.

Expo Go on LAN automatically uses the computer address from its current Expo session, so do not put a LAN IP in `EXPO_PUBLIC_API_URL`. When moving to a new Wi-Fi network or hotspot, keep the backend running and restart Expo (`npm start`); scan the new QR code or reload Expo Go. No `.env` change is needed. Ensure Windows Firewall allows Node.js on private networks.

For browser testing, production builds, or a publicly hosted backend, set `EXPO_PUBLIC_API_URL` to that stable API URL. Browser testing against a local backend can use `http://localhost:4000/api`.

Use `npm run start:tunnel` only when LAN mode cannot connect. The backend URL must still be publicly reachable or on the same local network for uploads and remote sync.

## Database Behaviour

- The app stores an offline copy in AsyncStorage on the phone.
- When the API is configured, each email address syncs to its own backend workspace at `/api/workspace/mobile/:email`.
- The backend uses WAMP/MySQL when `DATABASE_PROVIDER=mysql`; `src/data/database.json` is only a temporary fallback.
- Uploads use Supabase Storage through the authenticated backend.

Supabase client settings are kept in `.env`; use only the public anon key in this file and never commit real secrets.

## Component Ownership

This folder is the mobile frontend. Keep reusable React Native controls in `src/components/`, feature views in `src/screens/`, and phone-side API/offline/Supabase SDK code in `src/services/`. Server-only routes, database access, and private keys belong in `../backend/` only. See `../docs/ARCHITECTURE.md` for the full boundary.
