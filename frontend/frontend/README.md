# RemindMe Frontend

RemindMe Frontend is the browser-based student workspace for the RemindMe academic companion app. It is built with plain HTML, CSS, and JavaScript, so it can run directly in a browser or be served as a static site.

## Features

- Login and account creation screens for the prototype flow
- Dashboard with today's schedule, deadlines, announcements, and priority tasks
- Weekly class schedule management
- Schedule image upload flow with review before confirming detected details
- Subject workspaces
- Academic task tracking with filters for all, upcoming, completed, and overdue work
- Shared notes with links and supported file uploads
- Announcement feed
- Browser notification demo for upcoming reminders
- Calendar view with completed, upcoming, overdue, and current-day status colors
- Classroom collaboration screen with invite link and QR area
- Profile screen, theme toggle, collapsible sidebar, remembered accounts, and global search
- Offline-first local storage with backend sync when the API is available

## Project Structure

```text
frontend/
  assets/
    remindme-logo.png
  js/
    api.js
    app.js
    priority.js
    render.js
    store.js
  index.html
  styles.css
```

This is the browser frontend. Expo/React Native components are intentionally kept in `../mobile/`, and API/database code is intentionally kept in `../backend/`. See `../docs/ARCHITECTURE.md` for ownership rules.

## Requirements

- A modern browser
- Optional: Node.js if you want to serve the static frontend locally
- Optional: the RemindMe backend running at `http://localhost:4000/api`

The frontend can still open without the backend. It stores data in browser `localStorage` and shows the sync status as offline when the API is unavailable.

## Run Locally

Open the app directly:

```text
frontend/index.html
```

Or serve it with a local static server from the project root:

```bash
npx serve frontend
```

Then open the URL shown by the server.

## Backend Connection

The API base URL is defined in:

```text
js/config.js
```

Default value:

```js
globalThis.REMINDME_API_URL = "http://localhost:4000/api";
```

Start the backend before using sync, uploads, classroom APIs, or remote workspace data:

```bash
cd backend
npm install
npm run dev
```

Health check:

```text
http://localhost:4000/api/health
```

For a hosted frontend, change `js/config.js` to your hosted backend's **HTTPS** URL, for example `https://your-api.example.com/api`. Do not use `localhost` in a deployed site.

## Local Data

The frontend uses these browser storage keys:

- `remindme-state-v1` for workspace data
- `remindme-remembered-accounts` for remembered login accounts
- `remindme-theme` for light or dark mode
- `remindme-sidebar` for sidebar state
- `remindme-session` in `sessionStorage` for the active prototype session

To reset the prototype, clear the browser site data for the frontend page.

## Upload Support

The UI accepts these file types for notes and study materials:

- PDF
- DOC and DOCX
- PPT and PPTX
- ZIP
- PNG, JPG, JPEG, WEBP, and GIF

Uploads require the backend and Supabase Storage environment variables to be configured.

## Development Notes

- This is a static frontend with no build step.
- JavaScript modules are loaded from `index.html` with `<script type="module" src="js/app.js"></script>`.
- The app starts with demo student data from `js/store.js`.
- Remote sync attempts to load the backend workspace on startup and writes local changes back through `PUT /api/workspace`.
- Authentication uses Supabase Auth. The browser only receives the public anon key; service-role credentials remain on the backend.
