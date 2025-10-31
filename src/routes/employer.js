import { Router } from "express";
import * as employerController from "../controllers/employerController.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as collabController from "../controllers/collabController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Optional: Only allow employers to access these routes
// router.use(authorize(['employer']));

// Employer profile routes
router.get("/profile", employerController.getEmployerProfile);
router.get("/dashboard", employerController.getEmployerDashboard);
router.post("/complete-profile", employerController.completeEmployerProfile); // For initial setup
router.put("/profile", employerController.updateEmployerProfile); // For partial updates
router.put("/hiring-preferences", employerController.updateHiringPreferences);

// Plan & Analytics
router.put("/plan", authorize(["employer", "admin"]), employerController.updateEmployerPlan);
router.get("/analytics", authorize(["employer", "admin"]), employerController.getEmployerAnalytics);

// ==============================
// File uploads (documents, cover image)
// ==============================
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
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Document upload & verification routes
router.get(
  "/verification/documents",
  authorize(["employer", "admin"]),
  employerController.listVerificationDocuments
);
router.post(
  "/verification/documents",
  authorize(["employer", "admin"]),
  upload.single("document"),
  employerController.uploadVerificationDocument
);
router.delete(
  "/verification/documents/:docId",
  authorize(["employer", "admin"]),
  employerController.deleteVerificationDocument
);
router.get(
  "/verification/status",
  authorize(["employer", "admin"]),
  employerController.getEmployerVerificationStatus
);

// Branding
router.post(
  "/branding/cover-image",
  authorize(["employer", "admin"]),
  upload.single("coverImage"),
  employerController.uploadCoverImage
);
router.put(
  "/branding",
  authorize(["employer", "admin"]),
  employerController.updateBranding
);

// Team collaboration routes (employer only)
router.get("/team", authorize(["employer", "admin"]), collabController.getTeam);
router.post("/team/invite", authorize(["employer", "admin"]), collabController.inviteTeamMember);
router.patch(
  "/team/members/:memberId",
  authorize(["employer", "admin"]),
  collabController.updateTeamMember
);
router.delete(
  "/team/members/:memberId",
  authorize(["employer", "admin"]),
  collabController.removeTeamMember
);

// Candidate notes
router.get("/notes", authorize(["employer", "admin"]), collabController.listNotes);
router.post("/notes", authorize(["employer", "admin"]), collabController.addNote);
router.patch("/notes/:id", authorize(["employer", "admin"]), collabController.updateNote);
router.delete("/notes/:id", authorize(["employer", "admin"]), collabController.deleteNote);

// Activity feed
router.get("/activity", authorize(["employer", "admin"]), collabController.getActivityFeed);

// Saved candidate views
router.get("/views", authorize(["employer", "admin"]), collabController.listSavedViews);
router.post("/views", authorize(["employer", "admin"]), collabController.createSavedView);
router.patch("/views/:id", authorize(["employer", "admin"]), collabController.updateSavedView);
router.delete("/views/:id", authorize(["employer", "admin"]), collabController.deleteSavedView);

// Public routes (optional) - remove authentication for these
router.get("/public/:id", employerController.getEmployerById);
router.get("/public", employerController.getAllEmployers);

export default router;
