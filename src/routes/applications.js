import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  applyForJob,
  getMyApplications,
  getApplicationsForMyJobs,
  updateApplicationStatus,
  getApplicationById,
  withdrawApplication,
  getApplicationStats,
  scheduleInterview,
  rescheduleInterview,
  cancelInterview,
  completeInterview,
} from "../controllers/applicationController.js";
import { limitByPlan } from "../middleware/plan.js";

const router = Router();

// Student routes
router.post(
  "/apply",
  authenticate,
  authorize(["student"]),
  limitByPlan("apply_job"),
  applyForJob
);
router.get(
  "/student/my-applications",
  authenticate,
  authorize(["student"]),
  getMyApplications
);
router.get(
  "/student/stats",
  authenticate,
  authorize(["student"]),
  getApplicationStats
);
router.get(
  "/:id",
  authenticate,
  authorize(["student", "employer", "admin"]),
  getApplicationById
);
router.patch(
  "/:id/withdraw",
  authenticate,
  authorize(["student"]),
  withdrawApplication
);

// Employer routes
router.get(
  "/employer/my-applications",
  authenticate,
  authorize(["employer", "admin"]),
  getApplicationsForMyJobs
);
router.get(
  "/employer/stats",
  authenticate,
  authorize(["employer", "admin"]),
  getApplicationStats
);
router.patch(
  "/:id/status",
  authenticate,
  authorize(["employer", "admin"]),
  updateApplicationStatus
);

// Interview routes (employer)
router.post(
  "/:id/interview/schedule",
  authenticate,
  authorize(["employer", "admin"]),
  scheduleInterview
);

router.patch(
  "/:id/interview/reschedule",
  authenticate,
  authorize(["employer", "admin"]),
  rescheduleInterview
);

router.patch(
  "/:id/interview/cancel",
  authenticate,
  authorize(["employer", "admin"]),
  cancelInterview
);

router.patch(
  "/:id/interview/complete",
  authenticate,
  authorize(["employer", "admin"]),
  completeInterview
);

export default router;
