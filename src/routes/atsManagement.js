import express from 'express';
import * as atsController from '../controllers/atsManagementController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// ==================== APPLICATIONS ROUTES ====================
router.get('/applications', authenticate, atsController.getAllApplications);
router.get('/applications/:id', authenticate, atsController.getApplicationDetails);
router.patch('/applications/:id/status', authenticate, atsController.updateApplicationStatus);
router.patch('/applications/:id/assign-hr', authenticate, authorize(['admin', 'hr']), atsController.assignHRToApplication);
router.post('/applications/bulk-update', authenticate, authorize(['admin', 'hr']), atsController.bulkUpdateApplications);
router.post('/applications/:id/notes', authenticate, atsController.addNoteToApplication);

// ==================== INTERVIEWS ROUTES ====================
router.get('/interviews', authenticate, atsController.getAllInterviews);
router.post('/interviews', authenticate, authorize(['admin', 'hr', 'employer']), atsController.createInterview);
router.patch('/interviews/:id/reschedule', authenticate, atsController.rescheduleInterview);
router.patch('/interviews/:id/cancel', authenticate, atsController.cancelInterview);
router.post('/interviews/:id/complete', authenticate, atsController.completeInterview);

// ==================== REPORTS ROUTES ====================
router.get('/reports/dashboard', authenticate, atsController.getATSDashboardStats);
router.get('/reports/hr-performance', authenticate, authorize(['admin']), atsController.getHRPerformanceReport);
router.get('/reports/export', authenticate, atsController.exportApplications);

export default router;
