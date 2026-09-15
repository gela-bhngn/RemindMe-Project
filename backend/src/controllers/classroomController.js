import { randomUUID } from "crypto";
import { addToCollection, updateCollectionItem, deleteCollectionItem, getCollection } from "../services/databaseService.js";
import { generateQRCode } from "../services/qrCodeService.js";
import { findSupabaseProfile, getSupabaseProfile } from "../services/supabaseService.js";
import { notifyClassroomAnnouncement } from "../services/notificationService.js";

function createInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

async function requireClassManager(req) {
  const profile = await getSupabaseProfile(req.user.sub);
  if (profile?.role !== "faculty" && !profile?.isClassPresident) {
    const error = new Error("Only Faculty accounts or appointed Class Presidents can manage classrooms.");
    error.statusCode = 403;
    throw error;
  }
  return profile;
}

async function requireCreator(req, classroom) {
  if (classroom.createdBy !== req.user.sub) {
    const error = new Error("Only the classroom creator can make this change.");
    error.statusCode = 403;
    throw error;
  }
  return requireClassManager(req);
}

export async function createClassroom(req, res, next) {
  try {
    const { name, section, subject, room, schoolYear, semester, description } = req.body;
    await requireClassManager(req);
    const createdBy = req.user.sub;

    if (!name) {
      const error = new Error("Name and createdBy are required");
      error.statusCode = 400;
      throw error;
    }

    const classrooms = await getCollection("classrooms");
    if (classrooms.some((item) => item.createdBy === createdBy && item.name.trim().toLowerCase() === String(name).trim().toLowerCase() && String(item.section || "").trim().toLowerCase() === String(section || "").trim().toLowerCase())) {
      const error = new Error("You already created a classroom with this name and section.");
      error.statusCode = 409;
      throw error;
    }
    const classroomId = randomUUID();
    let inviteCode = createInviteCode();
    while (classrooms.some((item) => item.inviteCode === inviteCode)) inviteCode = createInviteCode();
    const inviteLink = `${process.env.APP_URL}/join-classroom/${classroomId}`;
    const qrCode = await generateQRCode(inviteLink);

    const classroom = {
      id: classroomId,
      name,
      section,
      subject: subject || "",
      room: room || "",
      schoolYear: schoolYear || "",
      semester: semester || "",
      description,
      createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: [createdBy],
      schedules: [],
      notes: [],
      announcements: [],
      qrCode,
      inviteLink,
      inviteCode,
      joiningEnabled: true,
      archived: false
    };

    const saved = await addToCollection("classrooms", classroom);
    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
}

export async function addClassroomMember(req, res, next) {
  try {
    const classrooms = await getCollection("classrooms");
    const classroom = classrooms.find((item) => item.id === req.params.id);
    if (!classroom) return res.status(404).json({ message: "Classroom not found" });
    await requireCreator(req, classroom);

    const member = await findSupabaseProfile(req.body.identifier);
    if (!member) return res.status(404).json({ message: "Student account not found." });
    if (member.role !== "student") return res.status(400).json({ message: "Only student accounts can be added as classroom members." });
    classroom.members ||= [];
    if (!classroom.members.includes(member.id)) {
      classroom.members.push(member.id);
      await updateCollectionItem("classrooms", classroom.id, classroom);
    }
    res.status(201).json({ classroomId: classroom.id, member: { id: member.id, name: member.name, email: member.email, studentNumber: member.studentNumber } });
  } catch (error) { next(error); }
}

export async function removeClassroomMember(req, res, next) {
  try {
    const classrooms = await getCollection("classrooms");
    const classroom = classrooms.find((item) => item.id === req.params.id);
    if (!classroom) return res.status(404).json({ message: "Classroom not found" });
    await requireCreator(req, classroom);
    if (req.params.memberId === classroom.createdBy) return res.status(400).json({ message: "The classroom creator cannot be removed." });
    classroom.members = (classroom.members || []).filter((id) => id !== req.params.memberId);
    await updateCollectionItem("classrooms", classroom.id, classroom);
    res.status(204).end();
  } catch (error) { next(error); }
}

export async function joinClassroom(req, res, next) {
  try {
    const { classroomId, code } = req.body;
    const userId = req.user.sub;

    if (!classroomId && !code) {
      const error = new Error("classroomId and userId are required");
      error.statusCode = 400;
      throw error;
    }

    const classrooms = await getCollection("classrooms");
    const requestedCode = String(code || classroomId).trim().toUpperCase();
    const classroom = classrooms.find((c) => c.id === classroomId || String(c.inviteCode || "").toUpperCase() === requestedCode);

    if (!classroom) {
      const error = new Error("Classroom not found");
      error.statusCode = 404;
      throw error;
    }
    if (classroom.archived || classroom.joiningEnabled === false) {
      return res.status(403).json({ message: "Joining this classroom is currently disabled." });
    }

    if (!classroom.members.includes(userId)) {
      classroom.members.push(userId);
      await updateCollectionItem("classrooms", classroom.id, classroom);
    }

    res.json(classroom);
  } catch (error) {
    next(error);
  }
}

export async function getClassrooms(req, res, next) {
  try {
    const classrooms = await getCollection("classrooms");
    res.json(classrooms.filter((c) => c.members.includes(req.user.sub)));
  } catch (error) {
    next(error);
  }
}

export async function getClassroom(req, res, next) {
  try {
    const { id } = req.params;
    const classrooms = await getCollection("classrooms");
    const classroom = classrooms.find((c) => c.id === id);

    if (!classroom) {
      const error = new Error("Classroom not found");
      error.statusCode = 404;
      throw error;
    }

    if (!classroom.members.includes(req.user.sub)) {
      return res.status(403).json({ message: "You are not a member of this classroom." });
    }

    res.json(classroom);
  } catch (error) {
    next(error);
  }
}

export async function updateClassroom(req, res, next) {
  try {
    const { id } = req.params;
    const classrooms = await getCollection("classrooms");
    const existing = classrooms.find((item) => item.id === id);
    if (!existing) return res.status(404).json({ message: "Classroom not found" });
    await requireCreator(req, existing);
    const updated = await updateCollectionItem("classrooms", id, {
      ...req.body,
      updatedAt: new Date().toISOString()
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}

export async function deleteClassroom(req, res, next) {
  try {
    const { id } = req.params;
    const classrooms = await getCollection("classrooms");
    const classroom = classrooms.find((c) => c.id === id);

    if (!classroom) {
      const error = new Error("Classroom not found");
      error.statusCode = 404;
      throw error;
    }
    if (!classroom.members.includes(req.user.sub)) return res.status(403).json({ message: "You are not a member of this classroom." });
    await requireCreator(req, classroom);

    await deleteCollectionItem("classrooms", id);
    res.json({ message: "Classroom deleted" });
  } catch (error) {
    next(error);
  }
}

export async function addClassroomAnnouncement(req, res, next) {
  try {
    const { id } = req.params;
    const { message } = req.body;

    const announcement = {
      id: randomUUID(),
      message,
      createdBy: req.user.sub,
      createdAt: new Date().toISOString()
    };

    const classrooms = await getCollection("classrooms");
    const classroom = classrooms.find((c) => c.id === id);

    if (!classroom) {
      const error = new Error("Classroom not found");
      error.statusCode = 404;
      throw error;
    }
    await requireCreator(req, classroom);

    classroom.announcements ||= [];
    classroom.announcements.push(announcement);
    await updateCollectionItem("classrooms", id, classroom);
    await notifyClassroomAnnouncement(id, classroom.name, message, classroom.members.filter((memberId) => memberId !== req.user.sub));

    res.status(201).json(announcement);
  } catch (error) {
    next(error);
  }
}

export async function addClassroomSchedule(req, res, next) {
  try {
    const { id } = req.params;
    const { schedule } = req.body;

    const scheduleItem = {
      id: randomUUID(),
      ...schedule,
      uploadedBy: req.user.sub,
      uploadedAt: new Date().toISOString()
    };

    const classrooms = await getCollection("classrooms");
    const classroom = classrooms.find((c) => c.id === id);

    if (!classroom) {
      const error = new Error("Classroom not found");
      error.statusCode = 404;
      throw error;
    }
    await requireCreator(req, classroom);

    classroom.schedules ||= [];
    classroom.schedules.push(scheduleItem);
    await updateCollectionItem("classrooms", id, classroom);

    res.status(201).json(scheduleItem);
  } catch (error) {
    next(error);
  }
}
