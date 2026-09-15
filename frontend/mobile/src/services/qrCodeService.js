import { Alert } from "react-native";

export async function generateClassroomQRCode(classroomId, appUrl = "https://remindme-app.example.com") {
  try {
    const qrData = `${appUrl}/join-classroom/${classroomId}`;
    return qrData;
  } catch (error) {
    console.error("Error generating QR code:", error);
    Alert.alert("Error", "Failed to generate QR code");
    throw error;
  }
}

export function parseQRCode(qrString) {
  try {
    // Check if it's a valid classroom link
    const match = qrString.match(/join-classroom\/([a-zA-Z0-9-]+)/);
    if (match) {
      return {
        type: "classroom",
        classroomId: match[1]
      };
    }

    // Could add other QR types here
    return null;
  } catch (error) {
    console.error("Error parsing QR code:", error);
    return null;
  }
}

export async function shareClassroomQRCode(classroomName, qrUrl) {
  try {
    // This would typically use react-native-share or expo-sharing
    const message = `Join my ${classroomName} classroom using this link: ${qrUrl}`;
    // Share functionality to be implemented
    return message;
  } catch (error) {
    console.error("Error sharing QR code:", error);
    throw error;
  }
}
