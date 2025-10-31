// backend/src/routes/crm.js
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  getAllUsers,
  getUserById,
  updateUserStatus,
  getPlatformStats,
  getAllJobsAdmin,
  getAllApplications,
  getCandidates,
  getPendingRegistrations,
  approveUser,
  rejectUser,
  getUsersByStatus,
  reactivateUser,
  deactivateUser,
  upgradePlan,
  downgradePlan,
  getUserProfile,
  bulkApproveUsers,
  bulkRejectUsers,
  getUserStats,
  searchUsers,
  updateEmployerVerification,
  updateEmployerPlanAdmin,
  updateEmployerDocumentStatus,
  changeJobStatusAdmin,
  createCompany,
  listCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
  approveJob,
  rejectJob,
  requestJobChanges,
  reanalyzeJob,
} from "../controllers/crmController.js";

const router = Router();

// All CRM routes require admin authentication
// router.use(authenticate, authorize(["admin"]));

// ============================================
// NEW: Pending Registrations Management
// ============================================
router.get("/pending", getPendingRegistrations);
router.post("/approve/:id", approveUser);
router.post("/reject/:id", rejectUser);

// ============================================
// User Management - Enhanced
// ============================================
router.get("/users", getAllUsers);
router.get("/users/status/:status", getUsersByStatus);
router.get("/users/search", searchUsers);
router.get("/users/stats", getUserStats);
router.get("/users/:id", getUserById);
router.get("/users/:id/profile", getUserProfile);
router.patch("/users/:id/status", updateUserStatus);
router.post("/users/:id/reactivate", reactivateUser);
router.post("/users/:id/deactivate", deactivateUser);
router.post("/users/:id/upgrade-plan", upgradePlan);
router.post("/users/:id/downgrade-plan", downgradePlan);

// Bulk user operations
router.post("/users/bulk/approve", bulkApproveUsers);
router.post("/users/bulk/reject", bulkRejectUsers);

// Candidates listing with filters
router.get("/candidates", getCandidates);

// ============================================
// Platform Statistics
// ============================================
router.get("/dashboard/stats", getPlatformStats);

// ============================================
// Job Management (admin view)
// ============================================
router.get("/jobs", getAllJobsAdmin);
router.patch("/jobs/:jobId/status", changeJobStatusAdmin);
// Moderation actions
router.post("/jobs/:jobId/approve", approveJob);
router.post("/jobs/:jobId/reject", rejectJob);
router.post("/jobs/:jobId/request-changes", requestJobChanges);
router.post("/jobs/:jobId/reanalyze", reanalyzeJob);

// ============================================
// Application Management (admin view)
// ============================================
router.get("/applications", getAllApplications);

// ============================================
// Company Management
// ============================================
router.get("/companies", listCompanies);
router.post("/companies", createCompany);
router.get("/companies/:id", getCompanyById);
router.put("/companies/:id", updateCompany);
router.delete("/companies/:id", deleteCompany);

// ============================================
// Employer Admin Actions
// ============================================
router.patch("/employers/:id/verify", updateEmployerVerification);
router.patch("/employers/:id/plan", updateEmployerPlanAdmin);
router.patch("/employers/:id/documents/:docId", updateEmployerDocumentStatus);

export default router;
