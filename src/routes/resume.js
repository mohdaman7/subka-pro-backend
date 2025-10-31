import { Router } from "express";
import * as resumeController from "../controllers/resumeController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// All routes require authentication and student role
router.use(authenticate);
router.use(authorize(["student"]));

// =============== ATS RESUME ROUTES ===============
router.post("/", resumeController.uploadResume);
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
router.post("/video", resumeController.uploadVideoResume);
router.get("/video/all", resumeController.getMyVideoResumes);
router.put("/video/:id", resumeController.updateVideoResume);
router.delete("/video/:id", resumeController.deleteVideoResume);
router.post("/video/:id/set-primary", resumeController.setPrimaryVideo);
router.post("/video/:id/track-view", resumeController.trackVideoView);

// =============== ANALYTICS ROUTES ===============
router.get("/analytics/overview", resumeController.getAnalytics);

export default router;
