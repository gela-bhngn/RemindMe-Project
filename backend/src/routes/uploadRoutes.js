import { Router } from "express";
import { uploadBase64ToStorage } from "../services/supabaseStorageService.js";

const router = Router();

router.post("/", async (req, res, next) => {
  try {
    const result = await uploadBase64ToStorage(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
