// routes/student.js (updated)
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as studentController from "../controllers/studentController.js";
import {
  uploadProfilePicture,
  uploadResume,
} from "../controllers/uploadController.js";

const router = Router();

// Get student profile
router.get("/profile", authenticate, studentController.getProfile);

// Update student profile
router.put("/profile", authenticate, studentController.updateProfile);

// Upload profile picture
router.post("/upload-profile-picture", authenticate, uploadProfilePicture);

// Upload resume
router.post("/upload-resume", authenticate, uploadResume);

// Support tickets
router.get(
  "/support/tickets",
  authenticate,
  authorize(["student"]),
  studentController.listMySupportTickets
);
router.post(
  "/support/tickets",
  authenticate,
  authorize(["student"]),
  studentController.createSupportTicket
);
router.get(
  "/support/tickets/:id",
  authenticate,
  authorize(["student"]),
  studentController.getMySupportTicketById
);

// Activity overview
router.get(
  "/activity",
  authenticate,
  authorize(["student"]),
  studentController.getActivity
);

// Get student interviews
router.get(
  "/interviews",
  authenticate,
  authorize(["student"]),
  studentController.getMyInterviews
);

export default router;
