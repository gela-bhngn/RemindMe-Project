import { createClient } from "@supabase/supabase-js";

let client;

export function isSupabaseEnabled() {
  return process.env.DATABASE_PROVIDER?.toLowerCase() === "supabase";
}

export function getSupabase() {
  if (!isSupabaseEnabled()) return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is selected but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
  if (!client) client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return client;
}

function throwIfError(error) { if (error) throw new Error(error.message); }

export async function readSupabaseWorkspace(userId) {
  const { data, error } = await getSupabase().from("workspaces").select("data").eq("user_id", userId).maybeSingle();
  throwIfError(error);
  return data?.data || null;
}

export async function writeSupabaseWorkspace(userId, data) {
  const { error } = await getSupabase().from("workspaces").upsert(
    { user_id: userId, data, updated_at: new Date().toISOString() }, { onConflict: "user_id" }
  );
  throwIfError(error);
  await mirrorWorkspaceToTables(userId, data);
  return data;
}

export async function getSupabaseProfile(userId) {
  const { data, error } = await getSupabase().from("profiles").select("data").eq("id", userId).maybeSingle();
  throwIfError(error);
  return data?.data || null;
}

export async function findSupabaseProfile(identifier) {
  const value = String(identifier || "").trim().toLowerCase();
  if (!value) return null;
  const { data, error } = await getSupabase().from("profiles").select("id, data");
  throwIfError(error);
  const match = (data || []).find((item) => {
    const profile = item.data || {};
    return item.id === identifier || String(profile.email || "").toLowerCase() === value || String(profile.studentNumber || "").toLowerCase() === value;
  });
  return match ? { id: match.id, ...(match.data || {}) } : null;
}

export async function listSupabaseProfiles() {
  const { data, error } = await getSupabase().from("profiles").select("id, data, updated_at").order("updated_at", { ascending: false });
  throwIfError(error);
  return (data || []).map((item) => ({ id: item.id, ...(item.data || {}), updatedAt: item.updated_at }));
}

export async function addActivityLog(userId, activityType, details = {}, entityType = null, entityId = null) {
  const { error } = await getSupabase().from("activity_logs").insert({
    user_id: userId, activity_type: activityType, entity_type: entityType, entity_id: entityId, details
  });
  throwIfError(error);
}

export async function saveSupabaseProfile(userId, profile) {
  const { error } = await getSupabase().from("profiles").upsert(
    { id: userId, data: profile, updated_at: new Date().toISOString() }, { onConflict: "id" }
  );
  throwIfError(error);
  return profile;
}

// Role-specific data is deliberately stored separately from authentication and
// from the compatibility `profiles` JSON used by older clients.
export async function saveRoleProfile(userId, profile) {
  const role = profile.role;
  if (role !== "student" && role !== "faculty") return profile;
  const table = role === "student" ? "students" : "faculty";
  const idField = role === "student" ? "student_id" : "faculty_id";
  const idValue = role === "student" ? profile.studentNumber : profile.facultyId;
  const { error } = await getSupabase().from(table).upsert(
    { user_id: userId, [idField]: idValue, first_name: profile.name || "", data: profile, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  throwIfError(error);
  return profile;
}

// `workspaces.data` remains the compatibility snapshot used by the current
// web/API clients. These rows make each type of entry queryable in Supabase.
const mirroredTables = ["user_profiles", "subjects", "schedules", "tasks", "notes", "announcements", "classrooms", "classroom_members", "classroom_files", "attendance", "notifications"];
const asArray = (value) => Array.isArray(value) ? value : [];
const itemId = (item, index, prefix) => String(item?.id || `${prefix}-${index}`);

async function mirrorWorkspaceToTables(userId, workspace) {
  const supabase = getSupabase();
  for (const table of mirroredTables) {
    const { error } = await supabase.from(table).delete().eq("user_id", userId);
    throwIfError(error);
  }

  const profile = workspace.profile || workspace.user || {};
  await insertMirror("user_profiles", [{ user_id: userId, student_number: profile.studentNumber || null, course: profile.course || null, year_level: profile.yearLevel || null, semester: profile.semester || null, data: profile }]);
  await insertItems("subjects", asArray(workspace.subjects), userId, "subject", (item, id) => ({ id, user_id: userId, title: item.title || item.name || "Untitled subject", instructor: item.instructor || null, room: item.room || null, data: item }));
  await insertItems("schedules", asArray(workspace.schedule), userId, "schedule", (item, id) => ({ id, user_id: userId, subject: item.subject || null, day_name: item.day || null, start_time: item.start || item.startTime || null, end_time: item.end || item.endTime || null, room: item.room || null, data: item }));
  await insertItems("tasks", asArray(workspace.tasks), userId, "task", (item, id) => ({ id, user_id: userId, title: item.title || "Untitled task", subject: item.subject || null, due_date: item.dueDate || null, priority: item.priority || null, status: item.status || null, data: item }));
  await insertItems("notes", asArray(workspace.notes), userId, "note", (item, id) => ({ id, user_id: userId, title: item.title || "Untitled note", subject: item.subject || null, content: item.content || null, data: item }));
  await insertItems("announcements", asArray(workspace.announcements), userId, "announcement", (item, id) => ({ id, user_id: userId, title: item.title || "Untitled announcement", announcement_date: item.date || null, message: item.message || null, data: item }));
  await insertItems("classrooms", asArray(workspace.classrooms).concat(workspace.classroom ? [workspace.classroom] : []), userId, "classroom", (item, id) => ({ id, user_id: userId, name: item.name || "Untitled classroom", section: item.section || null, invite_code: item.inviteCode || null, data: item }));
  await insertItems("classroom_members", asArray(workspace.members).concat(asArray(workspace.attendance?.members)), userId, "member", (item, id) => ({ id, user_id: userId, classroom_id: item.classroomId || null, member_name: item.name || "Unnamed member", role_name: item.role || null, data: item }));
  await insertItems("classroom_files", asArray(workspace.files), userId, "file", (item, id) => ({ id, user_id: userId, file_name: item.name || item.fileName || "Unnamed file", file_url: item.url || item.fileUrl || null, subject: item.subject || null, data: item }));
  await insertItems("attendance", asArray(workspace.attendance?.records), userId, "attendance", (item, id) => ({ id, user_id: userId, classroom_id: item.classroomId || null, data: item }));
  await insertItems("notifications", asArray(workspace.notifications), userId, "notification", (item, id) => ({ id, user_id: userId, title: item.title || null, is_read: Boolean(item.read), data: item }));
  const { error } = await supabase.from("activity_logs").insert({
    user_id: userId, activity_type: "WORKSPACE_SYNC", entity_type: "workspace",
    details: { syncedAt: workspace.updatedAt || new Date().toISOString() }
  });
  throwIfError(error);
}

async function insertMirror(table, rows) {
  if (!rows.length) return;
  const { error } = await getSupabase().from(table).insert(rows);
  throwIfError(error);
}

async function insertItems(table, items, userId, prefix, mapper) {
  await insertMirror(table, items.map((item, index) => mapper(item || {}, itemId(item, index, prefix), userId)));
}
