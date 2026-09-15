# RemindMe Backend

RemindMe Backend is the Express API for the RemindMe academic companion app. It supports Supabase-authenticated workspace sync, schedule and task management, notes, announcements, classroom collaboration, notifications, QR generation support, OCR-assisted schedule parsing, and Supabase Storage uploads.

## Features

- Express REST API under `/api`
- MySQL/MariaDB persistence for local development and deployment
- JSON-file database fallback for temporary demos
- Workspace snapshot sync for the static frontend
- CRUD routes for schedules, tasks, notes, and announcements
- Prototype auth routes for register, login, forgot password, profile update, and account deletion
- Classroom creation, joining, updates, announcements, and schedules
- Notification read/delete routes
- Supabase Storage uploads for class files, notes, and schedule images
- Tesseract OCR flow for schedule image analysis
- Demo priority planner for today's tasks

## Project Structure

```text
backend/
  package.json
  package-lock.json
  .env.example
  src/
    server.js
    controllers/
    middleware/
    routes/
    services/
    data/
      database.json
```

## Requirements

- Node.js 18 or newer
- npm
- MySQL 8+ or MariaDB 10.6+
- Supabase project, Storage bucket, URL, and server-only service-role key

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
copy .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

## Environment Variables

```env
PORT=4000
HOST=0.0.0.0
DATABASE_PROVIDER=mysql
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=remindme
MYSQL_USER=remindme_app
MYSQL_PASSWORD=replace-with-your-private-password
MYSQL_CONNECTION_LIMIT=10
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-your-supabase-service-role-key
STORAGE_PROVIDER=supabase
SUPABASE_STORAGE_BUCKET=remindme-uploads
```

Import `database/schema.sql` into MySQL before starting with `DATABASE_PROVIDER=mysql`. The schema uses `LONGTEXT` for workspace JSON so it works with older WAMP MySQL releases. If you imported an earlier schema, run `database/legacy-mysql-migration.sql` once. The MySQL variables above are all that is required for local database storage. Set `DATABASE_PROVIDER=json-fallback` only for temporary JSON-file development. Supabase URL, service-role, and Storage variables are required when using Supabase.

## Run

Development mode with Node watch:

```bash
npm run dev
```

Production-style start:

```bash
npm start
```

LAN mode for mobile testing:

```bash
npm run start:lan
```

The API runs at:

```text
http://localhost:4000/api
```

Health check:

```text
http://localhost:4000/api/health
```

If port `4000` is already in use, run on another port:

```powershell
$env:PORT=4001
npm run dev
```

## API Routes

### Health

- `GET /api/health`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `PUT /api/auth/profile`
- `PATCH /api/auth/students/:identifier/class-president` (admin only; identifier is a student UUID, email, or student number)
- `DELETE /api/auth/account`

### Workspace Sync

- `GET /api/workspace`
- `PUT /api/workspace`
- `GET /api/workspace/mobile/:email`
- `PUT /api/workspace/mobile/:email`
- `DELETE /api/workspace/mobile/:email`

### Schedule

- `GET /api/schedule`
- `POST /api/schedule`
- `PUT /api/schedule/:id`
- `DELETE /api/schedule/:id`
- `POST /api/schedule/analyze-upload`
- `POST /api/schedule/analyze-image`

### Tasks

- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `GET /api/tasks/priorities/today`

### Notes

- `GET /api/notes`
- `POST /api/notes`
- `PUT /api/notes/:id`
- `DELETE /api/notes/:id`

### Announcements

- `GET /api/announcements`
- `POST /api/announcements`
- `PUT /api/announcements/:id`
- `DELETE /api/announcements/:id`

### Uploads

- `POST /api/uploads`

### Classrooms

- `GET /api/classrooms`
- `POST /api/classrooms`
- `GET /api/classrooms/:id`
- `PUT /api/classrooms/:id`
- `DELETE /api/classrooms/:id`
- `POST /api/classrooms/join`
- `POST /api/classrooms/:id/announcements`
- `POST /api/classrooms/:id/schedules`
- `POST /api/classrooms/:id/members` (classroom creator only; body: `{ "identifier": "student@email.edu" }`)
- `DELETE /api/classrooms/:id/members/:memberId` (classroom creator only)

## Class President access

Class President is a capability on a student account, not a role that can be selected during registration. An appointed president can create a classroom, manage its membership, and manage only classrooms they created. They do not receive faculty or administrator privileges.

Create the administrator account through your controlled provisioning process, then set its profile role to `admin` in Supabase. For example, in the Supabase SQL editor:

```sql
update public.profiles
set data = jsonb_set(coalesce(data, '{}'::jsonb), '{role}', '"admin"'::jsonb, true)
where data->>'email' = 'admin@your-school.edu';
```

While signed in as that administrator, appoint a registered student:

```http
PATCH /api/auth/students/2026-123456/class-president
Content-Type: application/json
Authorization: Bearer <admin-access-token>

{ "isClassPresident": true }
```

Send `{ "isClassPresident": false }` to revoke the appointment. The student should sign out and back in after an appointment change so the mobile app refreshes their profile.

### Notifications

- `GET /api/notifications/user/:userId`
- `PUT /api/notifications/:id/read`
- `DELETE /api/notifications/:id`

## Local Database

When `DATABASE_PROVIDER=mysql`, workspace data is stored in the `app_workspaces` table. The existing API routes continue to work without changes.

When `DATABASE_PROVIDER=json-fallback`, data is stored in:

```text
src/data/database.json
```

The JSON fallback is useful only for local demos. Use MySQL/MariaDB for persistent data and add real authentication rules before a public release.

Each signed-in user has one protected `user:<uuid>` workspace in `app_workspaces`. The browser and Expo Go both use the same JWT-authenticated workspace route, so their schedule, tasks, notes, announcements, classroom, subjects, and file metadata stay together. The service retains the browser's `profile` shape and Expo's `user` shape to keep both clients compatible.

## Upload Payload

`POST /api/uploads` expects JSON:

```json
{
  "fileName": "lesson-notes.pdf",
  "contentType": "application/pdf",
  "base64": "data:application/pdf;base64,...",
  "folder": "notes/general"
}
```

Supported uploads include PDF, DOC/DOCX, PPT/PPTX, ZIP, and common image formats.

## Development Notes

- The server entry point is `src/server.js`.
- The project uses ES modules with `"type": "module"`.
- CORS is enabled for local frontend and mobile development.
- JSON request bodies are limited to `10mb` to support base64 uploads.
- Supabase Auth owns registration and login; protected routes validate the Supabase access token with `auth.getUser`.
- `Supabase`, `jsonwebtoken`, and QR code packages are available for the production path.
