// backend/src/controllers/crmController.js
import bcrypt from "bcryptjs";
import { z } from "zod";
import { UserModel } from "../models/User.js";
import { StudentModel } from "../models/Student.js";
import { EmployerModel } from "../models/Employer.js";
import { ApplicationModel } from "../models/Application.js";
import { JobModel } from "../models/Job.js";
import { CompanyModel } from "../models/Company.js";
import { SupportTicketModel } from "../models/SupportTicket.js";
import { sendApprovalEmail, sendJobModerationEmail } from "../utils/mailer.js";
import { analyzeJobContent } from "../utils/moderation.js";

// Generate random password
function generatePassword() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// ============================================
// NEW FUNCTIONS FOR APPROVAL SYSTEM
// ============================================

// Get all pending registrations
export const getPendingRegistrations = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const pendingUsers = await UserModel.find({ status: "pending" })
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get additional profile info
    const usersWithProfiles = await Promise.all(
      pendingUsers.map(async (user) => {
        let profileData = null;
        if (user.role === "student") {
          profileData = await StudentModel.findOne({ userId: user._id });
        } else if (user.role === "employer") {
          profileData = await EmployerModel.findOne({ userId: user._id });
        }
        return {
          ...user.toObject(),
          profile: profileData,
        };
      })
    );

    const total = await UserModel.countDocuments({ status: "pending" });

    res.json({
      success: true,
      data: usersWithProfiles,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalPending: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Approve user registration
export const approveUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sendCredentials = true } = req.body;

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "User is not in pending status",
      });
    }

    // Generate new password
    const newPassword = generatePassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update user status and password
    user.status = "active";
    user.passwordHash = passwordHash;
    await user.save();

    // Send approval email with credentials
    if (sendCredentials) {
      try {
        await sendApprovalEmail(user, newPassword);
      } catch (emailError) {
        console.error("Failed to send approval email:", emailError);
        // Continue even if email fails
      }
    }

    res.json({
      success: true,
      message: "User approved successfully",
      data: {
        id: user._id,
        email: user.email,
        status: user.status,
        credentials: sendCredentials
          ? {
              username: user.email,
              password: newPassword,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Reject user registration
export const rejectUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "User is not in pending status",
      });
    }

    user.status = "rejected";
    user.rejectionReason = reason || "Application did not meet requirements";
    await user.save();

    // TODO: Send rejection email (optional)
    // await sendRejectionEmail(user, reason);

    res.json({
      success: true,
      message: "User rejected successfully",
      data: {
        id: user._id,
        email: user.email,
        status: user.status,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get users by status
export const getUsersByStatus = async (req, res, next) => {
  try {
    const { status } = req.params;
    const { page = 1, limit = 20, role, search } = req.query;

    const filter = { status };
    
    if (role) {
      filter.role = role;
    }

    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
      ];
    }

    const users = await UserModel.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await UserModel.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        total: count,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Reactivate user
export const reactivateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.status = "active";
    user.rejectionReason = undefined;
    await user.save();

    res.json({
      success: true,
      message: "User reactivated successfully",
      data: { id: user._id, status: user.status },
    });
  } catch (err) {
    next(err);
  }
};

// Deactivate user
export const deactivateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.status = "inactive";
    user.deactivationReason = reason;
    await user.save();

    res.json({
      success: true,
      message: "User deactivated successfully",
      data: { id: user._id, status: user.status },
    });
  } catch (err) {
    next(err);
  }
};

