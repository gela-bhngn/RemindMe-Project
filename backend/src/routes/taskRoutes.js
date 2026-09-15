import { Router } from "express";
import { generatePriorityPlan } from "../controllers/aiController.js";
import { createCrudController } from "../controllers/crudController.js";
import { getCollection } from "../services/databaseService.js";

const router = Router();
const controller = createCrudController("tasks");

router.get("/", controller.list);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);
router.get("/priorities/today", async (req, res, next) => {
  try {
    res.json(generatePriorityPlan(await getCollection("tasks")));
  } catch (error) {
    next(error);
  }
});

export default router;
