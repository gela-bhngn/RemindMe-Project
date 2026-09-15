import { getSupabase, getSupabaseProfile, isSupabaseEnabled } from "../services/supabaseService.js";

export async function authenticate(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ message: "Authentication is required." });
  if (!isSupabaseEnabled()) return res.status(503).json({ message: "Supabase authentication is not configured." });
  try {
    const { data, error } = await getSupabase().auth.getUser(token);
    if (error || !data.user) throw error || new Error("Invalid session");
    const profile = await getSupabaseProfile(data.user.id);
    if (profile?.accountStatus && profile.accountStatus !== "active") {
      return res.status(403).json({ message: `This account is ${profile.accountStatus} and cannot access the system yet.` });
    }
    req.user = { sub: data.user.id, email: data.user.email };
    return next();
  } catch {
    return res.status(401).json({ message: "Your session is invalid or has expired. Please sign in again." });
  }
}
