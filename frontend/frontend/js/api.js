import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_URL = globalThis.REMINDME_API_URL || "http://localhost:4000/api";
export const supabase = createClient(globalThis.REMINDME_SUPABASE_URL, globalThis.REMINDME_SUPABASE_ANON_KEY);

export async function fetchRemoteState() {
  const response = await authenticatedFetch(`${API_URL}/workspace`);
  if (!response.ok) throw new Error("Unable to load remote workspace");
  return response.json();
}

export async function syncRemoteState(state) {
  const response = await authenticatedFetch(`${API_URL}/workspace`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state)
  });
  if (!response.ok) throw new Error("Unable to sync workspace");
  return response.json();
}

export async function loginUser(credentials) {
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error || !data.session) throw error || new Error("Login failed");
  return { user: data.user, token: data.session.access_token };
}

export async function registerUser({ email, password, name, role, studentNumber, facultyId }) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, role, studentNumber, facultyId })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Unable to create account.");
  const loginResult = await loginUser({ email, password });
  return { ...loginResult, user: { ...result.user, ...loginResult.user } };
}

export async function verifySession() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error || new Error("No active session");
  const result = await (await authenticatedFetch(`${API_URL}/auth/session`)).json();
  return {
    ...result,
    user: {
      ...result.user,
      email: data.user.email,
      name: data.user.user_metadata?.name || result.user?.name || "",
      studentNumber: data.user.user_metadata?.studentNumber || result.user?.studentNumber || ""
    }
  };
}

export async function getAdminUsers() {
  const response = await authenticatedFetch(`${API_URL}/admin/users`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Unable to load user registrations.");
  return result;
}

export async function updateAccountStatus(identifier, accountStatus) {
  const response = await authenticatedFetch(`${API_URL}/admin/users/${encodeURIComponent(identifier)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountStatus })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Unable to update this account.");
  return result;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

async function authenticatedFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in first.");
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${session.access_token}` }
  });
}

export async function uploadFile(file, folder = "class-files") {
  const base64 = await readFileAsDataUrl(file);
  const response = await authenticatedFetch(`${API_URL}/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      base64,
      folder
    })
  });

  if (!response.ok) throw new Error("Upload failed");
  return response.json();
}

export async function analyzeScheduleImage(file) {
  const base64 = await readFileAsDataUrl(file);
  let response;
  try {
    response = await authenticatedFetch(`${API_URL}/schedule/analyze-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || "image/jpeg",
        base64,
        folder: "schedules"
      })
    });
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("The schedule upload server could not be reached. Make sure the backend is running, then try again.");
    }
    throw error;
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Schedule image analysis failed.");
  return result;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

// Classroom APIs
export async function createClassroom(classroomData) {
  const response = await authenticatedFetch(`${API_URL}/classrooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(classroomData)
  });
  if (!response.ok) throw new Error("Failed to create classroom");
  return response.json();
}

export async function getClassrooms(userId) {
  const response = await authenticatedFetch(`${API_URL}/classrooms?userId=${userId}`);
  if (!response.ok) throw new Error("Failed to fetch classrooms");
  return response.json();
}

export async function joinClassroom(classroomId, userId) {
  const response = await authenticatedFetch(`${API_URL}/classrooms/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ classroomId, userId })
  });
  if (!response.ok) throw new Error("Failed to join classroom");
  return response.json();
}

export async function getClassroom(classroomId) {
  const response = await authenticatedFetch(`${API_URL}/classrooms/${classroomId}`);
  if (!response.ok) throw new Error("Failed to fetch classroom");
  return response.json();
}

export async function updateClassroom(classroomId, updates) {
  const response = await authenticatedFetch(`${API_URL}/classrooms/${classroomId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates)
  });
  if (!response.ok) throw new Error("Failed to update classroom");
  return response.json();
}

export async function deleteClassroom(classroomId) {
  const response = await authenticatedFetch(`${API_URL}/classrooms/${classroomId}`, {
    method: "DELETE"
  });
  if (!response.ok) throw new Error("Failed to delete classroom");
  return response.json();
}

// Profile APIs
export async function updateProfile(profileData) {
  const response = await authenticatedFetch(`${API_URL}/auth/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profileData)
  });
  if (!response.ok) throw new Error("Failed to update profile");
  return response.json();
}

export async function deleteAccount(accountData) {
  const response = await authenticatedFetch(`${API_URL}/auth/account`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(accountData)
  });
  if (!response.ok) throw new Error("Failed to delete account");
  return response.json();
}

// Notification APIs
export async function getUserNotifications(userId, unreadOnly = false) {
  const url = new URL(`${API_URL}/notifications/user/${userId}`);
  if (unreadOnly) url.searchParams.set("unreadOnly", "true");
  const response = await authenticatedFetch(url);
  if (!response.ok) throw new Error("Failed to fetch notifications");
  return response.json();
}

export async function markNotificationAsRead(notificationId) {
  const response = await authenticatedFetch(`${API_URL}/notifications/${notificationId}/read`, {
    method: "PUT"
  });
  if (!response.ok) throw new Error("Failed to mark notification as read");
  return response.json();
}
