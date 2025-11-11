import { LeadModel as Lead } from "../models/Lead.js";
import { ApplicationModel as Application } from "../models/Application.js";
import { StudentModel as Student } from "../models/Student.js";
import { EmployerModel as Employer } from "../models/Employer.js";
import { JobModel as Job } from "../models/Job.js";
import { CourseModel as Course } from "../models/Course.js";
import { CourseProgressModel as CourseProgress } from "../models/CourseProgress.js";
import { CourseEnrollment } from "../models/CourseEnrollment.js";
import { PurchaseModel as Purchase } from "../models/Purchase.js";
import { InterviewModel as Interview } from "../models/Interview.js";

// ==================== OVERVIEW DASHBOARD ====================
export const getOverviewStats = async (req, res) => {
  try {
    const { startDate, endDate, staffId } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Build staff filter
    const staffFilter = staffId ? { assignedTo: staffId } : {};

    // Parallel queries for better performance
    const [
      totalLeads,
      activeLeads,
      convertedLeads,
      totalRevenue,
      totalStudents,
      placedStudents,
      totalEmployers,
      activeJobs,
      totalApplications,
      scheduledInterviews,
      completedInterviews,
      totalCourses,
      activeCourses,
    ] = await Promise.all([
      Lead.countDocuments({ ...dateFilter, ...staffFilter }),
      Lead.countDocuments({ ...dateFilter, ...staffFilter, status: { $in: ["new", "contacted", "qualified"] } }),
      Lead.countDocuments({ ...dateFilter, ...staffFilter, status: "converted" }),
      Purchase.aggregate([
        { $match: { ...dateFilter, status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Student.countDocuments(dateFilter),
      Application.countDocuments({ ...dateFilter, status: "hired" }),
      Employer.countDocuments(dateFilter),
      Job.countDocuments({ ...dateFilter, status: "active" }),
      Application.countDocuments(dateFilter),
      Interview.countDocuments({ ...dateFilter, status: "scheduled" }),
      Interview.countDocuments({ ...dateFilter, status: "completed" }),
      Course.countDocuments(dateFilter),
      Course.countDocuments({ ...dateFilter, status: "active" }),
    ]);

    // Calculate conversion rate
    const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(2) : 0;
    const placementRate = totalStudents > 0 ? ((placedStudents / totalStudents) * 100).toFixed(2) : 0;

    // Get revenue breakdown
    const revenueData = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    // Get monthly trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyLeads = await Lead.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, ...staffFilter } },
      {
        $match: {
          createdAt: { $exists: true, $ne: null, $type: "date" }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthlyRevenue = await Purchase.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, status: "completed" } },
      {
        $match: {
          createdAt: { $exists: true, $ne: null, $type: "date" }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        kpis: {
          totalLeads,
          activeLeads,
          convertedLeads,
          conversionRate: parseFloat(conversionRate),
          totalRevenue: revenueData,
          totalStudents,
          placedStudents,
          placementRate: parseFloat(placementRate),
          totalEmployers,
          activeJobs,
          totalApplications,
          scheduledInterviews,
          completedInterviews,
          totalCourses,
          activeCourses,
        },
        trends: {
          monthlyLeads,
          monthlyRevenue,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching overview stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch overview statistics",
      error: error.message,
    });
  }
};

// ==================== LEAD CONVERSION ANALYTICS ====================
export const getLeadConversionAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, staffId } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const staffFilter = staffId ? { assignedTo: staffId } : {};

    // Funnel data by stage
    const funnelData = await Lead.aggregate([
      { $match: { ...dateFilter, ...staffFilter } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Conversion by source
    const conversionBySource = await Lead.aggregate([
      { $match: { ...dateFilter, ...staffFilter } },
      {
        $group: {
          _id: "$source",
          total: { $sum: 1 },
          converted: {
            $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          source: "$_id",
          total: 1,
          converted: 1,
          conversionRate: {
            $multiply: [{ $divide: ["$converted", "$total"] }, 100],
          },
        },
      },
      { $sort: { conversionRate: -1 } },
    ]);

    // Staff performance
    const staffPerformance = await Lead.aggregate([
      { $match: { ...dateFilter, assignedTo: { $exists: true } } },
      {
        $group: {
          _id: "$assignedTo",
          totalLeads: { $sum: 1 },
          converted: {
            $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] },
          },
          lost: {
            $sum: { $cond: [{ $eq: ["$status", "lost"] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          staffId: "$_id",
          totalLeads: 1,
          converted: 1,
          lost: 1,
          conversionRate: {
            $multiply: [{ $divide: ["$converted", "$totalLeads"] }, 100],
          },
        },
      },
      { $sort: { conversionRate: -1 } },
      { $limit: 10 },
    ]);

    // Average time to conversion
    const avgConversionTime = await Lead.aggregate([
      { $match: { ...dateFilter, ...staffFilter, status: "converted", convertedAt: { $exists: true } } },
      {
        $project: {
          conversionTime: {
            $divide: [{ $subtract: ["$convertedAt", "$createdAt"] }, 86400000], // days
          },
        },
      },
      {
        $group: {
          _id: null,
          avgDays: { $avg: "$conversionTime" },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        funnelData,
        conversionBySource,
        staffPerformance,
        avgConversionTime: avgConversionTime.length > 0 ? avgConversionTime[0].avgDays.toFixed(1) : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching lead conversion analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch lead conversion analytics",
      error: error.message,
    });
  }
};

// ==================== REVENUE & PAYMENT REPORTS ====================
export const getRevenueReports = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "month" } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Total revenue by status
    const revenueByStatus = await Purchase.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$status",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Revenue by source/type
    const revenueByType = await Purchase.aggregate([
      { $match: { ...dateFilter, status: "completed" } },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Monthly revenue trend
    const format = groupBy === "day" ? "%Y-%m-%d" : groupBy === "week" ? "%Y-W%V" : "%Y-%m";
    const revenueTrend = await Purchase.aggregate([
      { $match: { ...dateFilter, status: "completed" } },
      {
        $match: {
          createdAt: { $exists: true, $ne: null, $type: "date" }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format, date: "$createdAt" } },
          revenue: { $sum: "$amount" },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Top revenue sources
    const topSources = await Purchase.aggregate([
      { $match: { ...dateFilter, status: "completed" } },
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: "$student" },
      {
        $group: {
          _id: "$student.source",
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    // Pending vs completed
    const paymentStatus = await Purchase.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalPending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, "$amount", 0] },
          },
          totalCompleted: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, "$amount", 0] },
          },
          totalFailed: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, "$amount", 0] },
          },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        revenueByStatus,
        revenueByType,
        revenueTrend,
        topSources,
        paymentStatus: paymentStatus.length > 0 ? paymentStatus[0] : {},
      },
    });
  } catch (error) {
    console.error("Error fetching revenue reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch revenue reports",
      error: error.message,
    });
  }
};

// ==================== STUDENT PLACEMENT ANALYTICS ====================
export const getPlacementAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Placement rate
    const totalStudents = await Student.countDocuments(dateFilter);
    const placedStudents = await Application.countDocuments({ ...dateFilter, status: "hired" });
    const placementRate = totalStudents > 0 ? ((placedStudents / totalStudents) * 100).toFixed(2) : 0;

    // Top employers by placements
    const topEmployers = await Application.aggregate([
      { $match: { ...dateFilter, status: "hired" } },
      {
        $lookup: {
          from: "users",
          localField: "employerId",
          foreignField: "_id",
          as: "employer",
        },
      },
      { $unwind: "$employer" },
      {
        $group: {
          _id: "$employer._id",
          name: { $first: { $concat: ["$employer.firstName", " ", "$employer.lastName"] } },
          email: { $first: "$employer.email" },
          placements: { $sum: 1 },
        },
      },
      { $sort: { placements: -1 } },
      { $limit: 10 },
    ]);

    // Placements by job role
    const placementsByRole = await Application.aggregate([
      { $match: { ...dateFilter, status: "hired" } },
      {
        $lookup: {
          from: "jobs",
          localField: "jobId",
          foreignField: "_id",
          as: "job",
        },
      },
      { $unwind: "$job" },
      {
        $group: {
          _id: "$job.title",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Average time to placement
    const avgPlacementTime = await Application.aggregate([
      { $match: { ...dateFilter, status: "hired", updatedAt: { $exists: true } } },
      {
        $lookup: {
          from: "students",
          localField: "studentId",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: "$student" },
      {
        $project: {
          placementTime: {
            $divide: [{ $subtract: ["$updatedAt", "$student.createdAt"] }, 86400000], // days
          },
        },
      },
      {
        $group: {
          _id: null,
          avgDays: { $avg: "$placementTime" },
        },
      },
    ]);

    // Monthly placement trend
    const placementTrend = await Application.aggregate([
      { $match: { ...dateFilter, status: "hired" } },
      {
        $match: {
          updatedAt: { $exists: true, $ne: null, $type: "date" }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$updatedAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalStudents,
          placedStudents,
          placementRate: parseFloat(placementRate),
          avgPlacementTime: avgPlacementTime.length > 0 ? avgPlacementTime[0].avgDays.toFixed(1) : 0,
        },
        topEmployers,
        placementsByRole,
        placementTrend,
      },
    });
  } catch (error) {
    console.error("Error fetching placement analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch placement analytics",
      error: error.message,
    });
  }
};

// ==================== EMPLOYER ENGAGEMENT ANALYTICS ====================
export const getEmployerEngagement = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Total employers and active employers
    const totalEmployers = await Employer.countDocuments(dateFilter);
    const activeEmployers = await Job.distinct("employerId", { ...dateFilter, status: "active" });

    // Job posting statistics
    const jobStats = await Job.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Top employers by job posts
    const topEmployersByJobs = await Job.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: "users",
          localField: "employerId",
          foreignField: "_id",
          as: "employer",
        },
      },
      { $unwind: "$employer" },
      {
        $group: {
          _id: "$employer._id",
          name: { $first: { $concat: ["$employer.firstName", " ", "$employer.lastName"] } },
          email: { $first: "$employer.email" },
          jobPosts: { $sum: 1 },
          activeJobs: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
        },
      },
      { $sort: { jobPosts: -1 } },
      { $limit: 10 },
    ]);

    // Top employers by applications received
    const topEmployersByApplications = await Application.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: "users",
          localField: "employerId",
          foreignField: "_id",
          as: "employer",
        },
      },
      { $unwind: "$employer" },
      {
        $group: {
          _id: "$employer._id",
          name: { $first: { $concat: ["$employer.firstName", " ", "$employer.lastName"] } },
          email: { $first: "$employer.email" },
          applications: { $sum: 1 },
          hired: {
            $sum: { $cond: [{ $eq: ["$status", "hired"] }, 1, 0] },
          },
        },
      },
      { $sort: { applications: -1 } },
      { $limit: 10 },
    ]);

    // Employer activity trend
    const activityTrend = await Job.aggregate([
      { $match: dateFilter },
      {
        $match: {
          createdAt: { $exists: true, $ne: null, $type: "date" }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          jobPosts: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalEmployers,
          activeEmployers: activeEmployers.length,
          engagementRate: totalEmployers > 0 ? ((activeEmployers.length / totalEmployers) * 100).toFixed(2) : 0,
        },
        jobStats,
        topEmployersByJobs,
        topEmployersByApplications,
        activityTrend,
      },
    });
  } catch (error) {
    console.error("Error fetching employer engagement:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employer engagement analytics",
      error: error.message,
    });
  }
};

