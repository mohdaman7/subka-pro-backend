import { z } from 'zod';
import { ApplicationModel } from '../models/Application.js';
import { InterviewModel } from '../models/Interview.js';
import { JobModel } from '../models/Job.js';
import { UserModel } from '../models/User.js';
import mongoose from 'mongoose';

// ==================== APPLICATIONS MODULE ====================

export const getAllApplications = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, status, jobId, employerId, assignedHR, search,
      dateFrom, dateTo, source, sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    const filter = {};
    if (status) filter.status = Array.isArray(status) ? { $in: status } : status;
    if (jobId) filter.jobId = jobId;
    if (employerId) filter.employerId = employerId;
    if (assignedHR) filter.assignedHR = assignedHR === 'unassigned' ? null : assignedHR;
    if (source) filter.source = source;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    let searchFilter = {};
    if (search) {
      const users = await UserModel.find({
        $or: [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      }).select('_id');
      
      const jobs = await JobModel.find({
        title: { $regex: search, $options: 'i' },
      }).select('_id');

      searchFilter = {
        $or: [
          { studentId: { $in: users.map(u => u._id) } },
          { jobId: { $in: jobs.map(j => j._id) } },
        ],
      };
    }

    const finalFilter = search ? { $and: [filter, searchFilter] } : filter;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const applications = await ApplicationModel.find(finalFilter)
      .populate('studentId', 'firstName lastName email phone profilePicture education workExperience skills')
      .populate('jobId', 'title department location employmentType salary')
      .populate('employerId', 'firstName lastName companyName email')
      .populate('assignedHR', 'firstName lastName email')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await ApplicationModel.countDocuments(finalFilter);

    const statusCounts = await ApplicationModel.aggregate([
      { $match: employerId ? { employerId: new mongoose.Types.ObjectId(employerId) } : {} },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return res.json({
      success: true,
      data: {
        applications,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
        statusCounts: statusCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message,
    });
  }
};

export const getApplicationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await ApplicationModel.findById(id)
      .populate('studentId', 'firstName lastName email phone profilePicture education workExperience skills portfolio linkedIn github')
      .populate('jobId')
      .populate('employerId', 'firstName lastName companyName email phone')
      .populate('assignedHR', 'firstName lastName email profilePicture')
      .populate('notes.createdBy', 'firstName lastName')
      .populate('statusHistory.updatedBy', 'firstName lastName')
      .lean();

    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const interviews = await InterviewModel.find({ applicationId: id })
      .populate('interviewers.userId', 'firstName lastName email')
      .sort({ scheduledAt: -1 })
      .lean();

    return res.json({ success: true, data: { application, interviews } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch application details', error: error.message });
  }
};

export const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason, rejectionReason } = req.body;

    const application = await ApplicationModel.findById(id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    application.statusHistory.push({ status, updatedBy: req.user.id, reason });
    application.status = status;

    if (status === 'rejected') {
      application.rejectionReason = rejectionReason;
      application.rejectedAt = new Date();
      application.rejectedBy = req.user.id;
    }

    await application.save();
    return res.json({ success: true, message: 'Status updated successfully', data: application });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to update status', error: error.message });
  }
};

export const assignHRToApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { hrId } = req.body;

    const application = await ApplicationModel.findByIdAndUpdate(
      id,
      { assignedHR: hrId, assignedAt: new Date() },
      { new: true }
    ).populate('assignedHR', 'firstName lastName email');

    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    return res.json({ success: true, message: 'HR assigned successfully', data: application });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to assign HR', error: error.message });
  }
};

export const bulkUpdateApplications = async (req, res) => {
  try {
    const { applicationIds, action, data } = req.body;

    let result;
    switch (action) {
      case 'updateStatus':
        result = await ApplicationModel.updateMany(
          { _id: { $in: applicationIds } },
          {
            status: data.status,
            $push: { statusHistory: { status: data.status, updatedBy: req.user.id, reason: data.reason || 'Bulk update' } },
          }
        );
        break;
      case 'assignHR':
        result = await ApplicationModel.updateMany(
          { _id: { $in: applicationIds } },
          { assignedHR: data.hrId, assignedAt: new Date() }
        );
        break;
      case 'delete':
        result = await ApplicationModel.deleteMany({ _id: { $in: applicationIds } });
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    return res.json({ success: true, message: `Bulk ${action} completed`, data: { modifiedCount: result.modifiedCount || result.deletedCount } });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Bulk update failed', error: error.message });
  }
};

export const addNoteToApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, isInternal = true } = req.body;

    const application = await ApplicationModel.findById(id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    application.notes.push({ content, createdBy: req.user.id, isInternal });
    await application.save();
    await application.populate('notes.createdBy', 'firstName lastName');

    return res.json({ success: true, message: 'Note added', data: application.notes[application.notes.length - 1] });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to add note', error: error.message });
  }
};

