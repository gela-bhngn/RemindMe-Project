import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import scheduleRoutes from "./routes/scheduleRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import announcementRoutes from "./routes/announcementRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import classroomRoutes from "./routes/classroomRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { readDatabase } from "./services/databaseService.js";
import { authenticate } from "./middleware/authenticate.js";
import { getSupabase, isSupabaseEnabled } from "./services/supabaseService.js";

export function createApp() {
  const app = express();
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(cors({
    origin(origin, callback) {
      // Native Expo clients do not send an Origin header. Browser origins must
      // be explicitly allowed when CORS_ALLOWED_ORIGINS is set.
      if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("This browser origin is not allowed to use the RemindMe API."));
    }
  }));
  app.use(express.json({ limit: "25mb" }));
  app.use(morgan("dev"));

  app.get("/api", (req, res) => {
    res.json({
      status: "ok",
      message: "RemindMe API is running",
      app: "RemindMe API",
      routes: [
        "/api/health",
        "/api/health/database",
        "/api/auth",
        "/api/workspace",
        "/api/schedule",
        "/api/tasks",
        "/api/notes",
        "/api/announcements",
        "/api/uploads",
        "/api/classrooms",
        "/api/notifications"
        ,"/api/admin"
      ]
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", app: "RemindMe API" });
  });

  // Unlike the basic health route, this checks the configured database. Use it
  // before testing Expo so an invalid WAMP account is diagnosed at the server.
  app.get("/api/health/database", async (req, res) => {
    try {
      if (isSupabaseEnabled()) {
        const { error } = await getSupabase().from("workspaces").select("user_id", { head: true, count: "exact" }).limit(1);
        if (error) throw error;
      } else {
        await readDatabase();
      }
      res.json({ status: "ok", database: process.env.DATABASE_PROVIDER || "json-fallback" });
    } catch (error) {
      console.error("Database health check failed:", error.message);
      res.status(503).json({
        status: "error",
        message: "Database connection failed. Check DATABASE_PROVIDER and the SUPABASE_* values in .env.",
        reason: error.message
      });
    }
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/workspace", workspaceRoutes);
  app.use("/api/schedule", authenticate, scheduleRoutes);
  app.use("/api/tasks", authenticate, taskRoutes);
  app.use("/api/notes", authenticate, noteRoutes);
  app.use("/api/announcements", authenticate, announcementRoutes);
  app.use("/api/uploads", authenticate, uploadRoutes);
  app.use("/api/classrooms", authenticate, classroomRoutes);
  app.use("/api/notifications", authenticate, notificationRoutes);
  app.use("/api/admin", authenticate, adminRoutes);

  app.use(errorHandler);
  return app;
}

const app = createApp();
const port = process.env.PORT || 4000;
const host = process.env.HOST || "0.0.0.0";

if (process.env.NODE_ENV !== "test") {
  const server = app.listen(port, host, () => {
    console.log(`RemindMe API running on http://${host}:${port}`);
    console.log(`Phone/APK API URL should be http://YOUR-COMPUTER-IP:${port}/api`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use.`);
      console.error("Fix: close the other backend terminal, or run this API with another port:");
      console.error("PowerShell: $env:PORT=4001; npm run dev");
      process.exit(1);
    }

    throw error;
  });
}

export default app;