// Upgrade user plan
export const upgradePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { planType = "pro", duration, paymentDetails } = req.body;

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.planType = planType;
    user.planUpgradedAt = new Date();
    if (duration) {
      user.planExpiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    }
    await user.save();

    res.json({
      success: true,
      message: "User plan upgraded successfully",
      data: {
        id: user._id,
        planType: user.planType,
        planUpgradedAt: user.planUpgradedAt,
        planExpiresAt: user.planExpiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Downgrade user plan
export const downgradePlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await UserModel.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.planType = "free";
    user.planDowngradedAt = new Date();
    user.planDowngradeReason = reason;
    await user.save();

    res.json({
      success: true,
      message: "User plan downgraded successfully",
      data: { id: user._id, planType: user.planType },
    });
  } catch (err) {
    next(err);
  }
};

// Get user profile
export const getUserProfile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await UserModel.findById(id)
      .select("-passwordHash")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// Bulk approve users
export const bulkApproveUsers = async (req, res, next) => {
  try {
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of user IDs",
      });
    }

    const results = [];
    for (const userId of userIds) {
      try {
        const user = await UserModel.findById(userId);
        if (user && user.status === "pending") {
          const newPassword = generatePassword();
          const passwordHash = await bcrypt.hash(newPassword, 10);
          user.status = "active";
          user.passwordHash = passwordHash;
          await user.save();
          results.push({ id: userId, success: true });
        } else {
          results.push({ id: userId, success: false, reason: "Not pending" });
        }
      } catch (error) {
        results.push({ id: userId, success: false, reason: error.message });
      }
    }

    res.json({
      success: true,
      message: "Bulk approval completed",
      data: results,
    });
  } catch (err) {
    next(err);
  }
};

