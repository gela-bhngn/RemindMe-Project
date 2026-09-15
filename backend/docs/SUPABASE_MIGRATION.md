# Supabase sync migration

This server now uses Supabase Auth and PostgreSQL instead of SQLyog/MySQL.
The web app and Expo app must sign in to the same Supabase project with the
same account. Do not put `SUPABASE_SERVICE_ROLE_KEY` in either client.

## One-time setup

1. Create a Supabase project.
2. In **SQL Editor**, run `database/supabase-schema.sql`.
3. In **Authentication > Providers**, enable Email. Registration is handled by
  the backend with the server-only service-role key and creates users with
  `email_confirm: true`, so a successful registration can sign in immediately.
  Never expose the service-role key to the web or Expo clients.
4. Copy Project URL and the **service_role** key into this server's `.env`,
   using `.env.example` as the model. Restart the server.
5. In **Database > Publications**, verify that `workspaces` is enabled for
   Realtime (the SQL migration also adds it).
6. Add the Project URL and the client-safe **anon/publishable** key to both
   clients. These are intentionally different from the server's service key.

## Client installation

```bash
npm install @supabase/supabase-js
# Expo only:
npx expo install @react-native-async-storage/async-storage
```

## Replace each client’s old API client with this shared Supabase client

### Web (Vite): `src/lib/supabase.js`

```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

### Expo: `src/lib/supabase.js`

```js
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } },
)
```

Set `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` in the web `.env`, and
`EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` in the Expo `.env`.

## Replace old whole-workspace fetch/save and add live sync

```js
import { supabase } from './lib/supabase'

export async function loadWorkspace() {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Please sign in first')
  const { data, error } = await supabase.from('workspaces').select('data, updated_at')
    .eq('user_id', user.id).single()
  if (error && error.code !== 'PGRST116') throw error
  return data?.data ?? null
}

export async function saveWorkspace(workspace) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Please sign in first')
  const { error } = await supabase.from('workspaces').upsert(
    { user_id: user.id, data: workspace, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

// Call once after login; return value must be called during logout/unmount.
export async function subscribeToWorkspace(onWorkspaceChanged) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return () => {}
  const channel = supabase.channel(`workspace:${user.id}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'workspaces', filter: `user_id=eq.${user.id}`,
    }, ({ new: row }) => { if (row?.data) onWorkspaceChanged(row.data) })
    .subscribe()
  return () => supabase.removeChannel(channel)
}
```

Your listener should replace the app state with `row.data` and render it. Save
only after a user action, never inside the realtime callback, otherwise web and
mobile can create a write loop. If either client currently saves an entire old
state after loading, change it to first merge the edited collection into the
latest workspace; that prevents a stale device overwriting a newer edit.

## Authentication replacement

```js
await supabase.auth.signUp({ email, password, options: { data: { name } } })
await supabase.auth.signInWithPassword({ email, password })
await supabase.auth.signOut()
```

Existing clients can instead keep calling this backend's `/api/auth/register`,
`/api/auth/login`, and `/api/workspace` routes. Those routes now issue and
accept Supabase access tokens, so that is the lowest-risk intermediate step.
