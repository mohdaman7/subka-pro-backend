import { z } from "zod";
import { ApplicationModel } from "../models/Application.js";
import { ActivityModel } from "../models/Activity.js";
import { JobModel } from "../models/Job.js";
import mongoose from "mongoose";

// Validation schemas
export const applySchema = z.object({
  jobId: z.string().min(1),
  resumeUrl: z.string().url().optional(),
  // New optional structured fields from the UI redesign
  previousCompany: z.string().max(200).optional(),
  previousPosition: z.string().max(200).optional(),
  yearsExperience: z.union([z.string(), z.number()]).optional(),
  languages: z.string().max(500).optional(),
});

export const updateApplicationStatusSchema = z.object({
  status: z.enum(["applied", "reviewed", "interview", "rejected", "hired"]),
  feedback: z.string().max(1000).optional(),
});

// Interview schemas
const interviewPanelMemberSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.string().optional(),
});

const scheduleInterviewSchema = z.object({
  scheduledAt: z.coerce.date(),
  timezone: z.string().min(1),
  durationMinutes: z.number().int().positive().max(8 * 60),
  type: z.enum(["video", "phone", "onsite"]),
  meetingLink: z.string().url().optional(),
  location: z.string().optional(),
  panel: z.array(interviewPanelMemberSchema).default([]),
  notes: z.string().max(1000).optional(),
});

const rescheduleInterviewSchema = scheduleInterviewSchema.extend({
  reason: z.string().max(500).optional(),
});

const interviewFeedbackSchema = z.object({
  feedback: z.string().min(1).max(2000),
});