// Bulk reject users
export const bulkRejectUsers = async (req, res, next) => {
  try {
    const { userIds, reason } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of user IDs",
      });
    }

    const result = await UserModel.updateMany(
      { _id: { $in: userIds }, status: "pending" },
      { 
        $set: { 
          status: "rejected",
          rejectionReason: reason || "Application did not meet requirements"
        }
      }
    );

    res.json({
      success: true,
      message: "Bulk rejection completed",
      data: {
        modified: result.modifiedCount,
        total: userIds.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get user statistics
export const getUserStats = async (req, res, next) => {
  try {
    const stats = await UserModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const roleStats = await UserModel.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    const planStats = await UserModel.aggregate([
      {
        $group: {
          _id: "$planType",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        byStatus: stats,
        byRole: roleStats,
        byPlan: planStats,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Search users
export const searchUsers = async (req, res, next) => {
  try {
    const { q, role, status, planType, page = 1, limit = 20 } = req.query;

    const filter = {};
    
    if (q) {
      filter.$or = [
        { firstName: new RegExp(q, "i") },
        { lastName: new RegExp(q, "i") },
        { email: new RegExp(q, "i") },
      ];
    }

    if (role) filter.role = role;
    if (status) filter.status = status;
    if (planType) filter.planType = planType;

    const users = await UserModel.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await UserModel.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        totalPages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        total: count,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ============================================
// EXISTING FUNCTIONS (UPDATED)
// ============================================

// Get all users (for admin)
export const getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, role, search, status } = req.query;

    const filter = {};

    if (role) {
      filter.role = role;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
      ];
    }

    const users = await UserModel.find(filter)
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await UserModel.countDocuments(filter);

    res.json({
      success: true,
      data: users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalUsers: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get candidates (students) with filters joined with student profile
export const getCandidates = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, search, status, plan } = req.query;

    const match = { role: "student" };
    if (status) match.status = status;
    if (search) {
      match.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
      ];
    }

    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      // Join with student profile
      {
        $lookup: {
          from: "students",
          localField: "_id",
          foreignField: "userId",
          as: "profile",
        },
      },
      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },
      // Join with applications to get total applied jobs count
      {
        $lookup: {
          from: "applications",
          localField: "_id",
          foreignField: "studentId",
          as: "applications",
        },
      },
      // Add computed field for total applications
      {
        $addFields: {
          totalApplications: { $size: "$applications" },
        },
      },
    ];

    if (plan && ["free", "pro"].includes(plan)) {
      pipeline.push({ $match: { "profile.plan": plan } });
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);
    const paginatedPipeline = [
      ...pipeline,
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: Number(limit) }],
          count: [{ $count: "total" }],
        },
      },
      { $unwind: { path: "$count", preserveNullAndEmptyArrays: true } },
      { $project: { data: 1, total: "$count.total" } },
    ];

    const [result] = await UserModel.aggregate(paginatedPipeline);
    const data = (result?.data || []).map((doc) => ({
      _id: doc._id,
      firstName: doc.firstName,
      lastName: doc.lastName,
      email: doc.email,
      status: doc.status,
      plan: doc.profile?.plan || "free",
      profileCompletion: doc.profile?.profileCompletion || 0,
      city: doc.profile?.address?.city || "",
      hasResume: Boolean(doc.profile?.resume?.url),
      createdAt: doc.createdAt,
      // NEW: Added skills from profile
      skills: doc.profile?.skills || [],
      // NEW: Added total applied jobs count
      appliedJobs: doc.totalApplications || 0,
    }));
    const total = result?.total || 0;

    res.json({
      success: true,
      data,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalCandidates: total,
        hasNext: Number(page) < Math.ceil(total / Number(limit)),
        hasPrev: Number(page) > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get user by ID with details
export const getUserById = async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.params.id).select(
      "-passwordHash"
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let additionalData = {};

    if (user.role === "student") {
      const studentProfile = await StudentModel.findOne({ userId: user._id });
      const applications = await ApplicationModel.find({ studentId: user._id })
        .populate("jobId", "title employerId")
        .populate({
          path: "jobId",
          populate: { path: "employerId", select: "company.name" },
        });

      additionalData.profile = studentProfile;
      additionalData.applications = applications;
    } else if (user.role === "employer") {
      const employerProfile = await EmployerModel.findOne({ userId: user._id });
      const jobs = await JobModel.find({ employerId: user._id });
      const jobApplications = await ApplicationModel.find({
        jobId: { $in: jobs.map((job) => job._id) },
      });

      additionalData.profile = employerProfile;
      additionalData.jobs = jobs;
      additionalData.totalApplications = jobApplications.length;
    }

    res.json({
      success: true,
      data: {
        user,
        ...additionalData,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Update user status (ban/unban, activate/deactivate)
export const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    // Updated to include new status options
    if (
      !["active", "inactive", "suspended", "pending", "rejected"].includes(
        status
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status. Must be active, inactive, suspended, pending, or rejected",
      });
    }

    const user = await UserModel.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select("-passwordHash");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
      message: `User status updated to ${status} successfully`,
    });
  } catch (err) {
    next(err);
  }
};

// Get platform statistics (UPDATED with pending count)
export const getPlatformStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalStudents,
      totalEmployers,
      pendingApprovals,
      totalJobs,
      totalApplications,
      activeJobs,
      recentRegistrations,
      openSupportTickets,
    ] = await Promise.all([
      UserModel.countDocuments({ status: { $ne: "rejected" } }),
      UserModel.countDocuments({ role: "student", status: "active" }),
      UserModel.countDocuments({ role: "employer", status: "active" }),
      UserModel.countDocuments({ status: "pending" }),
      JobModel.countDocuments(),
      ApplicationModel.countDocuments(),
      JobModel.countDocuments({ status: "active" }),
      UserModel.find().sort({ createdAt: -1 }).limit(5).select("-passwordHash"),
      SupportTicketModel.countDocuments({
        status: { $in: ["open", "in_progress"] },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totals: {
          users: totalUsers,
          students: totalStudents,
          employers: totalEmployers,
          pendingApprovals, // NEW: Added pending count
          jobs: totalJobs,
          applications: totalApplications,
          activeJobs,
          supportOpen: openSupportTickets,
        },
        recentRegistrations,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get all jobs (admin view)
export const getAllJobsAdmin = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, employer } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (employer) {
      filter.employerId = employer;
    }

    const jobs = await JobModel.find(filter)
      .populate("employerId", "firstName lastName email")
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

// Get all applications (admin view)
export const getAllApplications = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, jobId, studentId } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (jobId) {
      filter.jobId = jobId;
    }

    if (studentId) {
      filter.studentId = studentId;
    }

    const applications = await ApplicationModel.find(filter)
      .populate("studentId", "firstName lastName email")
      .populate({
        path: "jobId",
        populate: { path: "employerId", select: "firstName lastName company" },
      })
      .sort({ appliedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ApplicationModel.countDocuments(filter);

    res.json({
      success: true,
      data: applications,
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

// ============================================
// Company Management (Admin)
// ============================================
export const createCompany = async (req, res, next) => {
  try {
    const payload = req.body || {};
    if (!payload.name) {
      return res
        .status(400)
        .json({ success: false, message: "Company name is required" });
    }
    const company = await CompanyModel.create(payload);
    res
      .status(201)
      .json({ success: true, data: company, message: "Company created" });
  } catch (err) {
    next(err);
  }
};

export const listCompanies = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, industry } = req.query;
    const filter = {};
    if (search) filter.name = new RegExp(search, "i");
    if (industry) filter.industry = new RegExp(industry, "i");

    const companies = await CompanyModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    const total = await CompanyModel.countDocuments(filter);
    res.json({
      success: true,
      data: companies,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalCompanies: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getCompanyById = async (req, res, next) => {
  try {
    const company = await CompanyModel.findById(req.params.id);
    if (!company) {
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });
    }
    res.json({ success: true, data: company });
  } catch (err) {
    next(err);
  }
};

export const updateCompany = async (req, res, next) => {
  try {
    const company = await CompanyModel.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!company) {
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });
    }
    res.json({ success: true, data: company, message: "Company updated" });
  } catch (err) {
    next(err);
  }
};

export const deleteCompany = async (req, res, next) => {
  try {
    const company = await CompanyModel.findByIdAndDelete(req.params.id);
    if (!company) {
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });
    }
    res.json({ success: true, message: "Company deleted" });
  } catch (err) {
    next(err);
  }
};

// ============================================
// Employer Admin Actions
// ============================================

export const updateEmployerVerification = async (req, res, next) => {
  try {
    const { id } = req.params; // user id
    const parseBody = z.object({ isVerified: z.boolean() }).safeParse(req.body);
    if (!parseBody.success) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payload" });
    }

    const employer = await EmployerModel.findOneAndUpdate(
      { userId: id },
      { $set: { isVerified: parseBody.data.isVerified } },
      { new: true }
    );

    if (!employer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer profile not found" });
    }

    res.json({
      success: true,
      data: employer,
      message: `Employer marked as ${
        parseBody.data.isVerified ? "verified" : "unverified"
      }`,
    });
  } catch (err) {
    next(err);
  }
};

export const updateEmployerPlanAdmin = async (req, res, next) => {
  try {
    const { id } = req.params; // user id
    const parseBody = z
      .object({ plan: z.enum(["free", "pro"]) })
      .safeParse(req.body);
    if (!parseBody.success) {
      return res.status(400).json({ success: false, message: "Invalid plan" });
    }

    const employer = await EmployerModel.findOneAndUpdate(
      { userId: id },
      { $set: { plan: parseBody.data.plan } },
      { new: true }
    );

    if (!employer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer profile not found" });
    }

    res.json({
      success: true,
      data: employer,
      message: "Employer plan updated",
    });
  } catch (err) {
    next(err);
  }
};

export const updateEmployerDocumentStatus = async (req, res, next) => {
  try {
    const { id, docId } = req.params; // user id, document id
    const parseBody = z
      .object({
        status: z.enum(["uploaded", "verified", "rejected", "needs_reupload"]),
        reviewNotes: z.string().max(1000).optional(),
        rejectionReason: z.string().max(500).optional(),
      })
      .safeParse(req.body);
    if (!parseBody.success) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid payload" });
    }

    const employer = await EmployerModel.findOne({ userId: id });
    if (!employer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer profile not found" });
    }

    const document = employer.verificationDocuments.id(docId);
    if (!document) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    document.status = parseBody.data.status;
    if (parseBody.data.reviewNotes !== undefined) {
      document.reviewNotes = parseBody.data.reviewNotes;
    }
    if (parseBody.data.rejectionReason !== undefined) {
      document.rejectionReason = parseBody.data.rejectionReason;
    }
    document.reviewedAt = new Date();
    try {
      // If authentication middleware provides user, record reviewer
      // @ts-ignore
      if (req.user?.id) document.reviewedBy = req.user.id;
    } catch {}

    await employer.save();

    res.json({
      success: true,
      data: document,
      message: "Document status updated",
    });
  } catch (err) {
    next(err);
  }
};

