import { requestApi } from "./api";
import { supabase } from "./supabase";

export function subscribeClassSchedule(classId, callback) {
  return subscribeCollection(`/schedule?classId=${encodeURIComponent(classId)}`, callback);
}

export function subscribeClassAnnouncements(classId, callback) {
  return subscribeCollection(`/announcements?classId=${encodeURIComponent(classId)}`, callback);
}

export function subscribeClassTasks(classId, callback) {
  return subscribeCollection(`/tasks?classId=${encodeURIComponent(classId)}`, callback);
}

export function subscribeClassNotes(classId, callback) {
  return subscribeCollection(`/notes?classId=${encodeURIComponent(classId)}`, callback);
}

export async function createClassWorkspace(classId, className) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Please sign in first.");
  await requestApi("/classrooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: classId, name: className, createdBy: user.id })
  });
}

export function addScheduleItem(classId, payload) {
  return postCollection("/schedule", { ...payload, classId });
}

export function addAnnouncement(classId, payload) {
  return postCollection("/announcements", { ...payload, classId });
}

export async function addSubjectTask(classId, subjectId, payload) {
  return postCollection("/tasks", { ...payload, classId, subjectId });
}

export async function addSubjectNote(classId, subjectId, payload) {
  return postCollection("/notes", { ...payload, classId, subjectId });
}

export function markTaskComplete(taskPath) {
  return requestApi(`/tasks/${encodeURIComponent(taskPath)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Completed" })
  });
}

function subscribeCollection(path, callback) {
  let stopped = false;
  const load = async () => {
    try {
      const response = await requestApi(path);
      if (!stopped) callback(await response.json());
    } catch (error) {
      if (!stopped) { console.warn(error.message); callback([]); }
    }
  };
  load();
  const interval = setInterval(load, 15000);
  return () => { stopped = true; clearInterval(interval); };
}

async function postCollection(path, payload) {
  return requestApi(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
