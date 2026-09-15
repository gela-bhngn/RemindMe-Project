import { addActivityLog, findSupabaseProfile, getSupabase, listSupabaseProfiles, readSupabaseWorkspace, saveRoleProfile, saveSupabaseProfile, writeSupabaseWorkspace } from "../services/supabaseService.js";
import { getCollection } from "../services/databaseService.js";

async function requireAdmin(req) {
  const admin = await findSupabaseProfile(req.user.sub);
  if (admin?.role !== "admin") {
    const error = new Error("Only an admin can access system management.");
    error.statusCode = 403;
    throw error;
  }
  return admin;
}

export async function getAdminDashboard(req, res, next) {
  try {
    await requireAdmin(req);
    const users = await listSupabaseProfiles();
    const { data: activities, error: activityError } = await getSupabase().from("activity_logs").select("*").order("created_at", { ascending: false }).limit(20);
    if (activityError) throw new Error(activityError.message);
    // In Supabase, each workspace mirrors its classrooms so the same class can
    // appear more than once. Deduplicate by its stable id for a system view.
    let classrooms = [];
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from("classrooms").select("id, user_id, name, section, created_at, data").order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      classrooms = data || [];
    } else {
      classrooms = await getCollection("classrooms");
    }
    const uniqueClassrooms = Array.from(new Map(classrooms.map((item) => [String(item.data?.id || item.id), { ...item.data, ...item }])).values());
    const recentClassrooms = uniqueClassrooms.slice(0, 10).map((classroom) => ({
      id: classroom.data?.id || classroom.id,
      name: classroom.data?.name || classroom.name,
      section: classroom.data?.section || classroom.section,
      createdAt: classroom.data?.createdAt || classroom.created_at,
      creatorId: classroom.data?.createdBy || classroom.user_id,
      archived: Boolean(classroom.data?.archived || classroom.archived)
    }));
    const counts = {
      totalUsers: users.length,
      students: users.filter((user) => user.role === "student").length,
      teachers: users.filter((user) => user.role === "faculty").length,
      classPresidents: users.filter((user) => user.isClassPresident).length,
      active: users.filter((user) => user.accountStatus === "active").length,
      suspended: users.filter((user) => user.accountStatus === "suspended").length,
      pending: users.filter((user) => user.accountStatus === "pending").length
    };
    const systemAlerts = [
      ...(counts.pending ? [{ type: "account", severity: "info", message: `${counts.pending} account approval${counts.pending === 1 ? "" : "s"} pending.` }] : []),
      ...(counts.suspended ? [{ type: "account", severity: "warning", message: `${counts.suspended} suspended account${counts.suspended === 1 ? "" : "s"}.` }] : []),
      ...((activities || []).filter((item) => /ERROR|FAILED|SECURITY/i.test(item.activity_type || "")).slice(0, 5).map((item) => ({
        type: /SECURITY/i.test(item.activity_type || "") ? "security" : "system",
        severity: "warning",
        message: String(item.activity_type).replaceAll("_", " "),
        createdAt: item.created_at
      })))
    ];
    res.json({
      counts,
      classroomCounts: {
        total: uniqueClassrooms.length,
        active: uniqueClassrooms.filter((item) => !item.data?.archived && !item.archived).length,
        archived: uniqueClassrooms.filter((item) => item.data?.archived || item.archived).length
      },
      pendingApprovals: users.filter((user) => user.accountStatus === "pending"),
      recentUsers: users.slice(0, 10),
      recentClassrooms,
      activities: activities || [],
      systemAlerts
    });
  } catch (error) { next(error); }
}

export async function listUsers(req, res, next) {
  try { await requireAdmin(req); res.json(await listSupabaseProfiles()); }
  catch (error) { next(error); }
}

export async function changeAccountStatus(req, res, next) {
  try {
    await requireAdmin(req);
    const user = await findSupabaseProfile(req.params.identifier);
    if (!user) return res.status(404).json({ message: "Account not found." });
    const accountStatus = String(req.body.accountStatus || "").toLowerCase();
    if (!['active', 'suspended', 'rejected'].includes(accountStatus)) return res.status(400).json({ message: "Use active, suspended, or rejected as the account status." });
    const profile = { ...user, accountStatus };
    delete profile.id;
    await saveSupabaseProfile(user.id, profile);
    await saveRoleProfile(user.id, profile);
    const workspace = await readSupabaseWorkspace(user.id);
    if (workspace) await writeSupabaseWorkspace(user.id, { ...workspace, profile, user: { ...(workspace.user || {}), ...profile } });
    await addActivityLog(req.user.sub, `ACCOUNT_${accountStatus.toUpperCase()}`, { targetUserId: user.id }, "account", user.id);
    res.json({ id: user.id, ...profile });
  } catch (error) { next(error); }
}