export const changeJobStatusAdmin = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const parseBody = z
      .object({ status: z.enum(["draft", "active", "paused", "closed"]) })
      .safeParse(req.body);
    if (!parseBody.success) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    const job = await JobModel.findByIdAndUpdate(
      jobId,
      { $set: { status: parseBody.data.status } },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    res.json({ success: true, data: job, message: "Job status updated" });
  } catch (err) {
    next(err);
  }
};

// ============================================
// Job Moderation (Admin)
// ============================================

export const approveJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await JobModel.findByIdAndUpdate(
      jobId,
      {
        $set: {
          "moderation.approvalStatus": "approved",
          "moderation.reviewerId": req.user?.id || undefined,
          "moderation.reviewedAt": new Date(),
          "moderation.rejectionReason": undefined,
          "moderation.requestChangesNote": undefined,
        },
      },
      { new: true }
    ).populate("employerId", "email");

    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    try {
      if (job?.employerId?.email) {
        await sendJobModerationEmail({
          to: job.employerId.email,
          jobTitle: job.title,
          action: "approved",
        });
      }
    } catch {}
    return res.json({ success: true, data: job, message: "Job approved" });
  } catch (err) {
    next(err);
  }
};

export const rejectJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const parseBody = z
      .object({ reason: z.string().min(3).max(1000) })
      .safeParse(req.body);
    if (!parseBody.success) {
      return res.status(400).json({ success: false, message: "Reason is required" });
    }

    const job = await JobModel.findByIdAndUpdate(
      jobId,
      {
        $set: {
          "moderation.approvalStatus": "rejected",
          "moderation.reviewerId": req.user?.id || undefined,
          "moderation.reviewedAt": new Date(),
          "moderation.rejectionReason": parseBody.data.reason,
        },
      },
      { new: true }
    ).populate("employerId", "email");

    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    try {
      if (job?.employerId?.email) {
        await sendJobModerationEmail({
          to: job.employerId.email,
          jobTitle: job.title,
          action: "rejected",
          reasonOrNote: parseBody.data.reason,
        });
      }
    } catch {}
    return res.json({ success: true, data: job, message: "Job rejected" });
  } catch (err) {
    next(err);
  }
};

