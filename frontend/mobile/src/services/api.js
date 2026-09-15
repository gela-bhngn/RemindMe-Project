import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase";

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\s+/g, "");
const TOKEN_KEY = "remindme-auth-token";

function getExpoDevelopmentHost() {
  // Expo Go supplies one of these values with the active development session.
  // Unlike EXPO_PUBLIC_API_URL, this changes with the current Wi-Fi/hotspot LAN.
  const hostUri = Constants.expoConfig?.hostUri
    || Constants.expoGoConfig?.debuggerHost
    || Constants.manifest2?.extra?.expoClient?.hostUri;

  if (!hostUri) return null;

  try {
    const host = new URL(hostUri.includes("://") ? hostUri : `http://${hostUri}`).hostname;
    return /^(localhost|127\.0\.0\.1|::1)$/i.test(host) ? null : host;
  } catch {
    return null;
  }
}

const expoHost = __DEV__ && Platform.OS !== "web" ? getExpoDevelopmentHost() : null;
const developmentApiUrl = expoHost ? `http://${expoHost}:4000/api` : null;
// In Expo Go on LAN, use the Expo session's current host rather than a stale
// IP written to .env. A configured URL remains the fallback and is used for
// web, production builds, and publicly hosted APIs.
const resolvedApiUrl = developmentApiUrl || configuredApiUrl;
export const apiUrl = resolvedApiUrl?.replace(/\/$/, "") || null;

export function isApiConfigured() { return Boolean(apiUrl); }
export async function setAuthToken(token) { await AsyncStorage.setItem(TOKEN_KEY, token); }
export async function clearAuthToken() { await AsyncStorage.removeItem(TOKEN_KEY); }

export async function requestApi(path, options = {}) {
  if (!apiUrl) throw new Error("Backend URL is not configured. Set EXPO_PUBLIC_API_URL in mobile/.env.");
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  });
  if (!response.ok) {
    if (response.status === 401) await clearAuthToken();
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || `Request failed with status ${response.status}.`);
  }
  return response;
}

export async function loginUser(credentials) {
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error || !data.session) throw error || new Error("Authentication failed.");
  await setAuthToken(data.session.access_token);
  return { token: data.session.access_token, user: { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name || "", role: data.user.user_metadata?.role || "student", studentNumber: data.user.user_metadata?.studentNumber || "", facultyId: data.user.user_metadata?.facultyId || "" } };
}

export async function registerUser(credentials) {
  const response = await requestApi("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials)
  });
  const result = await response.json();
  const loginResult = await loginUser({ email: credentials.email, password: credentials.password });
  return { ...loginResult, user: { ...result.user, ...loginResult.user } };
}

export async function verifySession() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error || new Error("No active session.");
  return (await requestApi("/auth/session")).json();
}

export async function getAdminDashboard() { return (await requestApi("/admin/dashboard")).json(); }
export async function getAdminUsers() { return (await requestApi("/admin/users")).json(); }
export async function updateAccountStatus(identifier, accountStatus) {
  return (await requestApi(`/admin/users/${encodeURIComponent(identifier)}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountStatus }) })).json();
}
export async function setClassPresident(identifier, isClassPresident) {
  return (await requestApi(`/auth/students/${encodeURIComponent(identifier)}/class-president`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isClassPresident }) })).json();
}

export async function getMobileWorkspace() { return (await requestApi("/workspace")).json(); }
export async function saveMobileWorkspace(workspace) {
  return (await requestApi("/workspace", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(workspace) })).json();
}