// Apply for a job
export const applyForJob = async (req, res, next) => {
  try {
    const parsed = applySchema.parse(req.body);
    const job = await JobModel.findById(parsed.jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Check if job is still active
    if (job.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "This job is no longer accepting applications",
      });
    }

    // Check if already applied
    const existingApplication = await ApplicationModel.findOne({
      jobId: job._id,
      studentId: req.user.id,
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: "You have already applied for this job",
      });
    }

    const application = await ApplicationModel.create({
      jobId: job._id,
      studentId: req.user.id,
      employerId: job.employerId,
      resumeUrl: parsed.resumeUrl,
      // Persist extra metadata if provided
      meta: {
        ...(parsed.previousCompany && {
          previousCompany: parsed.previousCompany,
        }),
        ...(parsed.previousPosition && {
          previousPosition: parsed.previousPosition,
        }),
        ...(parsed.yearsExperience && {
          yearsExperience: parsed.yearsExperience,
        }),
        ...(parsed.languages && { languages: parsed.languages }),
      },
      status: "applied",
    });

    // Populate the application with job and employer company details
    await application.populate({
      path: "jobId",
      select: "title location salary jobType requirements",
      populate: {
        path: "employerId",
        select: "firstName lastName email role",
        populate: { path: "employerProfile", select: "company" },
      },
    });

    res.status(201).json({
      success: true,
      data: application,
      message: "Application submitted successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Get student's applications
export const getMyApplications = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = "appliedAt",
      sortOrder = "desc",
    } = req.query;

    const filter = { studentId: req.user.id };

    if (status) {
      filter.status = status;
    }

    const sortOptions = {};
    const sortField = ["createdAt", "updatedAt", "status"].includes(sortBy)
      ? sortBy
      : "createdAt";
    sortOptions[sortField] = sortOrder === "desc" ? -1 : 1;

    const applications = await ApplicationModel.find(filter)
      .populate({
        path: "jobId",
        select: "title location salary jobType requirements",
        populate: {
          path: "employerId",
          select: "firstName lastName email role",
          populate: { path: "employerProfile", select: "company" },
        },
      })
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ApplicationModel.countDocuments(filter);

    // Calculate application statistics
    const stats = await ApplicationModel.aggregate([
      { $match: { studentId: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusStats = {};
    stats.forEach((stat) => {
      statusStats[stat._id] = stat.count;
    });

    res.json({
      success: true,
      data: applications,
      stats: statusStats,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalApplications: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get applications for employer's jobs
export const getApplicationsForMyJobs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      jobId,
      sortBy = "appliedAt",
      sortOrder = "desc",
    } = req.query;

    const filter = { employerId: req.user.id };

    if (status) {
      filter.status = status;
    }

    if (jobId) {
      filter.jobId = jobId;
    }

    const sortOptions = {};
    const sortField = ["createdAt", "updatedAt", "status"].includes(sortBy)
      ? sortBy
      : "createdAt";
    sortOptions[sortField] = sortOrder === "desc" ? -1 : 1;

    // Updated populate to match the actual schema structure
    const applications = await ApplicationModel.find(filter)
      .populate({
        path: "studentId",
        select:
          "firstName lastName email phone experience skills address bio education languages previousCompany previousPosition yearsExperience",
      })
      .populate("jobId", "title location salary deadlineDate")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await ApplicationModel.countDocuments(filter);

    // Get application statistics for employer
    const statsMatch = {
      employerId: new mongoose.Types.ObjectId(req.user.id),
      // Note: we intentionally do not include the `status` filter here so that
      // we always compute counts across all statuses for the breakdown.
    };
    if (jobId) {
      try {
        statsMatch.jobId = new mongoose.Types.ObjectId(jobId);
      } catch (e) {
        // ignore invalid jobId for stats; fallback to employer-only
      }
    }

    const stats = await ApplicationModel.aggregate([
      { $match: statsMatch },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusStats = {};
    stats.forEach((stat) => {
      statusStats[stat._id] = stat.count;
    });

    // Get unique job list for filter
    const filterOptions = {
      jobs: await JobModel.find({ employerId: req.user.id })
        .select("title _id deadlineDate")
        .sort({ title: 1 }),
    };

    const pagination = {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalApplications: total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    return res.json({
      success: true,
      data: applications,
      stats: statusStats,
      filterOptions,
      pagination,
    });
  } catch (err) {
    next(err);
  }
};

// Update application status
export const updateApplicationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = updateApplicationStatusSchema.parse(req.body);

    const application = await ApplicationModel.findOneAndUpdate(
      { _id: id, employerId: req.user.id },
      {
        status: parsed.status,
        ...(parsed.feedback && { feedback: parsed.feedback }),
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    )
      .populate("jobId", "title")
      .populate("studentId", "firstName lastName email");

    if (!application) {
      return res.status(404).json({
        success: false,
        message:
          "Application not found or you are not authorized to update this application",
      });
    }

    // Record activity
    try {
      await ActivityModel.create({
        employerId: req.user.id,
        actorId: req.user.id,
        type: "application_status_changed",
        target: { kind: "application", id: application._id, label: application?.jobId?.title },
        meta: { status: parsed.status, feedback: parsed.feedback },
      });
    } catch {}

    res.json({
      success: true,
      data: application,
      message: `Application status updated to ${parsed.status}`,
    });
  } catch (err) {
    next(err);
  }
};

// Schedule an interview (employer)
export const scheduleInterview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = scheduleInterviewSchema.parse(req.body);

    const application = await ApplicationModel.findOneAndUpdate(
      { _id: id, employerId: req.user.id },
      {
        interview: {
          scheduledAt: parsed.scheduledAt,
          timezone: parsed.timezone,
          durationMinutes: parsed.durationMinutes,
          type: parsed.type,
          meetingLink: parsed.meetingLink,
          location: parsed.location,
          panel: parsed.panel,
          notes: parsed.notes,
          status: "scheduled",
          history: [
            {
              scheduledAt: parsed.scheduledAt,
              reason: "initial schedule",
            },
          ],
        },
        status: "interview",
        updatedAt: new Date(),
      },
      { new: true }
    )
      .populate("jobId", "title")
      .populate("studentId", "firstName lastName email");

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found or not authorized",
      });
    }

    res.json({
      success: true,
      data: application,
      message: "Interview scheduled",
    });

    try {
      await ActivityModel.create({
        employerId: req.user.id,
        actorId: req.user.id,
        type: "interview_scheduled",
        target: { kind: "application", id: application._id, label: application?.jobId?.title },
        meta: { scheduledAt: parsed.scheduledAt, type: parsed.type },
      });
    } catch {}
  } catch (err) {
    next(err);
  }
};

// Reschedule interview (employer)
export const rescheduleInterview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = rescheduleInterviewSchema.parse(req.body);

    const application = await ApplicationModel.findOne({
      _id: id,
      employerId: req.user.id,
      "interview.status": { $in: ["scheduled", "rescheduled"] },
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Interview not found or cannot be rescheduled",
      });
    }

    application.interview = {
      ...application.interview,
      scheduledAt: parsed.scheduledAt,
      timezone: parsed.timezone,
      durationMinutes: parsed.durationMinutes,
      type: parsed.type,
      meetingLink: parsed.meetingLink,
      location: parsed.location,
      panel: parsed.panel,
      notes: parsed.notes,
      status: "rescheduled",
      history: [
        ...(application.interview?.history || []),
        { scheduledAt: parsed.scheduledAt, reason: parsed.reason },
      ],
    };

    application.updatedAt = new Date();

    await application.save();

    await application.populate("jobId", "title");
    await application.populate("studentId", "firstName lastName email");

    res.json({ success: true, data: application, message: "Interview rescheduled" });

    try {
      await ActivityModel.create({
        employerId: req.user.id,
        actorId: req.user.id,
        type: "interview_rescheduled",
        target: { kind: "application", id: application._id, label: application?.jobId?.title },
        meta: { scheduledAt: parsed.scheduledAt, reason: parsed.reason },
      });
    } catch {}
  } catch (err) {
    next(err);
  }
};

