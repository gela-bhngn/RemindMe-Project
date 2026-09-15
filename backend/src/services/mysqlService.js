import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";

let pool;

export function isMySqlEnabled() {
  return process.env.DATABASE_PROVIDER?.toLowerCase() === "mysql";
}

export function getMySqlPool() {
  if (!isMySqlEnabled()) return null;

  if (!process.env.MYSQL_HOST || !process.env.MYSQL_DATABASE || !process.env.MYSQL_USER) {
    throw new Error("MySQL is selected but MYSQL_HOST, MYSQL_DATABASE, or MYSQL_USER is missing.");
  }

  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD || "",
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
      queueLimit: 0
    });
  }

  return pool;
}

export async function readMySqlWorkspace(workspaceKey) {
  const database = getMySqlPool();
  const [rows] = await database.execute(
    "SELECT workspace_data FROM app_workspaces WHERE workspace_key = ?",
    [workspaceKey]
  );

  if (!rows.length) return null;
  const value = rows[0].workspace_data;
  return typeof value === "string" ? JSON.parse(value) : value;
}

export async function writeMySqlWorkspace(workspaceKey, data) {
  const database = getMySqlPool();
  const workspaceData = JSON.stringify(data);

  const userId = workspaceUserId(workspaceKey);
  if (!userId) {
    await database.execute(
      `INSERT INTO app_workspaces (workspace_key, workspace_data)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE workspace_data = VALUES(workspace_data), updated_at = CURRENT_TIMESTAMP`,
      [workspaceKey, workspaceData]
    );
    return data;
  }

  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO app_workspaces (workspace_key, workspace_data)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE workspace_data = VALUES(workspace_data), updated_at = CURRENT_TIMESTAMP`,
      [workspaceKey, workspaceData]
    );
    await mirrorWorkspaceToTables(connection, userId, data);
    await connection.execute(
      "INSERT INTO activity_logs (id, user_id, activity_type, entity_type, details) VALUES (?, ?, 'WORKSPACE_SYNC', 'workspace', ?)",
      [randomUUID(), userId, JSON.stringify({ syncedAt: data.updatedAt || new Date().toISOString() })]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return data;
}

export async function deleteMySqlWorkspace(workspaceKey) {
  const database = getMySqlPool();
  const userId = workspaceUserId(workspaceKey);
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute("DELETE FROM app_workspaces WHERE workspace_key = ?", [workspaceKey]);
    if (userId) {
      for (const table of mirroredTables) await connection.execute(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
      await connection.execute("DELETE FROM activity_logs WHERE user_id = ?", [userId]);
    }
    await connection.commit();
    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const mirroredTables = [
  "user_profiles", "subjects", "schedules", "tasks", "notes", "announcements",
  "classrooms", "classroom_members", "classroom_files", "attendance", "notifications"
];

function workspaceUserId(workspaceKey) {
  return workspaceKey.startsWith("user:") ? workspaceKey.slice(5) : null;
}

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function entryId(item, index, prefix) {
  return String(item?.id || `${prefix}-${index}`);
}

async function mirrorWorkspaceToTables(connection, userId, workspace) {
  for (const table of mirroredTables) await connection.execute(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);

  const profile = workspace.profile || workspace.user || {};
  await connection.execute(
    `INSERT INTO user_profiles (user_id, student_number, course, year_level, semester, profile_data)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, profile.studentNumber || null, profile.course || null, profile.yearLevel || null, profile.semester || null, JSON.stringify(profile)]
  );

  await insertRows(connection, "subjects", rows(workspace.subjects), userId, "subject", (item, id) =>
    [id, userId, item.title || item.name || "Untitled subject", item.instructor || null, item.room || null, JSON.stringify(item)]);
  await insertRows(connection, "schedules", rows(workspace.schedule), userId, "schedule", (item, id) =>
    [id, userId, item.subject || null, item.day || null, item.start || item.startTime || null, item.end || item.endTime || null, item.room || null, JSON.stringify(item)]);
  await insertRows(connection, "tasks", rows(workspace.tasks), userId, "task", (item, id) =>
    [id, userId, item.title || "Untitled task", item.subject || null, item.dueDate || null, item.priority || null, item.status || null, JSON.stringify(item)]);
  await insertRows(connection, "notes", rows(workspace.notes), userId, "note", (item, id) =>
    [id, userId, item.title || "Untitled note", item.subject || null, item.content || null, JSON.stringify(item)]);
  await insertRows(connection, "announcements", rows(workspace.announcements), userId, "announcement", (item, id) =>
    [id, userId, item.title || "Untitled announcement", item.date || null, item.message || null, JSON.stringify(item)]);
  const classrooms = rows(workspace.classrooms).concat(workspace.classroom ? [workspace.classroom] : []);
  await insertRows(connection, "classrooms", classrooms, userId, "classroom", (item, id) =>
    [id, userId, item.name || "Untitled classroom", item.section || null, item.inviteCode || null, JSON.stringify(item)]);
  const members = rows(workspace.members).concat(rows(workspace.attendance?.members));
  await insertRows(connection, "classroom_members", members, userId, "member", (item, id) =>
    [id, userId, item.classroomId || null, item.name || "Unnamed member", item.role || null, JSON.stringify(item)]);
  await insertRows(connection, "classroom_files", rows(workspace.files), userId, "file", (item, id) =>
    [id, userId, item.name || item.fileName || "Unnamed file", item.url || item.fileUrl || null, item.subject || null, JSON.stringify(item)]);
  await insertRows(connection, "attendance", rows(workspace.attendance?.records), userId, "attendance", (item, id) =>
    [id, userId, item.classroomId || null, JSON.stringify(item)]);
  await insertRows(connection, "notifications", rows(workspace.notifications), userId, "notification", (item, id) =>
    [id, userId, item.title || null, item.read ? 1 : 0, JSON.stringify(item)]);
}

async function insertRows(connection, table, items, userId, prefix, values) {
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] || {};
    const id = entryId(item, index, prefix);
    const placeholders = values(item, id).map(() => "?").join(", ");
    await connection.execute(`INSERT INTO ${table} VALUES (${placeholders})`, values(item, id));
  }
}

export async function findMySqlUserByEmail(email) {
  const database = getMySqlPool();
  const [rows] = await database.execute(
    "SELECT id, email, password_hash, name, profile_data FROM users WHERE email = ? LIMIT 1",
    [email.trim().toLowerCase()]
  );
  if (!rows.length) return null;
  return { ...rows[0], profile: JSON.parse(rows[0].profile_data || "{}") };
}

export async function createMySqlUser({ id, email, passwordHash, name, profile }) {
  const database = getMySqlPool();
  await database.execute(
    "INSERT INTO users (id, email, password_hash, name, profile_data, updated_at) VALUES (?, ?, ?, ?, ?, NOW())",
    [id, email.trim().toLowerCase(), passwordHash, name, JSON.stringify(profile || {})]
  );
  return { id, email: email.trim().toLowerCase(), name, profile };
}

export async function updateMySqlUserProfile(id, profile) {
  const database = getMySqlPool();
  await database.execute(
    "UPDATE users SET name = ?, profile_data = ? WHERE id = ?",
    [profile.name || "", JSON.stringify(profile), id]
  );
  return profile;
}
