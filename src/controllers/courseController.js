import mongoose from "mongoose";
import { CourseModel } from "../models/Course.js";
import { CourseAccessModel } from "../models/CourseAccess.js";
import { StudentModel } from "../models/Student.js";

function isObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function userHasFullAccessToParent(userId, parentCourseId) {
  const access = await CourseAccessModel.findOne({
    userId,
    courseId: parentCourseId,
    accessType: { $in: ["full_course", "bundle", "admin_grant"] },
  }).lean();
  return Boolean(access);
}

async function userHasAccessToModule(userId, moduleCourseId) {
  const access = await CourseAccessModel.findOne({
    userId,
    courseId: moduleCourseId,
    accessType: { $in: ["sub_course", "admin_grant"] },
  }).lean();
  return Boolean(access);
}

async function getUserPlan(userId) {
  const student = await StudentModel.findOne({ userId }).select("plan").lean();
  return student?.plan || "free";
}

export const courseController = {
  // Public listing: parent courses with aggregated child module count and pricing
  async listPublicCourses(req, res, next) {
    try {
      const pipeline = [
        { $match: { type: "parent", status: { $ne: "archived" } } },
        {
          $lookup: {
            from: "courses",
            localField: "_id",
            foreignField: "parentCourse",
            as: "modules",
          },
        },
        {
          $addFields: {
            moduleCount: { $size: "$modules" },
            sumModulePrice: {
              $sum: {
                $map: {
                  input: "$modules",
                  as: "m",
                  in: { $ifNull: ["$$m.pricing.individualPrice", 0] },
                },
              },
            },
            bundlePrice: { $ifNull: ["$pricing.bundlePrice", 0] },
          },
        },
        {
          $project: {
            title: 1,
            description: 1,
            category: 1,
            thumbnail: 1,
            instructor: 1,
            level: 1,
            tags: 1,
            status: 1,
            enrolledCount: 1,
            rating: 1,
            moduleCount: 1,
            sumModulePrice: 1,
            bundlePrice: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
        { $sort: { createdAt: -1 } },
      ];

      const courses = await CourseModel.aggregate(pipeline);
      return res.json({ success: true, data: courses });
    } catch (error) {
      next(error);
    }
  },

  // Public course details. If parent -> include modules. If module -> include lessons (filtered if not accessible)
  async getCourseById(req, res, next) {
    try {
      const { id } = req.params;
      if (!isObjectId(id))
        return res
          .status(400)
          .json({ success: false, message: "Invalid course id" });

      const course = await CourseModel.findById(id).lean();
      if (!course)
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });

      if (course.type === "parent") {
        const modules = await CourseModel.find({
          parentCourse: course._id,
          type: "module",
          status: { $ne: "archived" },
        })
          .select(
            "title description thumbnail pricing level enrolledCount rating lessons parentCourse status"
          )
          .lean();
        return res.json({ success: true, data: { ...course, modules } });
      }

      // For module courses, filter lessons based on access
      let canAccessAllLessons = false;
      const isAuthenticated = Boolean(req.user?.id);
      if (isAuthenticated) {
        const plan = await getUserPlan(req.user.id);
        if (plan === "pro") {
          canAccessAllLessons = true;
        } else {
          const hasDirect = await userHasAccessToModule(
            req.user.id,
            course._id
          );
          if (hasDirect) canAccessAllLessons = true;
          else if (course.parentCourse) {
            const hasFullParent = await userHasFullAccessToParent(
              req.user.id,
              course.parentCourse
            );
            if (hasFullParent) canAccessAllLessons = true;
          }
        }
      }

      const lessons = canAccessAllLessons
        ? course.lessons
        : course.lessons?.filter((l) => l.isFreePreview);

      return res.json({ success: true, data: { ...course, lessons } });
    } catch (error) {
      next(error);
    }
  },

  // Authenticated: my progress for a module course
  async getMyProgress(req, res, next) {
    try {
      const userId = req.user?.id;
      const { courseId } = req.params;
      if (!userId)
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      if (!isObjectId(courseId))
        return res
          .status(400)
          .json({ success: false, message: "Invalid course id" });

      const course = await CourseModel.findById(courseId).lean();
      if (!course)
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });
      if (course.type !== "module")
        return res.status(400).json({
          success: false,
          message: "Progress is tracked at module level",
        });

      const progress = await (
        await import("../models/CourseProgress.js")
      ).CourseProgressModel.findOne({ userId, courseId }).lean();
      const lessonsTotal = course.lessons?.length || 0;
      const completedCount = progress?.completedLessons?.length || 0;
      const percent =
        lessonsTotal > 0
          ? Math.round((completedCount / lessonsTotal) * 100)
          : 0;

      return res.json({
        success: true,
        data: {
          progress: progress || null,
          stats: { lessonsTotal, completedCount, percent },
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // Authenticated: mark a lesson as completed
  async completeLesson(req, res, next) {
    try {
      const userId = req.user?.id;
      const { courseId, lessonId } = req.params;
      if (!userId)
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      if (!isObjectId(courseId) || !isObjectId(lessonId))
        return res.status(400).json({ success: false, message: "Invalid ids" });

      const course = await CourseModel.findById(courseId).lean();
      if (!course)
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });
      if (course.type !== "module")
        return res.status(400).json({
          success: false,
          message: "Progress is tracked at module level",
        });
      const lessonExists = (course.lessons || []).some(
        (l) => l._id.toString() === lessonId
      );
      if (!lessonExists)
        return res.status(400).json({
          success: false,
          message: "Lesson does not belong to this course",
        });

      // Access check: pro plan, direct module, or full parent access
      let canAccessAllLessons = false;
      const plan = await getUserPlan(userId);
      if (plan === "pro") {
        canAccessAllLessons = true;
      } else {
        const hasDirect = await userHasAccessToModule(userId, course._id);
        if (hasDirect) canAccessAllLessons = true;
        else if (course.parentCourse) {
          const hasFullParent = await userHasFullAccessToParent(
            userId,
            course.parentCourse
          );
          if (hasFullParent) canAccessAllLessons = true;
        }
      }
      if (!canAccessAllLessons)
        return res.status(403).json({
          success: false,
          message: "No access to complete lessons for this course",
        });

      const { CourseProgressModel } = await import(
        "../models/CourseProgress.js"
      );
      const update = {
        $set: { lastLessonId: lessonId, lastAccessedAt: new Date() },
        $addToSet: { completedLessons: { lessonId, completedAt: new Date() } },
      };
      const options = { upsert: true, new: true, setDefaultsOnInsert: true };
      const progress = await CourseProgressModel.findOneAndUpdate(
        { userId, courseId },
        update,
        options
      ).lean();

      const lessonsTotal = course.lessons?.length || 0;
      const completedCount = progress?.completedLessons?.length || 0;
      const percent =
        lessonsTotal > 0
          ? Math.round((completedCount / lessonsTotal) * 100)
          : 0;

      return res.json({
        success: true,
        data: { progress, stats: { lessonsTotal, completedCount, percent } },
      });
    } catch (error) {
      next(error);
    }
  },

  // Authenticated: list my accesses (matrix)
  async listMyAccess(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId)
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      const accesses = await CourseAccessModel.find({ userId })
        .populate("courseId", "title type parentCourse")
        .sort({ createdAt: -1 })
        .lean();
      return res.json({ success: true, data: accesses });
    } catch (error) {
      next(error);
    }
  },

  // Authenticated: Recommendations for upgrades and related modules
  async getRecommendations(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId)
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });

      // Find parents where the user owns at least one module but not full access
      const ownedModuleAccesses = await CourseAccessModel.find({
        userId,
        accessType: { $in: ["sub_course", "gift"] },
      })
        .populate("courseId", "parentCourse pricing title")
        .lean();

      const groups = new Map(); // parentId -> { parentCourseId, ownedCount, ownedPriceSum }
      for (const access of ownedModuleAccesses) {
        const moduleCourse = access.courseId;
        if (!moduleCourse?.parentCourse) continue;
        const parentId = moduleCourse.parentCourse.toString();
        const record = groups.get(parentId) || {
          parentCourseId: moduleCourse.parentCourse,
          ownedCount: 0,
          ownedPriceSum: 0,
        };
        record.ownedCount += 1;
        record.ownedPriceSum += Number(
          moduleCourse.pricing?.individualPrice || 0
        );
        groups.set(parentId, record);
      }

      const recommendations = [];
      for (const [parentId, info] of groups.entries()) {
        const hasFull = await userHasFullAccessToParent(userId, parentId);
        if (hasFull) continue;
        const parent = await CourseModel.findById(parentId).lean();
        if (!parent) continue;

        // Compute remaining amount to upgrade
        const bundlePrice = Number(parent.pricing?.bundlePrice || 0);
        const remainingAmount = Math.max(0, bundlePrice - info.ownedPriceSum);
        recommendations.push({
          type: "upgrade_offer",
          parentCourseId: parent._id,
          parentTitle: parent.title,
          message: `Complete your ${parent.title}! Pay remaining ₹${remainingAmount} to unlock full access`,
          remainingAmount,
          bundlePrice,
          ownedModules: info.ownedCount,
        });
      }

      // Basic related purchase hint (static for now)
      return res.json({ success: true, data: recommendations });
    } catch (error) {
      next(error);
    }
  },

  // Admin: create parent course
  async adminCreateParentCourse(req, res, next) {
    try {
      const {
        title,
        description,
        category,
        thumbnail,
        instructor,
        level,
        bundlePrice,
        discountPercent,
        status,
      } = req.body;
      if (!title)
        return res
          .status(400)
          .json({ success: false, message: "Title is required" });
      const course = await CourseModel.create({
        title,
        description,
        category,
        thumbnail,
        instructor,
        level,
        type: "parent",
        pricing: {
          bundlePrice: Number(bundlePrice || 0),
          discountPercent: Number(discountPercent || 0),
        },
        status: status || "draft",
      });
      return res.status(201).json({ success: true, data: course });
    } catch (error) {
      next(error);
    }
  },

  // Admin: create sub-course (module)
  async adminCreateSubCourse(req, res, next) {
    try {
      const {
        parentCourseId,
        title,
        description,
        thumbnail,
        instructor,
        level,
        individualPrice,
        status,
        lessons,
      } = req.body;
      if (!isObjectId(parentCourseId))
        return res
          .status(400)
          .json({ success: false, message: "Valid parentCourseId required" });
      if (!title)
        return res
          .status(400)
          .json({ success: false, message: "Title is required" });

      const parent = await CourseModel.findOne({
        _id: parentCourseId,
        type: "parent",
      });
      if (!parent)
        return res
          .status(404)
          .json({ success: false, message: "Parent course not found" });

      const course = await CourseModel.create({
        parentCourse: parent._id,
        title,
        description,
        thumbnail,
        instructor,
        level,
        type: "module",
        pricing: { individualPrice: Number(individualPrice || 0) },
        lessons: Array.isArray(lessons)
          ? lessons.map((l, idx) => ({
              title: l.title,
              description: l.description,
              durationSec: Number(l.durationSec || 0),
              videoProvider: l.videoProvider || "youtube",
              videoId: l.videoId,
              videoUrl: l.videoUrl,
              isFreePreview: Boolean(l.isFreePreview),
              order: Number(l.order ?? idx),
            }))
          : [],
        status: status || "draft",
      });

      return res.status(201).json({ success: true, data: course });
    } catch (error) {
      next(error);
    }
  },

  // Admin: add lesson to module course
  async adminAddLesson(req, res, next) {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        durationSec,
        videoProvider,
        videoId,
        videoUrl,
        isFreePreview,
        order,
      } = req.body;
      if (!isObjectId(id))
        return res
          .status(400)
          .json({ success: false, message: "Invalid course id" });
      const course = await CourseModel.findById(id);
      if (!course)
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });
      if (course.type !== "module")
        return res.status(400).json({
          success: false,
          message: "Lessons can only be added to module courses",
        });

      course.lessons.push({
        title,
        description,
        durationSec: Number(durationSec || 0),
        videoProvider: videoProvider || "youtube",
        videoId,
        videoUrl,
        isFreePreview: Boolean(isFreePreview),
        order: Number(order || course.lessons.length),
      });
      await course.save();
      return res.status(201).json({ success: true, data: course });
    } catch (error) {
      next(error);
    }
  },

  // Admin: list all courses with hierarchy summary
  async adminListCourses(req, res, next) {
    try {
      console.log("=== ADMIN LIST COURSES CALLED ===");

      // Get all parent courses
      const parentCourses = await CourseModel.find({ type: "parent" })
        .sort({ createdAt: -1 })
        .lean();

      // For each parent course, find its modules and format the response
      const formattedCourses = await Promise.all(
        parentCourses.map(async (parent) => {
          const modules = await CourseModel.find({
            parentCourse: parent._id,
            type: "module",
          }).lean();

          // Return the format that frontend expects
          return {
            _id: parent._id,
            title: parent.title,
            description: parent.description,
            category: parent.category,
            thumbnail: parent.thumbnail,
            instructor: parent.instructor,
            level: parent.level,
            type: parent.type,
            status: parent.status,
            enrolledCount: parent.enrolledCount || 0,
            rating: parent.rating || 0,
            // Frontend expects these fields
            modules: modules || [],
            pricing: {
              bundlePrice: parent.pricing?.bundlePrice || 0,
              discountPercent: parent.pricing?.discountPercent || 0,
            },
            createdAt: parent.createdAt,
            updatedAt: parent.updatedAt,
          };
        })
      );

      console.log(`Found ${formattedCourses.length} courses`);
      console.log(
        "Formatted courses:",
        formattedCourses.map((c) => ({
          id: c._id,
          title: c.title,
          type: c.type,
          modulesCount: c.modules?.length || 0,
          bundlePrice: c.pricing?.bundlePrice || 0,
        }))
      );

      return res.json({ success: true, data: formattedCourses });
    } catch (error) {
      console.error("Error in adminListCourses:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  },

  // Admin: list access matrix with optional filters
  async adminListAccessMatrix(req, res, next) {
    try {
      const { userId, courseId, accessType } = req.query;
      const filter = {};
      if (userId && isObjectId(userId)) filter.userId = userId;
      if (courseId && isObjectId(courseId)) filter.courseId = courseId;
      if (accessType) filter.accessType = accessType;

      const accesses = await CourseAccessModel.find(filter)
        .populate("userId", "firstName lastName email")
        .populate("courseId", "title type parentCourse")
        .sort({ createdAt: -1 })
        .lean();
      return res.json({ success: true, data: accesses });
    } catch (error) {
      next(error);
    }
  },

  // Admin: grant access to a user
  async adminGrantAccess(req, res, next) {
    try {
      const { userId, courseId, accessType, expiresAt, notes } = req.body;
      if (!isObjectId(userId) || !isObjectId(courseId))
        return res.status(400).json({
          success: false,
          message: "Valid userId and courseId required",
        });
      if (
        !accessType ||
        ![
          "sub_course",
          "full_course",
          "bundle",
          "admin_grant",
          "gift",
        ].includes(accessType)
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid accessType" });
      }
      const course = await CourseModel.findById(courseId).lean();
      if (!course)
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });

      const access = await CourseAccessModel.create({
        userId,
        courseId,
        accessType,
        expiresAt: expiresAt || null,
        notes,
      });
      return res.status(201).json({ success: true, data: access });
    } catch (error) {
      next(error);
    }
  },

  // Admin: revoke access by id
  async adminRevokeAccess(req, res, next) {
    try {
      const { id } = req.params;
      if (!isObjectId(id))
        return res.status(400).json({ success: false, message: "Invalid id" });
      const removed = await CourseAccessModel.findByIdAndDelete(id);
      if (!removed)
        return res
          .status(404)
          .json({ success: false, message: "Access not found" });
      return res.json({ success: true, message: "Access revoked" });
    } catch (error) {
      next(error);
    }
  },

  // Admin: update course
  async adminUpdateCourse(req, res, next) {
    try {
      const { id } = req.params;
      if (!isObjectId(id))
        return res.status(400).json({ success: false, message: "Invalid id" });
      const update = { ...req.body };
      // Prevent changing type and parentCourse arbitrarily through this endpoint
      delete update.type;
      const course = await CourseModel.findByIdAndUpdate(id, update, {
        new: true,
      });
      if (!course)
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });
      return res.json({ success: true, data: course });
    } catch (error) {
      next(error);
    }
  },

  // Admin: delete course
  async adminDeleteCourse(req, res, next) {
    try {
      const { id } = req.params;
      if (!isObjectId(id))
        return res.status(400).json({ success: false, message: "Invalid id" });

      const course = await CourseModel.findById(id);
      if (!course)
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });
      if (course.type === "parent") {
        const modulesCount = await CourseModel.countDocuments({
          parentCourse: id,
        });
        if (modulesCount > 0)
          return res.status(400).json({
            success: false,
            message: "Delete or reassign sub-courses first",
          });
      }
      await CourseModel.findByIdAndDelete(id);
      return res.json({ success: true, message: "Course deleted" });
    } catch (error) {
      next(error);
    }
  },

  // Admin: update a specific lesson
  async adminUpdateLesson(req, res, next) {
    try {
      const { id, lessonId } = req.params;
      const {
        title,
        description,
        durationSec,
        videoProvider,
        videoId,
        videoUrl,
        isFreePreview,
        order,
      } = req.body;

      if (!isObjectId(id) || !isObjectId(lessonId))
        return res.status(400).json({ success: false, message: "Invalid ids" });

      const course = await CourseModel.findById(id);
      if (!course)
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });
      if (course.type !== "module")
        return res.status(400).json({
          success: false,
          message: "Lessons can only be updated in module courses",
        });

      const lessonIndex = course.lessons.findIndex(
        (l) => l._id.toString() === lessonId
      );
      if (lessonIndex === -1)
        return res
          .status(404)
          .json({ success: false, message: "Lesson not found" });

      // Update lesson fields
      if (title !== undefined) course.lessons[lessonIndex].title = title;
      if (description !== undefined)
        course.lessons[lessonIndex].description = description;
      if (durationSec !== undefined)
        course.lessons[lessonIndex].durationSec = Number(durationSec);
      if (videoProvider !== undefined)
        course.lessons[lessonIndex].videoProvider = videoProvider;
      if (videoId !== undefined) course.lessons[lessonIndex].videoId = videoId;
      if (videoUrl !== undefined)
        course.lessons[lessonIndex].videoUrl = videoUrl;
      if (isFreePreview !== undefined)
        course.lessons[lessonIndex].isFreePreview = Boolean(isFreePreview);
      if (order !== undefined)
        course.lessons[lessonIndex].order = Number(order);

      await course.save();
      return res.json({ success: true, data: course });
    } catch (error) {
      next(error);
    }
  },

  // Admin: delete a specific lesson
  async adminDeleteLesson(req, res, next) {
    try {
      const { id, lessonId } = req.params;
      if (!isObjectId(id) || !isObjectId(lessonId))
        return res.status(400).json({ success: false, message: "Invalid ids" });

      const course = await CourseModel.findById(id);
      if (!course)
        return res
          .status(404)
          .json({ success: false, message: "Course not found" });
      if (course.type !== "module")
        return res.status(400).json({
          success: false,
          message: "Lessons can only be deleted from module courses",
        });

      const lessonIndex = course.lessons.findIndex(
        (l) => l._id.toString() === lessonId
      );
      if (lessonIndex === -1)
        return res
          .status(404)
          .json({ success: false, message: "Lesson not found" });

      course.lessons.splice(lessonIndex, 1);
      await course.save();
      return res.json({
        success: true,
        message: "Lesson deleted",
        data: course,
      });
    } catch (error) {
      next(error);
    }
  },
};
