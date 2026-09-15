import { Router } from "express";
import {
  getUserNotifications,
  markNotificationAsRead,
  deleteNotification
} from "../services/notificationService.js";

const router = Router();

// Get user notifications
router.get("/user/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { unreadOnly } = req.query;
    const notifications = await getUserNotifications(userId, unreadOnly === "true");
    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

// Mark notification as read
router.put("/:id/read", async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await markNotificationAsRead(id);
    res.json(notification);
  } catch (error) {
    next(error);
  }
});

// Delete notification
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await deleteNotification(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
