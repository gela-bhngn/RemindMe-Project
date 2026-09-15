import { Router } from "express";
import { createCrudController } from "../controllers/crudController.js";

const router = Router();
const controller = createCrudController("announcements");

router.get("/", controller.list);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

export default router;
