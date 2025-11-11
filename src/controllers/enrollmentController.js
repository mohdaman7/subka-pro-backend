import { CourseEnrollment } from "../models/CourseEnrollment.js";
import { CourseModel } from "../models/Course.js";
import { StudentModel as Student } from "../models/Student.js";
import mongoose from "mongoose";

// ==================== STUDENT ENROLLMENT ====================

// Enroll in a course
export const enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const studentId = req.user?.id || req.user?._id;

    const course = await CourseModel.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    if (course.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "This course is not available for enrollment",
      });
    }

    const existingEnrollment = await CourseEnrollment.findOne({
      studentId,
      courseId,
    });

    if (existingEnrollment) {
      return res.status(400).json({
        success: false,
        message: "You are already enrolled in this course",
        enrollment: existingEnrollment,
      });
    }

    const enrollment = await CourseEnrollment.create({
      studentId,
      courseId,
      status: "enrolled",
      enrolledAt: new Date(),
    });

    await CourseModel.findByIdAndUpdate(courseId, {
      $inc: { enrolledCount: 1 },
    });

    const populatedEnrollment = await CourseEnrollment.findById(enrollment._id)
      .populate("courseId", "title description thumbnail instructor category level")
      .lean();

    res.status(201).json({
      success: true,
      message: "Successfully enrolled in the course!",
      enrollment: populatedEnrollment,
    });
  } catch (error) {
    console.error("Error enrolling in course:", error);
    res.status(500).json({
      success: false,
      message: "Failed to enroll in course",
      error: error.message,
    });
  }
};

// Get student's enrollments
export const getMyEnrollments = async (req, res) => {
  try {
    const studentId = req.user?.id || req.user?._id;
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { studentId };
    if (status) filter.status = status;

    const skip = (page - 1) * limit;

    const [enrollments, total] = await Promise.all([
      CourseEnrollment.find(filter)
        .populate("courseId", "title description thumbnail instructor category level pricing lessons")
        .sort({ enrolledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      CourseEnrollment.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        enrollments,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching enrollments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch enrollments",
      error: error.message,
    });
  }
};

// Get single enrollment details
export const getEnrollmentDetails = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const studentId = req.user?.id || req.user?._id;

    const enrollment = await CourseEnrollment.findOne({
      _id: enrollmentId,
      studentId,
    })
      .populate("courseId")
      .lean();

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    res.json({
      success: true,
      data: enrollment,
    });
  } catch (error) {
    console.error("Error fetching enrollment details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch enrollment details",
      error: error.message,
    });
  }
};

// Update enrollment progress
export const updateEnrollmentProgress = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { lessonId, progress } = req.body;
    const studentId = req.user?.id || req.user?._id;

    const enrollment = await CourseEnrollment.findOne({
      _id: enrollmentId,
      studentId,
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    if (lessonId) {
      const alreadyCompleted = enrollment.completedLessons.some(
        (lesson) => lesson.lessonId.toString() === lessonId
      );

      if (!alreadyCompleted) {
        enrollment.completedLessons.push({
          lessonId,
          completedAt: new Date(),
        });
      }
    }

    if (progress !== undefined) {
      enrollment.progress = Math.min(100, Math.max(0, progress));
      
      if (enrollment.progress === 100 && enrollment.status !== "completed") {
        enrollment.status = "completed";
        enrollment.completedAt = new Date();
      } else if (enrollment.progress > 0 && enrollment.status === "enrolled") {
        enrollment.status = "in_progress";
      }
    }

    enrollment.lastAccessedAt = new Date();
    await enrollment.save();

    const updatedEnrollment = await CourseEnrollment.findById(enrollmentId)
      .populate("courseId")
      .lean();

    res.json({
      success: true,
      message: "Progress updated successfully",
      enrollment: updatedEnrollment,
    });
  } catch (error) {
    console.error("Error updating enrollment progress:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update progress",
      error: error.message,
    });
  }
};

// Drop/Unenroll from course
export const dropCourse = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const studentId = req.user?.id || req.user?._id;

    const enrollment = await CourseEnrollment.findOne({
      _id: enrollmentId,
      studentId,
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: "Enrollment not found",
      });
    }

    enrollment.status = "dropped";
    await enrollment.save();

    await CourseModel.findByIdAndUpdate(enrollment.courseId, {
      $inc: { enrolledCount: -1 },
    });

    res.json({
      success: true,
      message: "Successfully dropped from the course",
    });
  } catch (error) {
    console.error("Error dropping course:", error);
    res.status(500).json({
      success: false,
      message: "Failed to drop course",
      error: error.message,
    });
  }
};

