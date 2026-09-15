import { Router } from "express";
import { getWorkspace, replaceWorkspace } from "../controllers/workspaceController.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.use(authenticate);
router.get("/", getWorkspace);
router.put("/", replaceWorkspace);

export default router;
