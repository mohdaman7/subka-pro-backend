import express from "express";
import {
  enrollInCourse,
  getMyEnrollments,
  getEnrollmentDetails,
  updateEnrollmentProgress,
  dropCourse,
  checkEnrollmentStatus,
  getAllEnrollments,
  getCourseEnrollmentStats,
  getTopEnrolledCourses,
} from "../controllers/enrollmentController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// ==================== STUDENT ROUTES ====================
// All student routes require authentication

// Enroll in a course
router.post("/enroll", authenticate, enrollInCourse);

// Get my enrollments
router.get("/my-enrollments", authenticate, getMyEnrollments);

// Check enrollment status for a course
router.get("/check/:courseId", authenticate, checkEnrollmentStatus);

// Get enrollment details
router.get("/:enrollmentId", authenticate, getEnrollmentDetails);

// Update enrollment progress
router.patch("/:enrollmentId/progress", authenticate, updateEnrollmentProgress);

// Drop/Unenroll from course
router.delete("/:enrollmentId", authenticate, dropCourse);

// ==================== CRM/ADMIN ROUTES ====================

// Get all enrollments (CRM)
router.get("/admin/all", authenticate, getAllEnrollments);

// Get enrollment stats for a course (CRM)
router.get(
  "/admin/course/:courseId/stats",
  authenticate,
  getCourseEnrollmentStats
);

// Get top enrolled courses (CRM)
router.get("/admin/top-courses", authenticate, getTopEnrolledCourses);

export default router;
