import { z } from "zod";
import { JobModel } from "../models/Job.js";
import { ApplicationModel } from "../models/Application.js";
import { analyzeJobContent, shouldResetApprovalOnUpdate } from "../utils/moderation.js";

// Validation schemas
export const createJobSchema = z.object({
  title: z.string().min(2, "Job title must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  department: z.string().min(1, "Department is required"),
  location: z.string().min(1, "Location is required"),
  jobType: z.enum([
    "Full-time",
    "Part-time",
    "Contract",
    "Internship",
    "Freelance",
  ]),
  workMode: z.enum(["On-site", "Remote", "Hybrid"]),
  experience: z.string().min(1, "Experience is required"),
  education: z.string().min(1, "Education is required"),
  salary: z.string().min(1, "Salary is required"),
  vacancies: z.number().int().positive("Vacancies must be a positive number"),
  deadline: z.string().min(1, "Deadline is required"), // Keep as string
  skills: z.array(z.string()).min(1, "At least one skill is required"),
  responsibilities: z
    .string()
    .min(10, "Responsibilities must be at least 10 characters"),
  requirements: z.string().optional(),
  status: z.enum(["draft", "active"]).default("draft"),
});

export const updateJobSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().min(10).optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  jobType: z
    .enum(["Full-time", "Part-time", "Contract", "Internship", "Freelance"])
    .optional(),
  workMode: z.enum(["On-site", "Remote", "Hybrid"]).optional(),
  experience: z.string().optional(),
  education: z.string().optional(),
  salary: z.string().optional(),
  vacancies: z.number().int().positive().optional(),
  deadline: z.string().optional(), // Keep as string
  skills: z.array(z.string()).optional(),
  responsibilities: z.string().optional(),
  requirements: z.string().optional(),
  status: z.enum(["draft", "active", "paused", "closed"]).optional(),
});

// Create a new job
export const createJob = async (req, res, next) => {
  try {
    const parsed = createJobSchema.parse({
      ...req.body,
      vacancies: parseInt(req.body.vacancies),
      // Keep deadline as string, let MongoDB handle the date conversion
    });

    // Analyze content for moderation
    const moderationAnalysis = analyzeJobContent(parsed);
    const moderation = {
      approvalStatus: "pending",
      spamScore: moderationAnalysis.spamScore,
      flags: moderationAnalysis.flags,
      autoFlagged: moderationAnalysis.autoFlagged,
      lastAnalyzedAt: moderationAnalysis.lastAnalyzedAt,
    };

    // If employer tries to activate immediately without approval, force draft
    const initialStatus = parsed.status === "active" ? "draft" : parsed.status;

    const job = await JobModel.create({
      ...parsed,
      status: initialStatus,
      employerId: req.user.id,
      moderation,
    });

    res.status(201).json({
      success: true,
      message:
        parsed.status === "active"
          ? "Job saved as draft pending approval"
          : `Job ${parsed.status === "draft" ? "saved as draft" : "created"} successfully`,
      data: job,
    });
  } catch (err) {
    next(err);
  }
};

