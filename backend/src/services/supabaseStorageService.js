const allowedTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif"
]);

const allowedExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".zip",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif"
]);

export function isAllowedUploadType(contentType = "", fileName = "") {
  const lowerName = fileName.toLowerCase();
  const extension = lowerName.includes(".") ? `.${lowerName.split(".").pop()}` : "";
  return allowedTypes.has(contentType) || contentType.startsWith("image/") || allowedExtensions.has(extension);
}

export async function uploadBase64ToSupabase({ fileName, contentType, base64, folder = "class-files" }) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "remindme-uploads";

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (!fileName || !base64 || !isAllowedUploadType(contentType, fileName)) {
    const error = new Error("Unsupported or incomplete upload.");
    error.statusCode = 400;
    throw error;
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const objectPath = `${folder}/${Date.now()}-${safeName}`;
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const uploadUrl = `${baseUrl}/storage/v1/object/${bucket}/${objectPath}`;
  const binary = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      "Content-Type": contentType,
      "x-upsert": "false"
    },
    body: binary
  });

  if (!response.ok) {
    throw new Error(`Supabase upload failed: ${await response.text()}`);
  }

  return {
    fileName,
    contentType,
    path: objectPath,
    url: `${baseUrl}/storage/v1/object/public/${bucket}/${objectPath}`
  };
}

export async function uploadBase64ToStorage(payload) {
  if ((process.env.STORAGE_PROVIDER || "supabase").toLowerCase() !== "supabase") {
    throw new Error("Unsupported STORAGE_PROVIDER. Use supabase.");
  }
  return uploadBase64ToSupabase(payload);
}