// ==================== TRAINING/COURSE ANALYTICS ====================
export const getCourseAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Course statistics - count from courses collection
    const totalCourses = await Course.countDocuments();
    const activeCourses = await Course.countDocuments({ status: "active" });

    // Enrollment statistics from CourseEnrollment model
    const enrollmentStats = await CourseEnrollment.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          totalEnrollments: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] },
          },
          enrolled: {
            $sum: { $cond: [{ $eq: ["$status", "enrolled"] }, 1, 0] },
          },
          avgProgress: { $avg: "$progress" },
        },
      },
    ]);

    // Top courses - show all courses with enrollment stats from CourseEnrollment
    const topCourses = await Course.aggregate([
      {
        $lookup: {
          from: "courseenrollments",
          localField: "_id",
          foreignField: "courseId",
          as: "enrollments",
        },
      },
      {
        $addFields: {
          totalEnrollments: { $size: "$enrollments" },
          completed: {
            $size: {
              $filter: {
                input: "$enrollments",
                as: "enrollment",
                cond: { $eq: ["$$enrollment.status", "completed"] },
              },
            },
          },
          inProgress: {
            $size: {
              $filter: {
                input: "$enrollments",
                as: "enrollment",
                cond: { $eq: ["$$enrollment.status", "in_progress"] },
              },
            },
          },
          enrolledOnly: {
            $size: {
              $filter: {
                input: "$enrollments",
                as: "enrollment",
                cond: { $eq: ["$$enrollment.status", "enrolled"] },
              },
            },
          },
          avgProgress: {
            $cond: [
              { $gt: [{ $size: "$enrollments" }, 0] },
              { $avg: "$enrollments.progress" },
              0
            ]
          },
        },
      },
      {
        $addFields: {
          completionRate: {
            $cond: [
              { $gt: ["$totalEnrollments", 0] },
              {
                $multiply: [
                  { $divide: ["$completed", "$totalEnrollments"] },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
      {
        $project: {
          title: 1,
          category: 1,
          description: 1,
          thumbnail: 1,
          instructor: 1,
          level: 1,
          enrollments: "$totalEnrollments",
          completed: 1,
          inProgress: 1,
          enrolledOnly: 1,
          avgProgress: 1,
          completionRate: 1,
          createdAt: 1,
        },
      },
      { $sort: { enrollments: -1, createdAt: -1 } },
      { $limit: 10 },
    ]);

    // Course completion trend from CourseEnrollment
    const completionTrend = await CourseEnrollment.aggregate([
      { $match: { status: "completed" } },
      {
        $match: {
          completedAt: { $exists: true, $ne: null, $type: "date" }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$completedAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Revenue from courses
    const courseRevenue = await Purchase.aggregate([
      { $match: { ...dateFilter, type: "course", status: "completed" } },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalCourses,
          activeCourses,
          ...enrollmentStats[0],
          revenue: courseRevenue.length > 0 ? courseRevenue[0].total : 0,
        },
        topCourses,
        completionTrend,
      },
    });
  } catch (error) {
    console.error("Error fetching course analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch course analytics",
      error: error.message,
    });
  }
};

// ==================== STAFF PERFORMANCE ====================
export const getStaffPerformance = async (req, res) => {
  try {
    const { startDate, endDate, staffId } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const staffFilter = staffId ? { assignedTo: staffId } : { assignedTo: { $exists: true } };

    // Staff lead performance
    const staffLeadPerformance = await Lead.aggregate([
      { $match: { ...dateFilter, ...staffFilter } },
      {
        $group: {
          _id: "$assignedTo",
          totalLeads: { $sum: 1 },
          converted: {
            $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] },
          },
          lost: {
            $sum: { $cond: [{ $eq: ["$status", "lost"] }, 1, 0] },
          },
          inProgress: {
            $sum: {
              $cond: [
                { $in: ["$status", ["new", "contacted", "qualified"]] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          staffId: "$_id",
          totalLeads: 1,
          converted: 1,
          lost: 1,
          inProgress: 1,
          conversionRate: {
            $multiply: [{ $divide: ["$converted", "$totalLeads"] }, 100],
          },
        },
      },
      { $sort: { conversionRate: -1 } },
    ]);

    // Staff revenue contribution
    const staffRevenue = await Lead.aggregate([
      { $match: { ...dateFilter, ...staffFilter, status: "converted" } },
      {
        $lookup: {
          from: "purchases",
          let: { leadId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$leadId", "$$leadId"] },
                status: "completed",
              },
            },
          ],
          as: "purchases",
        },
      },
      { $unwind: { path: "$purchases", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$assignedTo",
          revenue: { $sum: "$purchases.amount" },
          deals: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Combine data
    const combinedPerformance = staffLeadPerformance.map((staff) => {
      const revenueData = staffRevenue.find((r) => r._id?.toString() === staff.staffId?.toString());
      return {
        ...staff,
        revenue: revenueData?.revenue || 0,
        deals: revenueData?.deals || 0,
      };
    });

    res.json({
      success: true,
      data: {
        staffPerformance: combinedPerformance,
      },
    });
  } catch (error) {
    console.error("Error fetching staff performance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch staff performance",
      error: error.message,
    });
  }
};

// ==================== EXPORT REPORTS ====================
export const exportReport = async (req, res) => {
  try {
    const { reportType, format = "json", startDate, endDate } = req.query;

    let data;

    // Get data based on report type
    switch (reportType) {
      case "overview":
        data = await getOverviewStatsData(startDate, endDate);
        break;
      case "leads":
        data = await getLeadConversionData(startDate, endDate);
        break;
      case "revenue":
        data = await getRevenueData(startDate, endDate);
        break;
      case "placements":
        data = await getPlacementData(startDate, endDate);
        break;
      case "employers":
        data = await getEmployerData(startDate, endDate);
        break;
      case "courses":
        data = await getCourseData(startDate, endDate);
        break;
      case "staff":
        data = await getStaffData(startDate, endDate);
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid report type",
        });
    }

    // Format response based on requested format
    if (format === "csv") {
      // Convert to CSV (simplified)
      const csv = convertToCSV(data);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${reportType}-report.csv"`);
      return res.send(csv);
    }

    // Default JSON response
    res.json({
      success: true,
      reportType,
      generatedAt: new Date().toISOString(),
      data,
    });
  } catch (error) {
    console.error("Error exporting report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export report",
      error: error.message,
    });
  }
};

// Helper functions for export
const getOverviewStatsData = async (startDate, endDate) => {
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  const [totalLeads, totalStudents, totalEmployers, totalJobs, totalApplications] = await Promise.all([
    Lead.countDocuments(dateFilter),
    Student.countDocuments(dateFilter),
    Employer.countDocuments(dateFilter),
    Job.countDocuments(dateFilter),
    Application.countDocuments(dateFilter),
  ]);

  return {
    totalLeads,
    totalStudents,
    totalEmployers,
    totalJobs,
    totalApplications,
    generatedAt: new Date().toISOString(),
  };
};

const getLeadConversionData = async (startDate, endDate) => {
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  const leads = await Lead.find(dateFilter).select('status source createdAt').lean();
  return {
    totalLeads: leads.length,
    byStatus: leads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {}),
    bySource: leads.reduce((acc, lead) => {
      acc[lead.source] = (acc[lead.source] || 0) + 1;
      return acc;
    }, {}),
  };
};

const getRevenueData = async (startDate, endDate) => {
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  const purchases = await Purchase.find({ ...dateFilter, status: "completed" })
    .select('amount type createdAt')
    .lean();

  return {
    totalRevenue: purchases.reduce((sum, p) => sum + (p.amount || 0), 0),
    totalTransactions: purchases.length,
    byType: purchases.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + (p.amount || 0);
      return acc;
    }, {}),
  };
};

const getPlacementData = async (startDate, endDate) => {
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  const placements = await Application.find({ ...dateFilter, status: "hired" })
    .populate('studentId', 'firstName lastName')
    .populate('jobId', 'title')
    .lean();

  return {
    totalPlacements: placements.length,
    placements: placements.map(p => ({
      student: p.studentId ? `${p.studentId.firstName} ${p.studentId.lastName}` : 'N/A',
      job: p.jobId?.title || 'N/A',
      date: p.createdAt,
    })),
  };
};

const getEmployerData = async (startDate, endDate) => {
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  const employers = await Employer.find(dateFilter)
    .select('companyName email status createdAt')
    .lean();

  return {
    totalEmployers: employers.length,
    activeEmployers: employers.filter(e => e.status === 'active').length,
    employers: employers.map(e => ({
      company: e.companyName,
      email: e.email,
      status: e.status,
      joinedAt: e.createdAt,
    })),
  };
};

const getCourseData = async (startDate, endDate) => {
  const courses = await Course.find()
    .select('title category status createdAt')
    .lean();

  return {
    totalCourses: courses.length,
    activeCourses: courses.filter(c => c.status === 'active').length,
    courses: courses.map(c => ({
      title: c.title,
      category: c.category,
      status: c.status,
      createdAt: c.createdAt,
    })),
  };
};

const getStaffData = async (startDate, endDate) => {
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  // Get staff activities (leads created, applications processed, etc.)
  const leads = await Lead.find(dateFilter).select('assignedTo').lean();
  const staffActivity = leads.reduce((acc, lead) => {
    if (lead.assignedTo) {
      acc[lead.assignedTo] = (acc[lead.assignedTo] || 0) + 1;
    }
    return acc;
  }, {});

  return {
    totalStaff: Object.keys(staffActivity).length,
    activities: staffActivity,
  };
};

// ==================== TOP EMPLOYERS ANALYTICS ====================
export const getTopEmployersByJobPosts = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const topEmployers = await Job.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: "users",
          localField: "employerId",
          foreignField: "_id",
          as: "employer",
        },
      },
      { $unwind: "$employer" },
      {
        $group: {
          _id: "$employer._id",
          name: { $first: { $concat: ["$employer.firstName", " ", "$employer.lastName"] } },
          email: { $first: "$employer.email" },
          jobPosts: { $sum: 1 },
          activeJobs: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          closedJobs: {
            $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] },
          },
        },
      },
      { $sort: { jobPosts: -1 } },
      { $limit: parseInt(limit) },
    ]);

    res.json({
      success: true,
      data: {
        topEmployers,
        count: topEmployers.length,
      },
    });
  } catch (error) {
    console.error("Error fetching top employers by job posts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch top employers by job posts",
      error: error.message,
    });
  }
};