// Get all jobs (public)
export const getAllJobs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      location,
      jobType,
      workMode,
      minSalary,
      maxSalary,
    } = req.query;

    const filter = { status: "active", "moderation.approvalStatus": "approved" };

    if (search) {
      filter.$or = [
        { title: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
        { department: new RegExp(search, "i") },
        { skills: { $in: [new RegExp(search, "i")] } },
      ];
    }

    if (location) {
      filter.location = new RegExp(location, "i");
    }

    if (jobType) {
      filter.jobType = jobType;
    }

    if (workMode) {
      filter.workMode = workMode;
    }

    const jobs = await JobModel.find(filter)
      .populate({
        path: "employerId",
        select: "firstName lastName role email",
        populate: {
          path: "employerProfile",
          select: "company contact",
        },
      })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await JobModel.countDocuments(filter);

    res.json({
      success: true,
      data: jobs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalJobs: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get employer's jobs
export const getMyJobs = async (req, res, next) => {
  try {
    const { status } = req.query;
    const filter = { employerId: req.user.id };

    if (status) {
      filter.status = status;
    }

    const jobs = await JobModel.find(filter)
      .populate({
        path: "employerId",
        select: "firstName lastName role email",
        populate: {
          path: "employerProfile",
          select: "company contact",
        },
      })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: jobs,
    });
  } catch (err) {
    next(err);
  }
};

// Get single job by ID
export const getJobById = async (req, res, next) => {
  try {
    const job = await JobModel.findById(req.params.id)
      .populate({
        path: "employerId",
        select: "firstName lastName role email",
        populate: {
          path: "employerProfile",
          select: "company contact",
        },
      })
      .populate("applications");

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    res.json({
      success: true,
      data: job,
    });
  } catch (err) {
    next(err);
  }
};

// Update job
export const updateJob = async (req, res, next) => {
  try {
    const updateData = { ...req.body };

    // Convert string numbers to actual numbers
    if (updateData.vacancies) {
      updateData.vacancies = parseInt(updateData.vacancies);
    }
    if (updateData.deadline) {
      updateData.deadline = new Date(updateData.deadline);
    }

    const parsed = updateJobSchema.parse(updateData);

    // Determine if we need to reset approval and re-analyze
    const shouldReanalyze = shouldResetApprovalOnUpdate(parsed);
    let updatePayload = { $set: parsed };

    if (shouldReanalyze) {
      const moderationAnalysis = analyzeJobContent({ ...parsed });
      updatePayload = {
        ...updatePayload,
        $set: {
          ...parsed,
          "moderation.approvalStatus": "pending",
          "moderation.reviewerId": undefined,
          "moderation.reviewedAt": undefined,
          "moderation.rejectionReason": undefined,
          "moderation.requestChangesNote": undefined,
          "moderation.spamScore": moderationAnalysis.spamScore,
          "moderation.flags": moderationAnalysis.flags,
          "moderation.autoFlagged": moderationAnalysis.autoFlagged,
          "moderation.lastAnalyzedAt": moderationAnalysis.lastAnalyzedAt,
        },
      };
    }

    const job = await JobModel.findOneAndUpdate(
      { _id: req.params.id, employerId: req.user.id },
      updatePayload,
      { new: true, runValidators: true }
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found or you are not authorized to update this job",
      });
    }

    res.json({
      success: true,
      data: job,
      message: shouldReanalyze
        ? "Job updated and sent for moderation"
        : "Job updated successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Delete job
export const deleteJob = async (req, res, next) => {
  try {
    const job = await JobModel.findOneAndDelete({
      _id: req.params.id,
      employerId: req.user.id,
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found or you are not authorized to delete this job",
      });
    }

    res.json({
      success: true,
      message: "Job deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Get job applications for a specific job
export const getJobApplications = async (req, res, next) => {
  try {
    const job = await JobModel.findOne({
      _id: req.params.id,
      employerId: req.user.id,
    });

    if (!job) {
      return res.status(404).json({
        success: false,
        message:
          "Job not found or you are not authorized to view applications for this job",
      });
    }

    const applications = await ApplicationModel.find({ jobId: req.params.id })
      .populate("studentId", "firstName lastName email profile")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: applications,
    });
  } catch (err) {
    next(err);
  }
};

// Change job status
export const changeJobStatusSchema = z.object({
  status: z.enum(["draft", "active", "paused", "closed"]),
});

export const changeJobStatus = async (req, res, next) => {
  try {
    const parsed = changeJobStatusSchema.parse(req.body);
    // Prevent activation without approval
    if (parsed.status === "active") {
      const existing = await JobModel.findOne({
        _id: req.params.id,
        employerId: req.user.id,
      }).select("moderation");
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: "Job not found or you are not authorized to update this job",
        });
      }
      if (existing?.moderation?.approvalStatus !== "approved") {
        return res.status(400).json({
          success: false,
          message: "Job must be approved by admin before activation",
        });
      }
    }

    const job = await JobModel.findOneAndUpdate(
      { _id: req.params.id, employerId: req.user.id },
      { $set: { status: parsed.status } },
      { new: true, runValidators: true }
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found or you are not authorized to update this job",
      });
    }

    res.json({ success: true, data: job, message: "Status updated" });
  } catch (err) {
    next(err);
  }
};