// Cancel interview (employer)
export const cancelInterview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const application = await ApplicationModel.findOneAndUpdate(
      { _id: id, employerId: req.user.id },
      {
        $set: {
          "interview.status": "cancelled",
        },
        $push: {
          "interview.history": { scheduledAt: new Date(), reason: reason || "cancelled" },
        },
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ success: false, message: "Interview not found" });
    }

    res.json({ success: true, data: application, message: "Interview cancelled" });

    try {
      await ActivityModel.create({
        employerId: req.user.id,
        actorId: req.user.id,
        type: "interview_cancelled",
        target: { kind: "application", id: application._id, label: undefined },
        meta: { reason },
      });
    } catch {}
  } catch (err) {
    next(err);
  }
};

// Complete interview and attach feedback (employer)
export const completeInterview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = interviewFeedbackSchema.parse(req.body);

    const application = await ApplicationModel.findOneAndUpdate(
      { _id: id, employerId: req.user.id },
      {
        $set: {
          "interview.status": "completed",
          "interview.feedback": parsed.feedback,
        },
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ success: false, message: "Interview not found" });
    }

    res.json({ success: true, data: application, message: "Interview marked as completed" });
  } catch (err) {
    next(err);
  }
};

// Get single application details
export const getApplicationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let filter = { _id: id };

    // Students can only see their own applications
    // Employers can only see applications for their jobs
    if (req.user.role === "student") {
      filter.studentId = req.user.id;
    } else if (req.user.role === "employer") {
      filter.employerId = req.user.id;
    }

    const application = await ApplicationModel.findOne(filter)
      .populate({
        path: "jobId",
        select:
          "title description location salaryMin salaryMax jobType requirements benefits",
        populate: {
          path: "employerId",
          select: "firstName lastName email role",
          populate: { path: "employerProfile", select: "company" },
        },
      })
      .populate(
        "studentId",
        "firstName lastName email profile skills education workExperience"
      )
      .populate({
        path: "employerId",
        select: "firstName lastName email role",
        populate: { path: "employerProfile", select: "company" },
      });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    res.json({ success: true, data: application });
  } catch (err) {
    next(err);
  }
};

// Withdraw application (student only)
export const withdrawApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    const application = await ApplicationModel.findOneAndUpdate(
      {
        _id: id,
        studentId: req.user.id,
        status: { $in: ["applied", "reviewed"] }, // Can only withdraw from certain statuses
      },
      {
        status: "withdrawn",
        withdrawnAt: new Date(),
      },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found or cannot be withdrawn at this stage",
      });
    }

    res.json({
      success: true,
      message: "Application withdrawn successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Get application statistics for dashboard
export const getApplicationStats = async (req, res, next) => {
  try {
    let matchFilter = {};

    if (req.user.role === "student") {
      matchFilter.studentId = new mongoose.Types.ObjectId(req.user.id);
    } else if (req.user.role === "employer") {
      matchFilter.employerId = new mongoose.Types.ObjectId(req.user.id);
    }

    const stats = await ApplicationModel.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totalApplications = await ApplicationModel.countDocuments(
      matchFilter
    );

    // Convert stats array to object
    const statusStats = {
      total: totalApplications,
    };

    stats.forEach((stat) => {
      statusStats[stat._id] = stat.count;
    });

    // Get recent activity
    const recentApplications = await ApplicationModel.find(matchFilter)
      .populate("jobId", "title")
      .populate("studentId", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      data: {
        stats: statusStats,
        recentActivity: recentApplications,
      },
    });
  } catch (err) {
    next(err);
  }
};
