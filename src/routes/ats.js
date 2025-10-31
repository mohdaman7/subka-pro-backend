// backend/src/routes/ats.js
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  // Resume Management
  getAllResumes,
  parseResume,
  getResumeStats,
  // Job Management
  getATSJobs,
  assignJobToStaff,
  getJobStats,
  // Candidate Search & Filtering
  searchCandidates,
  shortlistCandidate,
  rejectCandidate,
  getCandidateDetails,
  addCandidateNote,
  // Dashboard
  getATSDashboardStats,
} from "../controllers/atsController.js";

const router = Router();

// All ATS routes require admin authentication
// router.use(authenticate, authorize(["admin"]));

// ============================================
// Dashboard
// ============================================
router.get("/dashboard/stats", getATSDashboardStats);

// ============================================
// Resume Collection & Parsing
// ============================================
router.get("/resumes", getAllResumes);
router.get("/resumes/stats", getResumeStats);
router.post("/resumes/:id/parse", parseResume);

// ============================================
// Job Posting Management (ATS View)
// ============================================
router.get("/jobs", getATSJobs);
router.get("/jobs/stats", getJobStats);
router.post("/jobs/:jobId/assign", assignJobToStaff);

// ============================================
// Candidate Filtering & Search
// ============================================
router.get("/candidates/search", searchCandidates);
router.get("/candidates/:candidateId", getCandidateDetails);
router.post("/candidates/:candidateId/shortlist", shortlistCandidate);
router.post("/candidates/:candidateId/reject", rejectCandidate);
router.post("/candidates/:candidateId/notes", addCandidateNote);

export default router;