export const requestJobChanges = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const parseBody = z
      .object({ note: z.string().min(3).max(1000) })
      .safeParse(req.body);
    if (!parseBody.success) {
      return res.status(400).json({ success: false, message: "Note is required" });
    }

    const job = await JobModel.findByIdAndUpdate(
      jobId,
      {
        $set: {
          "moderation.approvalStatus": "needs_changes",
          "moderation.reviewerId": req.user?.id || undefined,
          "moderation.reviewedAt": new Date(),
          "moderation.requestChangesNote": parseBody.data.note,
        },
      },
      { new: true }
    ).populate("employerId", "email");

    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    try {
      if (job?.employerId?.email) {
        await sendJobModerationEmail({
          to: job.employerId.email,
          jobTitle: job.title,
          action: "needs_changes",
          reasonOrNote: parseBody.data.note,
        });
      }
    } catch {}
    return res.json({ success: true, data: job, message: "Change request recorded" });
  } catch (err) {
    next(err);
  }
};

export const reanalyzeJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await JobModel.findById(jobId);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    const analysis = analyzeJobContent(job.toObject());
    job.moderation = {
      ...(job.moderation || {}),
      spamScore: analysis.spamScore,
      flags: analysis.flags,
      autoFlagged: analysis.autoFlagged,
      lastAnalyzedAt: analysis.lastAnalyzedAt,
    };
    await job.save();

    return res.json({ success: true, data: job, message: "Job reanalyzed" });
  } catch (err) {
    next(err);
  }
};
