import { Router } from "express";
import { register, session, updateProfile, deleteAccount, appointClassPresident } from "../controllers/authController.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.post("/register", register);
router.get("/session", authenticate, session);
router.put("/profile", authenticate, updateProfile);
// `identifier` may be the student's UUID, school email, or student number.
router.patch("/students/:identifier/class-president", authenticate, appointClassPresident);
router.delete("/account", authenticate, deleteAccount);

export default router;
