import { z } from "zod";
import { EmployerModel } from "../models/Employer.js";
import { JobModel } from "../models/Job.js";
import { ApplicationModel } from "../models/Application.js";
import { UserModel } from "../models/User.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Validation schema for profile completion (required fields)
export const completeEmployerProfileSchema = z.object({
  company: z.object({
    name: z.string().min(1, "Company name is required"),
    description: z.string().optional(),
    industry: z.string().min(1, "Industry is required"),
    size: z.enum(["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"]),
    website: z.string().url().optional().or(z.literal("")),
    foundedYear: z.number().min(1900).max(new Date().getFullYear()).optional(),
  }),
  contact: z.object({
    phone: z.string().min(10, "Valid phone number is required"),
    address: z.object({
      street: z.string().min(1, "Street address is required"),
      city: z.string().min(1, "City is required"),
      state: z.string().min(1, "State is required"),
      country: z.string().min(1, "Country is required"),
      zipCode: z.string().min(1, "Zip code is required"),
    }),
  }),
  position: z.string().min(1, "Position is required"),
  department: z.string().optional(),
  bio: z.string().max(500).optional(),
  hiringGoals: z.string().max(300).optional(),
});

// Validation schema for partial updates (all fields optional)
export const updateEmployerSchema = z.object({
  company: z
    .object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      industry: z.string().optional(),
      size: z
        .enum(["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"])
        .optional(),
      website: z.string().url().optional().or(z.literal("")),
      foundedYear: z
        .number()
        .min(1900)
        .max(new Date().getFullYear())
        .optional(),
    })
    .optional(),
  contact: z
    .object({
      phone: z.string().min(10).optional(),
      address: z
        .object({
          street: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          country: z.string().optional(),
          zipCode: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  hiringNeeds: z
    .object({
      typesOfRoles: z.array(z.string()).optional(),
      locations: z.array(z.string()).optional(),
      typicalSalaryRanges: z
        .array(
          z.object({
            role: z.string(),
            min: z.number(),
            max: z.number(),
            currency: z.string().default("USD"),
          })
        )
        .optional(),
    })
    .optional(),
  bio: z.string().max(500).optional(),
  hiringGoals: z.string().max(300).optional(),
  socialLinks: z
    .object({
      linkedin: z.string().url().optional().or(z.literal("")),
      twitter: z.string().url().optional().or(z.literal("")),
      facebook: z.string().url().optional().or(z.literal("")),
    })
    .optional(),
  branding: z
    .object({
      themeColor: z.string().optional(),
      // coverImage updated via upload endpoint
    })
    .optional(),
});

// Calculate profile completion percentage
function calculateProfileCompletion(employer) {
  let completedFields = 0;
  const totalFields = 8; // Adjust based on your important fields

  const fieldsToCheck = [
    employer?.position,
    employer?.company?.name,
    employer?.company?.industry,
    employer?.company?.size,
    employer?.contact?.phone,
    employer?.contact?.address?.street,
    employer?.contact?.address?.city,
    employer?.contact?.address?.country,
  ];

  completedFields = fieldsToCheck.filter(
    (field) => field !== undefined && field !== null && field !== ""
  ).length;

  return Math.round((completedFields / totalFields) * 100);
}

// Get employer profile
export const getEmployerProfile = async (req, res, next) => {
  try {
    const employer = await EmployerModel.findOne({
      userId: req.user.id,
    }).populate("userId", "firstName lastName email");

    if (!employer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer profile not found" });
    }

    // Calculate current profile completion
    const profileCompletion = calculateProfileCompletion(employer);

    res.json({
      success: true,
      data: {
        ...employer.toObject(),
        profileCompletion,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Complete employer profile (for initial setup)
export const completeEmployerProfile = async (req, res, next) => {
  try {
    const parsed = completeEmployerProfileSchema.parse(req.body);

    const employer = await EmployerModel.findOneAndUpdate(
      { userId: req.user.id },
      {
        $set: {
          ...parsed,
          profileCompletion: 100, // Mark as fully complete
        },
      },
      { new: true, runValidators: true }
    );

    if (!employer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer profile not found" });
    }

    // Update user profile completion status
    await UserModel.findByIdAndUpdate(req.user.id, {
      profileCompleted: true,
    });

    res.json({
      success: true,
      data: employer,
      message: "Profile completed successfully",
      profileCompletion: employer.profileCompletion,
    });
  } catch (err) {
    next(err);
  }
};

// Update employer profile (for partial updates)
export const updateEmployerProfile = async (req, res, next) => {
  try {
    const parsed = updateEmployerSchema.parse(req.body);

    const employer = await EmployerModel.findOneAndUpdate(
      { userId: req.user.id },
      { $set: parsed },
      { new: true, runValidators: true }
    );

    if (!employer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer profile not found" });
    }

    // Recalculate profile completion
    const profileCompletion = calculateProfileCompletion(employer);

    // Update profile completion in database
    employer.profileCompletion = profileCompletion;
    await employer.save();

    // Update user profile completion status if profile is 100% complete
    if (profileCompletion === 100) {
      await UserModel.findByIdAndUpdate(req.user.id, {
        profileCompleted: true,
      });
    }

    res.json({
      success: true,
      data: employer,
      message: "Profile updated successfully",
      profileCompletion,
    });
  } catch (err) {
    next(err);
  }
};

// Update hiring preferences specifically
export const updateHiringPreferences = async (req, res, next) => {
  try {
    const { typesOfRoles, locations, typicalSalaryRanges } = req.body;

    const employer = await EmployerModel.findOneAndUpdate(
      { userId: req.user.id },
      {
        $set: {
          hiringNeeds: {
            typesOfRoles: typesOfRoles || [],
            locations: locations || [],
            typicalSalaryRanges: typicalSalaryRanges || [],
          },
        },
      },
      { new: true, runValidators: true }
    );

    if (!employer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer profile not found" });
    }

    res.json({
      success: true,
      data: employer,
      message: "Hiring preferences updated successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Get employer dashboard stats
export const getEmployerDashboard = async (req, res, next) => {
  try {
    const employer = await EmployerModel.findOne({
      userId: req.user.id,
    }).populate("userId", "firstName lastName email");

    if (!employer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer profile not found" });
    }

    // Aggregate actual stats
    const [
      jobsPosted,
      activeJobsCount,
      applicationsCount,
      newApplicationsCount,
    ] = await Promise.all([
      JobModel.countDocuments({ employerId: req.user.id }),
      JobModel.countDocuments({ employerId: req.user.id, status: "active" }),
      ApplicationModel.countDocuments({ employerId: req.user.id }),
      ApplicationModel.countDocuments({
        employerId: req.user.id,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    const dashboardStats = {
      profileCompletion: employer.profileCompletion,
      company: employer.company,
      totalJobsPosted: jobsPosted,
      totalApplications: applicationsCount,
      activeJobs: activeJobsCount,
      newApplications: newApplicationsCount,
    };

    res.json({
      success: true,
      data: dashboardStats,
    });
  } catch (err) {
    next(err);
  }
};

// Optional: Get employer by ID (public profile)
export const getEmployerById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const employer = await EmployerModel.findById(id)
      .populate("userId", "firstName lastName email")
      .select("-hiringNeeds.typicalSalaryRanges -verificationDocuments");

    if (!employer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer not found" });
    }

    res.json({ success: true, data: employer });
  } catch (err) {
    next(err);
  }
};

// Optional: Get all employers (for admin or public listing)
export const getAllEmployers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, industry, companySize, search } = req.query;

    const filter = { isActive: true }; // Only show active employers

    if (industry) {
      filter["company.industry"] = new RegExp(industry, "i");
    }

    if (companySize) {
      filter["company.size"] = companySize;
    }

    if (search) {
      filter.$or = [
        { "company.name": new RegExp(search, "i") },
        { "company.description": new RegExp(search, "i") },
        { position: new RegExp(search, "i") },
      ];
    }

    const employers = await EmployerModel.find(filter)
      .populate("userId", "firstName lastName email")
      .select("-hiringNeeds.typicalSalaryRanges -verificationDocuments")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await EmployerModel.countDocuments(filter);

    res.json({
      success: true,
      data: employers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalEmployers: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Update employer subscription plan (free|pro)
export const updateEmployerPlanSchema = z.object({
  plan: z.enum(["free", "pro"]),
});

export const updateEmployerPlan = async (req, res, next) => {
  try {
    const parsed = updateEmployerPlanSchema.parse(req.body);

    const employer = await EmployerModel.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { plan: parsed.plan } },
      { new: true, runValidators: true }
    );

    if (!employer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer profile not found" });
    }

    res.json({
      success: true,
      data: { plan: employer.plan },
      message: `Plan updated to ${employer.plan}`,
    });
  } catch (err) {
    next(err);
  }
};

// In your employer analytics controller
export const getEmployerAnalytics = async (req, res, next) => {
  try {
    const employerId = req.user.id;

    // Status stats and total
    const statsAgg = await ApplicationModel.aggregate([
      { $match: { employerId: new mongoose.Types.ObjectId(employerId) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const statusStats = statsAgg.reduce((acc, cur) => {
      acc[cur._id] = cur.count;
      return acc;
    }, {});

    const totalApplications = await ApplicationModel.countDocuments({
      employerId: new mongoose.Types.ObjectId(employerId),
    });

    // Average time to hire (days)
    const avgTimeToHireAgg = await ApplicationModel.aggregate([
      {
        $match: {
          employerId: new mongoose.Types.ObjectId(employerId),
          status: "hired",
        },
      },
      {
        $project: {
          diffMs: {
            $cond: {
              if: { $and: ["$createdAt", "$updatedAt"] },
              then: { $subtract: ["$updatedAt", "$createdAt"] },
              else: 0,
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          avgMs: { $avg: "$diffMs" },
        },
      },
    ]);

    const averageTimeToHireDays =
      avgTimeToHireAgg.length && avgTimeToHireAgg[0].avgMs
        ? Math.round((avgTimeToHireAgg[0].avgMs / (1000 * 60 * 60 * 24)) * 10) /
          10
        : 0;

    // Monthly stats for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyAgg = await ApplicationModel.aggregate([
      {
        $match: {
          employerId: new mongoose.Types.ObjectId(employerId),
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          applications: { $sum: 1 },
          hires: {
            $sum: {
              $cond: [{ $eq: ["$status", "hired"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Normalize to last 6 calendar months
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthlyStats = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const found = monthlyAgg.find(
        (x) => x._id.year === y && x._id.month === m
      );
      monthlyStats.push({
        month: monthNames[m - 1],
        applications: found?.applications || 0,
        hires: found?.hires || 0,
      });
    }

    // Job performance (applications and hires per job)
    const jobPerfAgg = await ApplicationModel.aggregate([
      {
        $match: {
          employerId: new mongoose.Types.ObjectId(employerId),
        },
      },
      {
        $group: {
          _id: "$jobId",
          applications: { $sum: 1 },
          hires: {
            $sum: {
              $cond: [{ $eq: ["$status", "hired"] }, 1, 0],
            },
          },
        },
      },
      {
        $lookup: {
          from: "jobs",
          localField: "_id",
          foreignField: "_id",
          as: "job",
        },
      },
      {
        $unwind: {
          path: "$job",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          jobId: "$_id",
          title: "$job.title",
          status: "$job.status",
          applications: 1,
          hires: 1,
          conversion: {
            $cond: [
              { $gt: ["$applications", 0] },
              { $multiply: [{ $divide: ["$hires", "$applications"] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { applications: -1 } },
    ]);

    // Top locations of applicants
    const topLocationsAgg = await ApplicationModel.aggregate([
      {
        $match: {
          employerId: new mongoose.Types.ObjectId(employerId),
        },
      },
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "userId",
          as: "student",
        },
      },
      {
        $unwind: {
          path: "$student",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: {
            $ifNull: ["$student.contact.address.city", "Unknown"],
          },
          applicants: { $sum: 1 },
        },
      },
      { $sort: { applicants: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          location: "$_id",
          applicants: 1,
        },
      },
    ]);

    // Candidate sources (mock data for now)
    const candidateSources = [
      {
        source: "LinkedIn",
        percentage: 35,
        count: Math.round(totalApplications * 0.35),
      },
      {
        source: "Indeed",
        percentage: 25,
        count: Math.round(totalApplications * 0.25),
      },
      {
        source: "Company Website",
        percentage: 20,
        count: Math.round(totalApplications * 0.2),
      },
      {
        source: "Referrals",
        percentage: 15,
        count: Math.round(totalApplications * 0.15),
      },
      {
        source: "Other",
        percentage: 5,
        count: Math.round(totalApplications * 0.05),
      },
    ];

    // Recent activity (latest 5 applications)
    const recentActivity = await ApplicationModel.find({
      employerId: new mongoose.Types.ObjectId(employerId),
    })
      .populate("jobId", "title")
      .populate("studentId", "firstName lastName")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json({
      success: true,
      data: {
        overview: {
          totalApplications,
          conversionRate: totalApplications
            ? Math.round(
                ((statusStats.hired || 0) / totalApplications) * 1000
              ) / 10
            : 0,
          averageTimeToHireDays,
        },
        status: statusStats,
        monthlyStats,
        jobPerformance: jobPerfAgg,
        topLocations: topLocationsAgg,
        candidateSources, // Add candidate sources to response
        recentActivity,
      },
    });
  } catch (err) {
    console.error("Analytics error:", err);
    next(err);
  }
};

// ==============================
// Verification documents & branding
// ==============================

const allowedDocTypes = [
  "business_license",
  "tax_certificate",
  "company_registration",
  "gst",
  "pan",
  "other",
];

export const uploadVerificationDocumentSchema = z.object({
  type: z.enum([
    "business_license",
    "tax_certificate",
    "company_registration",
    "gst",
    "pan",
    "other",
  ]),
});

export const uploadVerificationDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No document uploaded" });
    }

    const parsed = uploadVerificationDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid document type" });
    }

    // Basic file type guard: allow PDFs and common images
    const allowedMime = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
    ];
    if (!allowedMime.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Only PDF or image files are allowed",
      });
    }

    const employer = await EmployerModel.findOne({ userId: req.user.id });
    if (!employer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer profile not found" });
    }

    const newDoc = {
      type: parsed.data.type,
      filename: req.file.originalname,
      url: `/uploads/${req.file.filename}`,
      uploadedAt: new Date(),
      status: "uploaded",
    };

    employer.verificationDocuments.push(newDoc);
    await employer.save();

    const saved = employer.verificationDocuments[employer.verificationDocuments.length - 1];

    res.json({
      success: true,
      data: saved,
      message: "Document uploaded",
    });
  } catch (err) {
    next(err);
  }
};

export const listVerificationDocuments = async (req, res, next) => {
  try {
    const employer = await EmployerModel.findOne({ userId: req.user.id });
    if (!employer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer profile not found" });
    }
    return res.json({ success: true, data: employer.verificationDocuments });
  } catch (err) {
    next(err);
  }
};

export const deleteVerificationDocument = async (req, res, next) => {
  try {
    const { docId } = req.params;
    const employer = await EmployerModel.findOne({ userId: req.user.id });
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

    // Attempt to delete physical file (best-effort)
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const uploadsDir = path.resolve(__dirname, "..", "..", "uploads");
      if (document.url && document.url.startsWith("/uploads/")) {
        const filepath = path.join(uploadsDir, path.basename(document.url));
        fs.unlink(filepath, () => {});
      }
    } catch {}

    document.deleteOne();
    await employer.save();

    return res.json({ success: true, message: "Document deleted" });
  } catch (err) {
    next(err);
  }
};

export const getEmployerVerificationStatus = async (req, res, next) => {
  try {
    const employer = await EmployerModel.findOne({ userId: req.user.id });
    if (!employer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer profile not found" });
    }

    const counts = employer.verificationDocuments.reduce(
      (acc, d) => {
        acc.total += 1;
        acc.byStatus[d.status] = (acc.byStatus[d.status] || 0) + 1;
        acc.byType[d.type] = (acc.byType[d.type] || 0) + 1;
        return acc;
      },
      { total: 0, byStatus: {}, byType: {} }
    );

    return res.json({
      success: true,
      data: {
        isVerified: employer.isVerified,
        documents: employer.verificationDocuments,
        counts,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const uploadCoverImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No cover image uploaded" });
    }

    const allowedMime = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedMime.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Only image files are allowed",
      });
    }

    const employer = await EmployerModel.findOneAndUpdate(
      { userId: req.user.id },
      {
        $set: {
          "branding.coverImage": {
            filename: req.file.originalname,
            url: `/uploads/${req.file.filename}`,
            uploadedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!employer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer profile not found" });
    }

    return res.json({
      success: true,
      data: employer.branding?.coverImage,
      message: "Cover image uploaded",
    });
  } catch (err) {
    next(err);
  }
};

export const updateBranding = async (req, res, next) => {
  try {
    const schema = z
      .object({
        themeColor: z.string().optional(),
      })
      .strict();
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid branding payload" });
    }

    const employer = await EmployerModel.findOneAndUpdate(
      { userId: req.user.id },
      {
        $set: Object.fromEntries(
          Object.entries(parsed.data).map(([k, v]) => [
            `branding.${k}`,
            v,
          ])
        ),
      },
      { new: true }
    );

    if (!employer) {
      return res
        .status(404)
        .json({ success: false, message: "Employer profile not found" });
    }

    return res.json({ success: true, data: employer.branding, message: "Branding updated" });
  } catch (err) {
    next(err);
  }
};
