import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as resumeController from "../controllers/resumeController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// Configure multer storage for resume uploads
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${unique}-${safeOriginal}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, DOC, and DOCX files are allowed"));
    }
  },
});

// All routes require authentication and student role
router.use(authenticate);
router.use(authorize(["student"]));

// =============== ATS RESUME ROUTES ===============
router.post("/", upload.single("file"), resumeController.uploadResume);
router.get("/", resumeController.getMyResumes);
router.get("/:id", resumeController.getResumeById);
router.put("/:id", resumeController.updateResume);
router.delete("/:id", resumeController.deleteResume);
router.post("/:id/duplicate", resumeController.duplicateResume);
router.post("/:id/set-primary", resumeController.setPrimaryResume);
router.post("/:id/track-view", resumeController.trackResumeView);
router.post("/:id/track-download", resumeController.trackResumeDownload);
router.get("/:id/ats-suggestions", resumeController.getATSSuggestions);

// =============== VIDEO RESUME ROUTES ===============
router.post("/video", upload.single("video"), resumeController.uploadVideoResume);
router.get("/video/all", resumeController.getMyVideoResumes);
router.put("/video/:id", resumeController.updateVideoResume);
router.delete("/video/:id", resumeController.deleteVideoResume);
router.post("/video/:id/set-primary", resumeController.setPrimaryVideo);
router.post("/video/:id/track-view", resumeController.trackVideoView);

// =============== ANALYTICS ROUTES ===============
router.get("/analytics/overview", resumeController.getAnalytics);

export default router;
