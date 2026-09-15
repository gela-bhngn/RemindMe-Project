import { Router } from "express";
import {
  createClassroom,
  joinClassroom,
  getClassrooms,
  getClassroom,
  updateClassroom,
  deleteClassroom,
  addClassroomAnnouncement,
  addClassroomSchedule,
  addClassroomMember,
  removeClassroomMember
} from "../controllers/classroomController.js";

const router = Router();

// Create a new classroom
router.post("/", createClassroom);

// Get all classrooms or filter by user
router.get("/", getClassrooms);

// Get a specific classroom
router.get("/:id", getClassroom);

// Join a classroom
router.post("/join", joinClassroom);

// Update classroom details
router.put("/:id", updateClassroom);

// Classroom creators (faculty or an appointed Class President) curate members.
router.post("/:id/members", addClassroomMember);
router.delete("/:id/members/:memberId", removeClassroomMember);

// Delete classroom
router.delete("/:id", deleteClassroom);

// Add announcement to classroom
router.post("/:id/announcements", addClassroomAnnouncement);

// Add schedule to classroom
router.post("/:id/schedules", addClassroomSchedule);

export default router;
