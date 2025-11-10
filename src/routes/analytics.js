import express from "express";
import {
  getOverviewStats,
  getLeadConversionAnalytics,
  getRevenueReports,
  getPlacementAnalytics,
  getEmployerEngagement,
  getCourseAnalytics,
  getStaffPerformance,
  getTopEmployersByJobPosts,
  getTopEmployersByApplications,
  getTopCoursesByPerformance,
  exportReport,
} from "../controllers/analyticsController.js";

const router = express.Router();

// Overview Dashboard
router.get("/overview", getOverviewStats);

// Lead Conversion Analytics
router.get("/leads/conversion", getLeadConversionAnalytics);

// Revenue & Payment Reports
router.get("/revenue", getRevenueReports);

// Student Placement Analytics
router.get("/placements", getPlacementAnalytics);

// Employer Engagement Analytics
router.get("/employers/engagement", getEmployerEngagement);

// Top Employers by Job Posts
router.get("/employers/top-by-jobs", getTopEmployersByJobPosts);

// Top Employers by Applications
router.get("/employers/top-by-applications", getTopEmployersByApplications);

// Training/Course Analytics
router.get("/courses", getCourseAnalytics);

// Top Courses by Performance
router.get("/courses/top-performance", getTopCoursesByPerformance);

// Staff Performance
router.get("/staff/performance", getStaffPerformance);

// Export Reports
router.get("/export", exportReport);

export default router;
