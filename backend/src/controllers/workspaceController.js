import { readSupabaseWorkspace, writeSupabaseWorkspace } from "../services/supabaseService.js";

function emptyWorkspace(profile = {}) { return { profile, user: profile, subjects: [], schedule: [], tasks: [], notes: [], announcements: [], members: [], classrooms: [], classroom: null, files: [], attendance: { members: [] } }; }

export async function getWorkspace(req, res, next) {
  try { res.json((await readSupabaseWorkspace(req.user.sub)) || emptyWorkspace({ email: req.user.email })); }
  catch (error) { next(error); }
}

export async function replaceWorkspace(req, res, next) {
  try {
    const incoming = req.body && typeof req.body === "object" ? req.body : {};
    const current = (await readSupabaseWorkspace(req.user.sub)) || emptyWorkspace();
    const profile = { ...(current.profile || {}), ...(current.user || {}), ...(incoming.user || {}), ...(incoming.profile || {}), email: req.user.email };
    delete profile.password;
    const workspace = { ...current, ...incoming, profile, user: { ...(current.user || {}), ...(incoming.user || {}), ...profile }, updatedAt: new Date().toISOString() };
    res.json(await writeSupabaseWorkspace(req.user.sub, workspace));
  } catch (error) { next(error); }
}
