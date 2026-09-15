import { Router } from "express";
import tesseract from "tesseract.js";
import { createCrudController } from "../controllers/crudController.js";
import { uploadBase64ToStorage } from "../services/supabaseStorageService.js";

const router = Router();
const controller = createCrudController("schedule");

router.get("/", controller.list);
router.post("/analyze-upload", (req, res) => {
  const rows = analyzeScheduleUpload(req.body?.fileName || "");
  res.json({ rows });
});
router.post("/analyze-image", async (req, res, next) => {
  try {
    const uploaded = await uploadBase64ToStorage({ ...req.body, folder: req.body.folder || "schedules" });
    const binary = Buffer.from(String(req.body.base64 || "").replace(/^data:[^;]+;base64,/, ""), "base64");
    let bestText = "";
    let bestRows = [];
    for (const pageSegmentationMode of [6, 11, 4]) {
      try {
        const result = await tesseract.recognize(binary, "eng", { tessedit_pageseg_mode: String(pageSegmentationMode) });
        const candidateText = result?.data?.text || "";
        const candidateRows = analyzeScheduleText(candidateText, req.body.fileName || "");
        const isFallback = candidateRows.length === 1 && candidateRows[0].subject === "Uploaded Schedule Subject";
        if (!isFallback && candidateRows.length > bestRows.length) {
          bestRows = candidateRows;
          bestText = candidateText;
        }
      } catch {
      }
    }

    const rows = bestRows.length ? bestRows : analyzeScheduleUpload(req.body.fileName || "");
    res.status(201).json({ uploaded, rows, text: bestText });
  } catch (error) {
    next(error);
  }
});
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

export default router;

function analyzeScheduleUpload(fileName = "") {
  const cleanName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const dayMatch = cleanName.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
  const timeMatch = cleanName.match(/\b(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?\s*(?:to|-)\s*(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?\b/i);
  const roomMatch = cleanName.match(/\b(?:room|rm|lab)\s*([a-z0-9 -]+)/i);
  const subjectText = cleanName
    .replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/ig, "")
    .replace(/\b\d{1,2}:?\d{0,2}\s*(AM|PM)?\s*(to|-)\s*\d{1,2}:?\d{0,2}\s*(AM|PM)?\b/ig, "")
    .replace(/\b(?:room|rm|lab)\s*[a-z0-9 -]+/ig, "")
    .replace(/\breceived\b|\bimage\b|\bschedule\b|\bclass\b/ig, "")
    .trim();
  const subject = titleCase(subjectText || "Uploaded Schedule Subject");

  return [{
    id: `upload-${Date.now()}`,
    subjectId: normalizeId(subject),
    subject,
    day: normalizeDay(dayMatch?.[1] || "Monday"),
    start: timeMatch ? formatTime(timeMatch[1], timeMatch[2], timeMatch[3]) : "09:00",
    end: timeMatch ? formatTime(timeMatch[4], timeMatch[5], timeMatch[6] || timeMatch[3]) : "10:00",
    room: titleCase(roomMatch?.[1]?.trim() || "Room TBA"),
    fromUpload: true
  }];
}

function analyzeScheduleText(text = "", fileName = "") {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const rows = [];
  let currentDay = "Monday";

  for (const line of lines) {
    const dayMatch = line.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
    const timeMatch = line.match(/\b(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?\s*(?:to|-|–)\s*(\d{1,2})(?::?(\d{2}))?\s*(AM|PM)?\b/i);
    if (dayMatch) currentDay = normalizeDay(dayMatch[1]);
    if (!timeMatch) continue;

    const roomMatch = line.match(/\b(?:room|rm|lab)\s*([a-z0-9 -]+)/i);
    const subjectText = line.slice(0, timeMatch.index)
      .replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/ig, "")
      .replace(/^[-|:]+|[-|:]+$/g, "")
      .trim();
    const subject = titleCase(subjectText || "Uploaded Schedule Subject");

    rows.push({
      id: `ocr-${Date.now()}-${rows.length}`,
      subjectId: normalizeId(subject),
      subject,
      day: currentDay,
      start: timeMatch ? formatTime(timeMatch[1], timeMatch[2], timeMatch[3]) : "09:00",
      end: timeMatch ? formatTime(timeMatch[4], timeMatch[5], timeMatch[6] || timeMatch[3]) : "10:00",
      room: titleCase(roomMatch?.[1]?.trim() || "Room TBA"),
      fromUpload: true
    });
  }

  return rows.length ? rows : analyzeScheduleUpload(fileName);
}

function normalizeDay(value) {
  const map = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  return map[value.toLowerCase().slice(0, 3)] || titleCase(value);
}

function formatTime(hour, minute = "00", meridiem = "") {
  let numericHour = Number(hour);
  const normalizedMinute = String(minute || "00").padStart(2, "0");
  const upperMeridiem = String(meridiem || "").toUpperCase();
  if (upperMeridiem === "PM" && numericHour < 12) numericHour += 12;
  if (upperMeridiem === "AM" && numericHour === 12) numericHour = 0;
  return `${String(numericHour).padStart(2, "0")}:${normalizedMinute}`;
}

function normalizeId(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `subject-${Date.now()}`;
}

function titleCase(value = "") {
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase()).trim();
}
