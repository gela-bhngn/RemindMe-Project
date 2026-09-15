import { Router } from "express";
import { changeAccountStatus, getAdminDashboard, listUsers } from "../controllers/adminController.js";

const router = Router();
router.get("/dashboard", getAdminDashboard);
router.get("/users", listUsers);
router.patch("/users/:identifier/status", changeAccountStatus);
export default router;
