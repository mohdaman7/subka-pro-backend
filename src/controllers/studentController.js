import { z } from "zod";
import { StudentModel } from "../models/Student.js";
import { SupportTicketModel } from "../models/SupportTicket.js";
import { UserModel } from "../models/User.js";
import { ApplicationModel } from "../models/Application.js";
import mongoose from "mongoose";

const updateStudentSchema = z.object({
  // Allow plan change (free/pro)
  plan: z.enum(["free", "pro"]).optional(),
  phone: z.string().optional(),
  phoneVerified: z.boolean().optional(),
  dateOfBirth: z.string().optional(),
  experienceType: z.enum(["fresher", "experienced"]).optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      zipCode: z.string().optional(),
    })
    .optional(),
  bio: z.string().max(500).optional(),
  kycInfo: z
    .object({
      type: z.enum(["aadhar", "pan", "passport"]).optional(),
      number: z.string().optional(),
      documentUrl: z.string().optional(),
      verified: z.boolean().optional(),
    })
    .optional(),
  education: z
    .array(
      z.object({
        degree: z.string(),
        institution: z.string(),
        fieldOfStudy: z.string(),
        graduationYear: z.number(),
        gpa: z.number().optional(),
        currentlyEnrolled: z.boolean().optional(),
      })
    )
    .optional(),
  jobPreferences: z
    .object({
      preferredRoles: z.array(z.string()).optional(),
      preferredLocations: z.array(z.string()).optional(),
      jobTypes: z
        .array(
          z.enum(["full-time", "part-time", "internship", "contract", "remote"])
        )
        .optional(),
      expectedSalary: z
        .object({
          min: z.number().optional(),
          max: z.number().optional(),
          currency: z.string().optional(),
        })
        .optional(),
      willingToRelocate: z.boolean().optional(),
    })
    .optional(),
  skills: z
    .array(
      z.object({
        name: z.string(),
        level: z
          .enum(["beginner", "intermediate", "advanced", "expert"])
          .optional(),
      })
    )
    .optional(),
  careerPlan: z
    .object({
      shortTermGoals: z.string().max(300).optional(),
      longTermGoals: z.string().max(300).optional(),
      areasOfInterest: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function getProfile(req, res, next) {
  try {
    const student = await StudentModel.findOne({
      userId: req.user.id,
    }).populate("userId", "firstName lastName email");

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student profile not found" });
    }

    res.json({ success: true, data: student });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const parsed = updateStudentSchema.parse(req.body);

    const student = await StudentModel.findOneAndUpdate(
      { userId: req.user.id },
      { $set: parsed },
      { new: true, runValidators: true }
    );

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: "Student profile not found" });
    }

    // Update user profile completion status
    await UserModel.findByIdAndUpdate(req.user.id, {
      profileCompleted: true,
    });

    res.json({
      success: true,
      data: student,
      message: "Profile updated successfully",
    });
  } catch (err) {
    next(err);
  }
}

// =============================
// Activity (student self view)
// =============================
export async function getActivity(req, res, next) {
  try {
    // Last login and basic user info
    const user = await UserModel.findById(req.user.id).select(
      "lastLogin createdAt updatedAt"
    );

    // Applications summary
    const [appsSummary] = await ApplicationModel.aggregate([
      { $match: { studentId: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $group: {
          _id: null,
          totalApplications: { $sum: 1 },
          lastAppliedAt: { $max: "$createdAt" },
        },
      },
    ]);

    // Student profile bits
    const student = await StudentModel.findOne({ userId: req.user.id }).select(
      "profileCompletion resume uploadedAt plan"
    );

    res.json({
      success: true,
      data: {
        lastLogin: user?.lastLogin || null,
        accountCreatedAt: user?.createdAt || null,
        totalApplications: appsSummary?.totalApplications || 0,
        lastAppliedAt: appsSummary?.lastAppliedAt || null,
        profileCompletion: student?.profileCompletion || 0,
        hasResume: Boolean(student?.resume?.url),
        plan: student?.plan || "free",
      },
    });
  } catch (err) {
    next(err);
  }
}

// =============================
// Support Tickets
// =============================

export async function createSupportTicket(req, res, next) {
  try {
    const { subject, description, category = "other", priority = "medium" } = req.body;

    if (!subject || !description) {
      return res.status(400).json({ success: false, message: "Subject and description are required" });
    }

    const ticket = await SupportTicketModel.create({
      studentId: req.user.id,
      subject,
      description,
      category,
      priority,
    });

    res.status(201).json({ success: true, data: ticket, message: "Support ticket created" });
  } catch (err) {
    next(err);
  }
}

export async function listMySupportTickets(req, res, next) {
  try {
    const { page = 1, limit = 10, status, category } = req.query;
    const filter = { studentId: req.user.id };
    if (status) filter.status = status;
    if (category) filter.category = category;

    const tickets = await SupportTicketModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await SupportTicketModel.countDocuments(filter);

    res.json({
      success: true,
      data: tickets,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalTickets: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMySupportTicketById(req, res, next) {
  try {
    const { id } = req.params;
    const ticket = await SupportTicketModel.findOne({ _id: id, studentId: req.user.id });
    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }
    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
}