export const getTopEmployersByApplications = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const topEmployers = await Application.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: "users",
          localField: "employerId",
          foreignField: "_id",
          as: "employer",
        },
      },
      { $unwind: "$employer" },
      {
        $group: {
          _id: "$employer._id",
          name: { $first: { $concat: ["$employer.firstName", " ", "$employer.lastName"] } },
          email: { $first: "$employer.email" },
          totalApplications: { $sum: 1 },
          hired: {
            $sum: { $cond: [{ $eq: ["$status", "hired"] }, 1, 0] },
          },
          rejected: {
            $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] },
          },
          interviewed: {
            $sum: { $cond: [{ $eq: ["$status", "interview"] }, 1, 0] },
          },
        },
      },
      {
        $addFields: {
          hireRate: {
            $cond: [
              { $gt: ["$totalApplications", 0] },
              {
                $multiply: [
                  { $divide: ["$hired", "$totalApplications"] },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
      { $sort: { totalApplications: -1 } },
      { $limit: parseInt(limit) },
    ]);

    res.json({
      success: true,
      data: {
        topEmployers,
        count: topEmployers.length,
      },
    });
  } catch (error) {
    console.error("Error fetching top employers by applications:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch top employers by applications",
      error: error.message,
    });
  }
};

// ==================== TOP COURSES ANALYTICS ====================
export const getTopCoursesByPerformance = async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const topCourses = await CourseProgress.aggregate([
      { $match: dateFilter },
      {
        $lookup: {
          from: "courses",
          localField: "courseId",
          foreignField: "_id",
          as: "course",
        },
      },
      { $unwind: "$course" },
      {
        $group: {
          _id: "$course._id",
          name: { $first: "$course.title" },
          category: { $first: "$course.category" },
          totalEnrolled: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          inProgress: {
            $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] },
          },
          avgProgress: { $avg: "$progress" },
        },
      },
      {
        $addFields: {
          completionRate: {
            $cond: [
              { $gt: ["$totalEnrolled", 0] },
              {
                $multiply: [
                  { $divide: ["$completed", "$totalEnrolled"] },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
      { $sort: { completionRate: -1, totalEnrolled: -1 } },
      { $limit: parseInt(limit) },
    ]);

    res.json({
      success: true,
      data: {
        topCourses,
        count: topCourses.length,
      },
    });
  } catch (error) {
    console.error("Error fetching top courses by performance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch top courses by performance",
      error: error.message,
    });
  }
};

const convertToCSV = (data) => {
  // Simple CSV conversion
  if (!data || typeof data !== "object") return "";

  const headers = Object.keys(data);
  const values = Object.values(data);

  return `${headers.join(",")}\n${values.join(",")}`;
};
