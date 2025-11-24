import { Router } from "express";
import * as authController from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// OTP Routes
router.post("/send-otp", authController.sendOTP);
router.post("/verify-otp", authController.verifyOTP);

// Skill Academy OTP-only Routes
router.post("/skill-academy/send-otp", authController.skillAcademySendOTP);
router.post("/skill-academy/verify-otp", authController.skillAcademyVerifyOTP);

// Authentication Routes (Choose one approach)

// Approach 1: Single register endpoint (recommended)
router.post("/register", authController.register);

// Approach 2: Separate endpoints (alternative)
// router.post("/register/student", authController.registerStudent);
// router.post("/register/employer", authController.registerEmployer);

router.post("/login", authController.login);
router.post("/admin/login", authController.adminLogin);
router.post("/logout", authController.logout);
router.post("/change-password", authenticate, authController.changePassword);

// Additions to align with frontend services
router.get(
  "/me",
  authenticate,
  authController.me ??
    ((req, res) =>
      res.status(501).json({ success: false, message: "Not implemented" }))
);
router.put(
  "/profile",
  authenticate,
  authController.updateCurrentProfile ??
    ((req, res) =>
      res.status(501).json({ success: false, message: "Not implemented" }))
);
router.post(
  "/forgot-password",
  authController.forgotPassword ??
    ((req, res) =>
      res.status(501).json({ success: false, message: "Not implemented" }))
);
router.post(
  "/reset-password",
  authController.resetPassword ??
    ((req, res) =>
      res.status(501).json({ success: false, message: "Not implemented" }))
);

export default router;
