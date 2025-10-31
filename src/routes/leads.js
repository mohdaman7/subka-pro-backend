// backend/src/routes/leads.js
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  createLead,
  getAllLeads,
  getLeadById,
  updateLead,
  deleteLead,
  assignLead,
  unassignLead,
  updateLeadStatus,
  convertLead,
  addFollowUp,
  getFollowUps,
  getLeadStats,
  getLeadsBySource,
  getStaffPerformance,
  bulkAssignLeads,
  bulkUpdateStatus,
  roundRobinAssignLeads,
} from "../controllers/leadController.js";

const router = Router();

// All lead routes require authentication
// router.use(authenticate);

// ============================================
// LEAD CRUD ROUTES
// ============================================
router.post("/", createLead);
router.get("/", getAllLeads);
router.get("/stats", getLeadStats);
router.get("/source-stats", getLeadsBySource);
router.get("/staff-performance", getStaffPerformance);
router.get("/:id", getLeadById);
router.put("/:id", updateLead);
router.delete("/:id", deleteLead);

// ============================================
// LEAD ASSIGNMENT ROUTES
// ============================================
router.post("/:id/assign", assignLead);
router.post("/:id/unassign", unassignLead);

// ============================================
// LEAD STATUS ROUTES
// ============================================
router.patch("/:id/status", updateLeadStatus);
router.post("/:id/convert", convertLead);

// ============================================
// FOLLOW-UP ROUTES
// ============================================
router.post("/:id/follow-ups", addFollowUp);
router.get("/:id/follow-ups", getFollowUps);

// ============================================
// BULK OPERATION ROUTES
// ============================================
router.post("/bulk/assign", bulkAssignLeads);
router.post("/bulk/status", bulkUpdateStatus);
router.post("/auto-assign", roundRobinAssignLeads);

export default router;