// ==================== INTERVIEWS MODULE ====================

export const getAllInterviews = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, status, jobId, candidateId, employerId,
      dateFrom, dateTo, type, sortBy = 'scheduledAt', sortOrder = 'asc',
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (jobId) filter.jobId = jobId;
    if (candidateId) filter.candidateId = candidateId;
    if (employerId) filter.employerId = employerId;
    if (type) filter.type = type;
    if (dateFrom || dateTo) {
      filter.scheduledAt = {};
      if (dateFrom) filter.scheduledAt.$gte = new Date(dateFrom);
      if (dateTo) filter.scheduledAt.$lte = new Date(dateTo);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const interviews = await InterviewModel.find(filter)
      .populate('candidateId', 'firstName lastName email phone profilePicture')
      .populate('jobId', 'title department location')
      .populate('employerId', 'firstName lastName companyName')
      .populate('applicationId', 'status resumeUrl')
      .populate('interviewers.userId', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await InterviewModel.countDocuments(filter);

    const statusCounts = await InterviewModel.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayCount = await InterviewModel.countDocuments({
      scheduledAt: { $gte: today, $lt: tomorrow },
      status: { $in: ['scheduled', 'rescheduled'] },
    });

    return res.json({
      success: true,
      data: {
        interviews,
        pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) },
        statusCounts: statusCounts.reduce((acc, item) => { acc[item._id] = item.count; return acc; }, {}),
        todayCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch interviews', error: error.message });
  }
};

export const createInterview = async (req, res) => {
  try {
    const data = req.body;
    const application = await ApplicationModel.findById(data.applicationId).populate('jobId').populate('studentId');
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    const interview = await InterviewModel.create({
      ...data,
      scheduledAt: new Date(data.scheduledAt),
      jobId: application.jobId._id,
      candidateId: application.studentId._id,
      employerId: application.employerId,
      title: `${application.jobId.title} - Round ${data.round || 1}`,
      createdBy: req.user.id,
      history: [{ action: 'scheduled', performedBy: req.user.id, timestamp: new Date() }],
    });

    if (application.status !== 'interview') {
      application.status = 'interview';
      application.statusHistory.push({ status: 'interview', updatedBy: req.user.id, reason: 'Interview scheduled' });
      await application.save();
    }

    const populatedInterview = await InterviewModel.findById(interview._id)
      .populate('candidateId', 'firstName lastName email phone')
      .populate('jobId', 'title department location')
      .populate('employerId', 'firstName lastName companyName');

    return res.status(201).json({ success: true, message: 'Interview scheduled', data: populatedInterview });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to schedule interview', error: error.message });
  }
};

export const rescheduleInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledAt, reason } = req.body;

    const interview = await InterviewModel.findById(id);
    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

    interview.reschedule(new Date(scheduledAt), reason, req.user.id);
    await interview.save();

    return res.json({ success: true, message: 'Interview rescheduled', data: interview });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to reschedule', error: error.message });
  }
};

export const cancelInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const interview = await InterviewModel.findById(id);
    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

    interview.cancel(reason, req.user.id);
    await interview.save();

    return res.json({ success: true, message: 'Interview cancelled', data: interview });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to cancel', error: error.message });
  }
};

export const completeInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const { evaluation, result } = req.body;

    const interview = await InterviewModel.findById(id);
    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

    interview.complete(evaluation, req.user.id);
    interview.result = result;
    await interview.save();

    const application = await ApplicationModel.findById(interview.applicationId);
    if (application) {
      if (result === 'failed') {
        application.status = 'rejected';
        application.rejectedAt = new Date();
        application.rejectedBy = req.user.id;
        application.rejectionReason = 'Failed interview';
      }
      application.statusHistory.push({ status: application.status, updatedBy: req.user.id, reason: `Interview ${result}` });
      await application.save();
    }

    return res.json({ success: true, message: 'Interview completed', data: interview });
  } catch (error) {
    return res.status(400).json({ success: false, message: 'Failed to complete interview', error: error.message });
  }
};

// ==================== REPORTS MODULE ====================

