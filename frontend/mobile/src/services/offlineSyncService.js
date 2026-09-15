import AsyncStorage from "@react-native-async-storage/async-storage";

const SYNC_QUEUE_KEY = "remindme-sync-queue";
const LAST_SYNC_KEY = "remindme-last-sync";

export async function addToSyncQueue(action) {
  try {
    const queue = JSON.parse(await AsyncStorage.getItem(SYNC_QUEUE_KEY)) || [];
    queue.push({
      ...action,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString()
    });
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    return queue;
  } catch (error) {
    console.error("Error adding to sync queue:", error);
    throw error;
  }
}

export async function getSyncQueue() {
  try {
    return JSON.parse(await AsyncStorage.getItem(SYNC_QUEUE_KEY)) || [];
  } catch (error) {
    console.error("Error getting sync queue:", error);
    return [];
  }
}

export async function clearSyncQueue() {
  try {
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([]));
  } catch (error) {
    console.error("Error clearing sync queue:", error);
    throw error;
  }
}

export async function processSyncQueue(syncFn, canSync = () => true) {
  try {
    const queue = await getSyncQueue();
    const results = [];

    for (const action of queue) {
      if (!canSync(action)) {
        results.push({ action, success: true, skipped: true });
        continue;
      }
      try {
        const result = await syncFn(action);
        results.push({ action, result, success: true });
      } catch (error) {
        results.push({ action, error: error.message, success: false });
      }
    }

    // Clear only successful items
    const failedItems = queue.filter((item) =>
      results.some((r) => r.action.id === item.id && (!r.success || r.skipped))
    );
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(failedItems));
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

    return results;
  } catch (error) {
    console.error("Error processing sync queue:", error);
    throw error;
  }
}

export async function getLastSyncTime() {
  try {
    return await AsyncStorage.getItem(LAST_SYNC_KEY);
  } catch (error) {
    console.error("Error getting last sync time:", error);
    return null;
  }
}

export async function queueAddTask(task) {
  return addToSyncQueue({
    type: "ADD_TASK",
    payload: task
  });
}

export async function queueUpdateTask(taskId, updates) {
  return addToSyncQueue({
    type: "UPDATE_TASK",
    payload: { id: taskId, ...updates }
  });
}

export async function queueAddNote(note) {
  return addToSyncQueue({
    type: "ADD_NOTE",
    payload: note
  });
}

export async function queueDeleteItem(type, itemId) {
  return addToSyncQueue({
    type: `DELETE_${type.toUpperCase()}`,
    payload: { id: itemId }
  });
}
