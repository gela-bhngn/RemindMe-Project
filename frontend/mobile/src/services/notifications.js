import Constants from "expo-constants";
import { Platform } from "react-native";

// Android Expo Go has no push-notification native module from SDK 53 onward.
// Do not load expo-notifications there: loading it can register a push-token
// listener before this app schedules any local reminder.
const canUseNativeNotifications = Platform.OS !== "web" && Constants.appOwnership !== "expo";
const Notifications = canUseNativeNotifications ? require("expo-notifications") : null;

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true
    })
  });
}

export async function requestNotificationPermission() {
  // Expo Go supports local notifications. Browsers do not support Expo's
  // notification scheduling API, so the in-app notifications view remains
  // available there without triggering an unsupported native call.
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleTaskReminder(task) {
  if (!Notifications) return null;
  const allowed = await requestNotificationPermission();
  if (!allowed || !task.dueDate) return null;

  const dueDate = new Date(`${task.dueDate}T08:00:00`);
  const reminderDate = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
  if (reminderDate <= new Date()) return null;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Upcoming: ${task.title}`,
      body: `${task.subject || "Academic task"} is due tomorrow.`,
      data: { taskId: task.id }
    },
    trigger: reminderDate
  });
}
