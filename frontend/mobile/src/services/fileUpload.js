import { File } from "expo-file-system";
import { Platform } from "react-native";
import { apiUrl, requestApi } from "./api";

export { apiUrl };

async function readFileAsBase64(uri) {
  if (Platform.OS !== "web") {
    // Expo SDK 57 removed readAsStringAsync from the current API. File.base64()
    // works with the cache URI returned by expo-document-picker on Android/iOS.
    return new File(uri).base64();
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function uploadClassFile(classId, localUri, fileName, contentType = "application/octet-stream") {
  const base64 = await readFileAsBase64(localUri);
  const response = await requestApi("/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName,
      contentType,
      base64,
      folder: `classes/${classId}`
    })
  });

  const uploaded = await response.json();
  return uploaded.url;
}

export async function analyzeUploadedSchedule(fileName) {
  const response = await requestApi("/schedule/analyze-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName })
  });

  const data = await response.json();
  return data.rows || [];
}

export async function uploadAndAnalyzeSchedule(classId, localUri, fileName, contentType = "image/jpeg") {
  const base64 = await readFileAsBase64(localUri);
  const response = await requestApi("/schedule/analyze-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName,
      contentType,
      base64,
      folder: `classes/${classId}/schedules`
    })
  });

  return response.json();
}

export async function saveGeneratedSchedule(row) {
  const response = await requestApi("/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row)
  });

  return response.json();
}
