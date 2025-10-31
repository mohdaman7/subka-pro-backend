import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  createJob,
  getAllJobs,
  getMyJobs,
  getJobById,
  updateJob,
  deleteJob,
  getJobApplications,
  changeJobStatus,
} from "../controllers/jobController.js";
import { limitByPlan } from "../middleware/plan.js";

const router = Router();

// Public routes
router.get("/", getAllJobs);
router.get("/:id", getJobById);

// Employer routes
router.post(
  "/",
  authenticate,
  authorize(["employer", "admin"]),
  limitByPlan("create_or_activate_job"),
  createJob
);
router.get(
  "/employer/my-jobs",
  authenticate,
  authorize(["employer", "admin"]),
  getMyJobs
);
router.put("/:id", authenticate, authorize(["employer", "admin"]), updateJob);
router.patch(
  "/:id/status",
  authenticate,
  authorize(["employer", "admin"]),
  limitByPlan("create_or_activate_job"),
  changeJobStatus
);
router.delete(
  "/:id",
  authenticate,
  authorize(["employer", "admin"]),
  deleteJob
);
router.get(
  "/:id/applications",
  authenticate,
  authorize(["employer", "admin"]),
  getJobApplications
);

export default router;