export const getATSDashboardStats = async (req, res) => {
  try {
    const { employerId, dateFrom, dateTo } = req.query;

    const dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) dateFilter.createdAt.$lte = new Date(dateTo);
    }

    const employerFilter = employerId ? { employerId } : {};
    const combinedFilter = { ...employerFilter, ...dateFilter };

    const applicationStats = await ApplicationModel.aggregate([
      { $match: combinedFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const interviewStats = await InterviewModel.aggregate([
      { $match: employerFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const applicationsOverTime = await ApplicationModel.aggregate([
      { $match: { ...employerFilter, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    const topJobs = await ApplicationModel.aggregate([
      { $match: combinedFilter },
      {
        $group: {
          _id: '$jobId',
          applications: { $sum: 1 },
          hired: { $sum: { $cond: [{ $eq: ['$status', 'hired'] }, 1, 0] } },
        },
      },
      { $sort: { applications: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'jobs', localField: '_id', foreignField: '_id', as: 'job' } },
      { $unwind: '$job' },
    ]);

    const totalApplications = await ApplicationModel.countDocuments(combinedFilter);
    const reviewed = await ApplicationModel.countDocuments({ ...combinedFilter, status: { $in: ['reviewed', 'shortlisted', 'interview', 'hired'] } });
    const shortlisted = await ApplicationModel.countDocuments({ ...combinedFilter, status: { $in: ['shortlisted', 'interview', 'hired'] } });
    const interviewed = await ApplicationModel.countDocuments({ ...combinedFilter, status: { $in: ['interview', 'hired'] } });
    const hired = await ApplicationModel.countDocuments({ ...combinedFilter, status: 'hired' });

    const hiredApps = await ApplicationModel.find({ ...combinedFilter, status: 'hired' }).select('createdAt updatedAt').lean();
    const avgTimeToHire = hiredApps.length > 0
      ? hiredApps.reduce((sum, app) => sum + (new Date(app.updatedAt) - new Date(app.createdAt)), 0) / hiredApps.length / (1000 * 60 * 60 * 24)
      : 0;

    const sourceBreakdown = await ApplicationModel.aggregate([
      { $match: combinedFilter },
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ]);

    return res.json({
      success: true,
      data: {
        overview: {
          totalApplications, reviewed, shortlisted, interviewed, hired,
          avgTimeToHire: Math.round(avgTimeToHire),
        },
        applicationStats: applicationStats.reduce((acc, item) => { acc[item._id] = item.count; return acc; }, {}),
        interviewStats: interviewStats.reduce((acc, item) => { acc[item._id] = item.count; return acc; }, {}),
        applicationsOverTime,
        topJobs: topJobs.map(j => ({
          jobId: j._id,
          title: j.job.title,
          applications: j.applications,
          hired: j.hired,
          conversionRate: ((j.hired / j.applications) * 100).toFixed(1),
        })),
        conversionFunnel: [
          { stage: 'Applied', count: totalApplications, percentage: 100 },
          { stage: 'Reviewed', count: reviewed, percentage: totalApplications > 0 ? ((reviewed / totalApplications) * 100).toFixed(1) : 0 },
          { stage: 'Shortlisted', count: shortlisted, percentage: totalApplications > 0 ? ((shortlisted / totalApplications) * 100).toFixed(1) : 0 },
          { stage: 'Interviewed', count: interviewed, percentage: totalApplications > 0 ? ((interviewed / totalApplications) * 100).toFixed(1) : 0 },
          { stage: 'Hired', count: hired, percentage: totalApplications > 0 ? ((hired / totalApplications) * 100).toFixed(1) : 0 },
        ],
        sourceBreakdown: sourceBreakdown.reduce((acc, item) => { acc[item._id || 'unknown'] = item.count; return acc; }, {}),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch stats', error: error.message });
  }
};

export const getHRPerformanceReport = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) dateFilter.createdAt.$lte = new Date(dateTo);
    }

    const hrPerformance = await ApplicationModel.aggregate([
      { $match: { ...dateFilter, assignedHR: { $ne: null } } },
      {
        $group: {
          _id: '$assignedHR',
          total: { $sum: 1 },
          hired: { $sum: { $cond: [{ $eq: ['$status', 'hired'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $in: ['$status', ['applied', 'reviewed', 'shortlisted']] }, 1, 0] } },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'hr' } },
      { $unwind: '$hr' },
      { $sort: { total: -1 } },
    ]);

    return res.json({ success: true, data: hrPerformance });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch HR performance', error: error.message });
  }
};

export const exportApplications = async (req, res) => {
  try {
    const { format = 'json', ...filters } = req.query;
    const applications = await ApplicationModel.find(filters)
      .populate('studentId', 'firstName lastName email phone')
      .populate('jobId', 'title department location')
      .populate('employerId', 'firstName lastName companyName')
      .lean();

    if (format === 'csv') {
      // Convert to CSV format
      const csv = [
        ['Candidate', 'Email', 'Job', 'Company', 'Status', 'Applied Date'].join(','),
        ...applications.map(app => [
          `${app.studentId.firstName} ${app.studentId.lastName}`,
          app.studentId.email,
          app.jobId.title,
          app.employerId.companyName || `${app.employerId.firstName} ${app.employerId.lastName}`,
          app.status,
          new Date(app.createdAt).toLocaleDateString(),
        ].join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=applications.csv');
      return res.send(csv);
    }

    return res.json({ success: true, data: applications });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Export failed', error: error.message });
  }
};
