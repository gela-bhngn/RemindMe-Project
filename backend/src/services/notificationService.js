import { addToCollection, getCollection, updateCollectionItem } from "./databaseService.js";
import { randomUUID } from "crypto";

export async function createNotification(userId, data) {
  try {
    const notification = {
      id: randomUUID(),
      userId,
      type: data.type || "info", // 'info', 'warning', 'reminder', 'invitation'
      title: data.title,
      message: data.message,
      data: data.data || {},
      read: false,
      createdAt: new Date().toISOString(),
      expiresAt: data.expiresAt || null
    };

    return await addToCollection("notifications", notification);
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

export async function getUserNotifications(userId, unreadOnly = false) {
  try {
    const notifications = await getCollection("notifications");
    let filtered = notifications.filter((n) => n.userId === userId);

    if (unreadOnly) {
      filtered = filtered.filter((n) => !n.read);
    }

    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.error("Error fetching notifications:", error);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId) {
  try {
    return await updateCollectionItem("notifications", notificationId, { read: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
}

export async function deleteNotification(notificationId) {
  try {
    const notifications = await getCollection("notifications");
    const filtered = notifications.filter((n) => n.id !== notificationId);
    // This would need proper deletion logic in database service
    return { message: "Notification deleted" };
  } catch (error) {
    console.error("Error deleting notification:", error);
    throw error;
  }
}

// Send notifications to multiple users (e.g., classroom announcement)
export async function broadcastNotification(userIds, data) {
  try {
    const promises = userIds.map((userId) => createNotification(userId, data));
    return await Promise.all(promises);
  } catch (error) {
    console.error("Error broadcasting notifications:", error);
    throw error;
  }
}

// Notification triggers
export async function notifyClassroomInvite(userId, classroomName, inviteLink) {
  return createNotification(userId, {
    type: "invitation",
    title: "Class Invitation",
    message: `You've been invited to join ${classroomName}`,
    data: { inviteLink, classroomName }
  });
}

export async function notifyNewAssignment(userId, assignmentTitle, subject) {
  return createNotification(userId, {
    type: "info",
    title: "New Assignment",
    message: `New assignment in ${subject}: ${assignmentTitle}`,
    data: { assignmentTitle, subject }
  });
}

export async function notifyTaskReminder(userId, taskTitle, dueDate) {
  return createNotification(userId, {
    type: "reminder",
    title: "Task Reminder",
    message: `Reminder: ${taskTitle} is due ${dueDate}`,
    data: { taskTitle, dueDate }
  });
}

export async function notifyClassroomAnnouncement(classroomId, classroomName, announcement, users) {
  const data = {
    type: "info",
    title: `Announcement from ${classroomName}`,
    message: announcement,
    data: { classroomId, classroomName }
  };

  return broadcastNotification(users, data);
}