// Check enrollment status
export const checkEnrollmentStatus = async (req, res) => {
  try {
    const { courseId } = req.params;
    const studentId = req.user?.id || req.user?._id;

    const enrollment = await CourseEnrollment.findOne({
      studentId,
      courseId,
    }).lean();

    res.json({
      success: true,
      data: {
        isEnrolled: !!enrollment,
        enrollment: enrollment || null,
      },
    });
  } catch (error) {
    console.error("Error checking enrollment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check enrollment status",
      error: error.message,
    });
  }
};

// ==================== CRM/ADMIN ENDPOINTS ====================

// Get all enrollments (CRM)
export const getAllEnrollments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      courseId,
      search,
      startDate,
      endDate,
    } = req.query;

    const filter = {};
    
    if (status) filter.status = status;
    if (courseId) filter.courseId = courseId;
    
    if (startDate || endDate) {
      filter.enrolledAt = {};
      if (startDate) filter.enrolledAt.$gte = new Date(startDate);
      if (endDate) filter.enrolledAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    if (search) {
      const students = await Student.find({
        $or: [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      filter.studentId = { $in: students.map((s) => s._id) };
    }

    const [enrollments, total] = await Promise.all([
      CourseEnrollment.find(filter)
        .populate("studentId", "firstName lastName email phone")
        .populate("courseId", "title category instructor level")
        .sort({ enrolledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      CourseEnrollment.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        enrollments,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching all enrollments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch enrollments",
      error: error.message,
    });
  }
};

// Get enrollment stats for a course (CRM)
export const getCourseEnrollmentStats = async (req, res) => {
  try {
    const { courseId } = req.params;

    const stats = await CourseEnrollment.aggregate([
      { $match: { courseId: new mongoose.Types.ObjectId(courseId) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          avgProgress: { $avg: "$progress" },
        },
      },
    ]);

    const totalEnrollments = await CourseEnrollment.countDocuments({ courseId });
    const completionRate = stats.find((s) => s._id === "completed")?.count || 0;

    res.json({
      success: true,
      data: {
        totalEnrollments,
        completionRate: totalEnrollments > 0 ? (completionRate / totalEnrollments) * 100 : 0,
        byStatus: stats,
      },
    });
  } catch (error) {
    console.error("Error fetching course enrollment stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch enrollment stats",
      error: error.message,
    });
  }
};

// Get top enrolled courses (CRM)
export const getTopEnrolledCourses = async (req, res) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.enrolledAt = {};
      if (startDate) dateFilter.enrolledAt.$gte = new Date(startDate);
      if (endDate) dateFilter.enrolledAt.$lte = new Date(endDate);
    }

    const topCourses = await CourseEnrollment.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: "$courseId",
          totalEnrollments: { $sum: 1 },
          activeEnrollments: {
            $sum: {
              $cond: [
                { $in: ["$status", ["enrolled", "in_progress"]] },
                1,
                0,
              ],
            },
          },
          completedEnrollments: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          avgProgress: { $avg: "$progress" },
        },
      },
      {
        $lookup: {
          from: "courses",
          localField: "_id",
          foreignField: "_id",
          as: "course",
        },
      },
      { $unwind: "$course" },
      {
        $project: {
          courseId: "$_id",
          title: "$course.title",
          category: "$course.category",
          instructor: "$course.instructor",
          thumbnail: "$course.thumbnail",
          totalEnrollments: 1,
          activeEnrollments: 1,
          completedEnrollments: 1,
          avgProgress: 1,
          completionRate: {
            $cond: [
              { $gt: ["$totalEnrollments", 0] },
              {
                $multiply: [
                  { $divide: ["$completedEnrollments", "$totalEnrollments"] },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
      { $sort: { totalEnrollments: -1 } },
      { $limit: parseInt(limit) },
    ]);

    res.json({
      success: true,
      data: topCourses,
    });
  } catch (error) {
    console.error("Error fetching top enrolled courses:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch top enrolled courses",
      error: error.message,
    });
  }
};
