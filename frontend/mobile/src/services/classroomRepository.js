import AsyncStorage from "@react-native-async-storage/async-storage";

const CLASSROOM_KEY = "remindme-classrooms";
const USER_CLASSROOMS_KEY = "remindme-user-classrooms";

export async function createClassroom(userId, classroomData) {
  try {
    const classroomId = `classroom-${Date.now()}`;
    const classroom = {
      id: classroomId,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      members: [userId],
      schedules: [],
      notes: [],
      files: [],
      announcements: [],
      ...classroomData
    };

    // Save classroom locally
    const classrooms = JSON.parse(await AsyncStorage.getItem(CLASSROOM_KEY)) || [];
    classrooms.push(classroom);
    await AsyncStorage.setItem(CLASSROOM_KEY, JSON.stringify(classrooms));

    // Add to user's classrooms
    const userClassrooms = JSON.parse(await AsyncStorage.getItem(`${USER_CLASSROOMS_KEY}-${userId}`)) || [];
    userClassrooms.push(classroomId);
    await AsyncStorage.setItem(`${USER_CLASSROOMS_KEY}-${userId}`, JSON.stringify(userClassrooms));

    return classroom;
  } catch (error) {
    console.error("Error creating classroom:", error);
    throw error;
  }
}

export async function joinClassroom(userId, classroomId) {
  try {
    const classrooms = JSON.parse(await AsyncStorage.getItem(CLASSROOM_KEY)) || [];
    const classroom = classrooms.find((c) => c.id === classroomId);

    if (!classroom) {
      throw new Error("Classroom not found");
    }

    if (!classroom.members.includes(userId)) {
      classroom.members.push(userId);
      await AsyncStorage.setItem(CLASSROOM_KEY, JSON.stringify(classrooms));
    }

    // Add to user's classrooms
    const userClassrooms = JSON.parse(await AsyncStorage.getItem(`${USER_CLASSROOMS_KEY}-${userId}`)) || [];
    if (!userClassrooms.includes(classroomId)) {
      userClassrooms.push(classroomId);
      await AsyncStorage.setItem(`${USER_CLASSROOMS_KEY}-${userId}`, JSON.stringify(userClassrooms));
    }

    return classroom;
  } catch (error) {
    console.error("Error joining classroom:", error);
    throw error;
  }
}

export async function getUserClassrooms(userId) {
  try {
    const userClassroomIds = JSON.parse(await AsyncStorage.getItem(`${USER_CLASSROOMS_KEY}-${userId}`)) || [];
    const allClassrooms = JSON.parse(await AsyncStorage.getItem(CLASSROOM_KEY)) || [];
    return allClassrooms.filter((c) => userClassroomIds.includes(c.id));
  } catch (error) {
    console.error("Error fetching user classrooms:", error);
    return [];
  }
}

export async function getClassroom(classroomId) {
  try {
    const classrooms = JSON.parse(await AsyncStorage.getItem(CLASSROOM_KEY)) || [];
    return classrooms.find((c) => c.id === classroomId);
  } catch (error) {
    console.error("Error fetching classroom:", error);
    return null;
  }
}

export async function updateClassroom(classroomId, updates) {
  try {
    const classrooms = JSON.parse(await AsyncStorage.getItem(CLASSROOM_KEY)) || [];
    const index = classrooms.findIndex((c) => c.id === classroomId);

    if (index === -1) {
      throw new Error("Classroom not found");
    }

    classrooms[index] = { ...classrooms[index], ...updates, updatedAt: new Date().toISOString() };
    await AsyncStorage.setItem(CLASSROOM_KEY, JSON.stringify(classrooms));
    return classrooms[index];
  } catch (error) {
    console.error("Error updating classroom:", error);
    throw error;
  }
}

export async function deleteClassroom(userId, classroomId) {
  try {
    const classrooms = JSON.parse(await AsyncStorage.getItem(CLASSROOM_KEY)) || [];
    const classroom = classrooms.find((c) => c.id === classroomId);

    if (!classroom || classroom.createdBy !== userId) {
      throw new Error("You do not have permission to delete this classroom");
    }

    // Remove from all members' classrooms
    const userClassroomKeys = classrooms
      .flatMap((c) => c.members.map((m) => `${USER_CLASSROOMS_KEY}-${m}`));

    for (const key of new Set(userClassroomKeys)) {
      const userClassrooms = JSON.parse(await AsyncStorage.getItem(key)) || [];
      const filtered = userClassrooms.filter((id) => id !== classroomId);
      await AsyncStorage.setItem(key, JSON.stringify(filtered));
    }

    // Remove classroom
    const filtered = classrooms.filter((c) => c.id !== classroomId);
    await AsyncStorage.setItem(CLASSROOM_KEY, JSON.stringify(filtered));

    return { message: "Classroom deleted" };
  } catch (error) {
    console.error("Error deleting classroom:", error);
    throw error;
  }
}
