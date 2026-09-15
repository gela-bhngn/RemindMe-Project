import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { isSupabaseEnabled, readSupabaseWorkspace, writeSupabaseWorkspace } from "./supabaseService.js";

const databasePath = join(dirname(fileURLToPath(import.meta.url)), "../data/database.json");

export async function readDatabase() {
  if (isSupabaseEnabled()) return createEmptyDatabase();
  return JSON.parse(await readFile(databasePath, "utf8"));
}

export async function writeDatabase(data) {
  if (isSupabaseEnabled()) return data;
  await writeFile(databasePath, `${JSON.stringify(data, null, 2)}\n`);
  return data;
}

export async function getCollection(collection) {
  const database = await readDatabase();
  return database[collection] || [];
}

export async function addToCollection(collection, payload) {
  const database = await readDatabase();
  const record = { id: randomUUID(), ...payload };
  database[collection] ||= [];
  database[collection].push(record);
  await writeDatabase(database);
  return record;
}

export async function updateCollectionItem(collection, id, payload) {
  const database = await readDatabase();
  const records = database[collection] || [];
  const index = records.findIndex((item) => item.id === id);
  if (index === -1) return null;
  records[index] = { ...records[index], ...payload, id };
  await writeDatabase(database);
  return records[index];
}

export async function deleteCollectionItem(collection, id) {
  const database = await readDatabase();
  const records = database[collection] || [];
  const nextRecords = records.filter((item) => item.id !== id);
  if (nextRecords.length === records.length) return false;
  database[collection] = nextRecords;
  await writeDatabase(database);
  return true;
}

export async function readUserDatabase(user) {
  if (!isSupabaseEnabled()) throw new Error("User workspaces require Supabase.");
  return (await readSupabaseWorkspace(user.sub)) || createEmptyDatabase();
}

export async function getUserCollection(user, collection) {
  const database = await readUserDatabase(user);
  return database[collection] || [];
}

export async function addToUserCollection(user, collection, payload) {
  const database = await readUserDatabase(user);
  const record = { id: randomUUID(), ...payload };
  database[collection] ||= [];
  database[collection].push(record);
  await writeSupabaseWorkspace(user.sub, database);
  return record;
}

export async function updateUserCollectionItem(user, collection, id, payload) {
  const database = await readUserDatabase(user);
  const records = database[collection] || [];
  const index = records.findIndex((item) => item.id === id);
  if (index === -1) return null;
  records[index] = { ...records[index], ...payload, id };
  await writeSupabaseWorkspace(user.sub, database);
  return records[index];
}

export async function deleteUserCollectionItem(user, collection, id) {
  const database = await readUserDatabase(user);
  const records = database[collection] || [];
  const nextRecords = records.filter((item) => item.id !== id);
  if (nextRecords.length === records.length) return false;
  database[collection] = nextRecords;
  await writeSupabaseWorkspace(user.sub, database);
  return true;
}

function createEmptyDatabase() {
  return { profile: {}, schedule: [], tasks: [], notes: [], announcements: [], members: [], mobileWorkspaces: {} };
}
