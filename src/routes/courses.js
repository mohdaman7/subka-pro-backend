import { Router } from "express";
import { authenticate, maybeAuthenticate } from "../middleware/auth.js";
import { authorize } from "../middleware/auth.js";
import { courseController } from "../controllers/courseController.js";

const router = Router();

// Public
router.get("/", courseController.listPublicCourses);
router.get("/paginated", courseController.listPublicCoursesPaginated);

// ✅ ADMIN ROUTES MUST COME BEFORE PARAM ROUTES
router.get("/admin", courseController.adminListCourses);
router.post("/admin/parent", courseController.adminCreateParentCourse);
router.post(
  "/admin/module",
  authenticate,
  courseController.adminCreateSubCourse
);
router.post(
  "/admin/:id/lessons",
  authenticate,
  courseController.adminAddLesson
);
router.put(
  "/admin/:id/lessons/:lessonId",
  authenticate,
  authorize(["admin"]),
  courseController.adminUpdateLesson
);
router.delete(
  "/admin/:id/lessons/:lessonId",
  authenticate,
  authorize(["admin"]),
  courseController.adminDeleteLesson
);

// Authenticated student
router.get("/me/access", authenticate, courseController.listMyAccess);
router.get(
  "/me/recommendations",
  authenticate,
  courseController.getRecommendations
);
router.get(
  "/me/progress/:courseId",
  authenticate,
  courseController.getMyProgress
);
router.post(
  "/me/progress/:courseId/lessons/:lessonId/complete",
  authenticate,
  courseController.completeLesson
);

// Access matrix management
router.get(
  "/admin/access",
  authenticate,
  authorize(["admin"]),
  courseController.adminListAccessMatrix
);
router.post(
  "/admin/access",
  authenticate,
  authorize(["admin"]),
  courseController.adminGrantAccess
);
router.delete(
  "/admin/access/:id",
  authenticate,
  authorize(["admin"]),
  courseController.adminRevokeAccess
);
router.put(
  "/admin/:id",
  authenticate,
  authorize(["admin"]),
  courseController.adminUpdateCourse
);
router.delete(
  "/admin/:id",
  authenticate,
  authorize(["admin"]),
  courseController.adminDeleteCourse
);

// ✅ This should be LAST to avoid intercepting other routes
// Allow optional auth so pro users can get full lessons on module
router.get("/:id", maybeAuthenticate, courseController.getCourseById);

export default router;
