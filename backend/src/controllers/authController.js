import { addActivityLog, findSupabaseProfile, getSupabase, getSupabaseProfile, readSupabaseWorkspace, saveRoleProfile, saveSupabaseProfile, writeSupabaseWorkspace } from "../services/supabaseService.js";

function publicUser(authUser, profile = {}) { return { id: authUser.id, email: authUser.email, name: profile.name || authUser.user_metadata?.name || "", ...profile }; }
function emptyWorkspace(profile) { return { profile, user: profile, subjects: [], schedule: [], tasks: [], notes: [], announcements: [], members: [], classrooms: [], classroom: null, files: [], attendance: { members: [] } }; }

export async function register(req, res, next) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const name = String(req.body.name || "").trim();
    const schoolId = String(req.body.schoolId || req.body.studentNumber || req.body.facultyId || "").trim();
    const isStudent = /^\d{4}-\d{6}$/.test(schoolId);
    const isFaculty = /^[A-Za-z]{3}-\d{6}$/.test(schoolId);
    const role = isStudent ? "student" : isFaculty ? "faculty" : "";
    const studentNumber = isStudent ? schoolId : "";
    const facultyId = isFaculty ? schoolId.toUpperCase() : "";
    if (!email || !password || !name) return res.status(400).json({ message: "Email, password, and name are required." });
    if (!role) return res.status(400).json({ message: "Use a Student ID (YYYY-NNNNNN) or Faculty ID (AAA-NNNNNN)." });

    const { data, error } = await getSupabase().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, studentNumber: role === "student" ? studentNumber : undefined, facultyId: role === "faculty" ? facultyId : undefined }
    });
    if (error) return res.status(error.status || 400).json({ message: error.message });

    const profile = { name, email, role, accountStatus: "active", ...(role === "student" ? { studentNumber } : { facultyId }) };
    await saveSupabaseProfile(data.user.id, profile);
    await saveRoleProfile(data.user.id, profile);
    await writeSupabaseWorkspace(data.user.id, emptyWorkspace(profile));
    await addActivityLog(data.user.id, "ACCOUNT_REGISTERED", { role, accountStatus: "active" }, "account", data.user.id);
    res.status(201).json({ user: publicUser(data.user, profile) });
  } catch (error) { next(error); }
}

export async function session(req, res, next) {
  try {
    const profile = await getSupabaseProfile(req.user.sub);
    if (profile?.accountStatus && profile.accountStatus !== "active") return res.status(403).json({ message: `This account is ${profile.accountStatus} and cannot access the system yet.` });
    await addActivityLog(req.user.sub, "USER_LOGIN", {}, "account", req.user.sub);
    res.json({ user: publicUser({ id: req.user.sub, email: req.user.email }, profile) });
  } catch (error) { next(error); }
}

export async function updateProfile(req, res, next) {
  try {
    const oldProfile = (await getSupabaseProfile(req.user.sub)) || {};
    const profile = { ...oldProfile, ...req.body, email: req.user.email, name: String(req.body.name || oldProfile.name || "").trim() };
    // Roles and president privileges are only changed by the administrator
    // endpoint below; a user must never be able to grant themself access.
    profile.role = oldProfile.role;
    profile.isClassPresident = Boolean(oldProfile.isClassPresident);
    delete profile.id; delete profile.password;
    if (profile.role === "student" && !/^\d{4}-\d{6}$/.test(String(profile.studentNumber || ""))) return res.status(400).json({ message: "Student ID must use YYYY-NNNNNN." });
    if (profile.role === "faculty" && !/^[A-Za-z]{3}-\d{6}$/.test(String(profile.facultyId || ""))) return res.status(400).json({ message: "Faculty ID must use AAA-NNNNNN." });
    await saveSupabaseProfile(req.user.sub, profile);
    await saveRoleProfile(req.user.sub, profile);
    const workspace = (await readSupabaseWorkspace(req.user.sub)) || emptyWorkspace(profile);
    await writeSupabaseWorkspace(req.user.sub, { ...workspace, profile, user: { ...(workspace.user || {}), ...profile } });
    res.json({ id: req.user.sub, ...profile });
  } catch (error) { next(error); }
}

function forbidden(message) {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

export async function appointClassPresident(req, res, next) {
  try {
    const admin = await getSupabaseProfile(req.user.sub);
    if (admin?.role !== "admin") throw forbidden("Only an admin can appoint a class president.");

    const student = await findSupabaseProfile(req.params.identifier);
    if (!student) return res.status(404).json({ message: "Student account not found." });
    if (student.role !== "student") return res.status(400).json({ message: "Only student accounts can be appointed class president." });

    const isClassPresident = req.body.isClassPresident !== false;
    const profile = { ...student, isClassPresident };
    delete profile.id;
    await saveSupabaseProfile(student.id, profile);
    await saveRoleProfile(student.id, profile);
    const workspace = (await readSupabaseWorkspace(student.id)) || emptyWorkspace(profile);
    await writeSupabaseWorkspace(student.id, { ...workspace, profile, user: { ...(workspace.user || {}), ...profile } });
    await addActivityLog(req.user.sub, isClassPresident ? "CLASS_PRESIDENT_APPOINTED" : "CLASS_PRESIDENT_REVOKED", { studentId: student.id }, "account", student.id);
    res.json({ id: student.id, ...profile });
  } catch (error) { next(error); }
}

export async function deleteAccount(req, res, next) {
  try {
    const { data, error } = await getSupabase().auth.signInWithPassword({ email: req.user.email, password: String(req.body.password || "") });
    if (error || !data.user || data.user.id !== req.user.sub) return res.status(401).json({ message: "Password confirmation is required." });
    const result = await getSupabase().auth.admin.deleteUser(req.user.sub);
    if (result.error) throw result.error;
    res.status(204).end();
  } catch (error) { next(error); }
}
