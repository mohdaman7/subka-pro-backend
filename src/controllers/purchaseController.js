import mongoose from "mongoose";
import { CourseModel } from "../models/Course.js";
import { CourseAccessModel } from "../models/CourseAccess.js";
import { PurchaseModel } from "../models/Purchase.js";
import { StudentModel } from "../models/Student.js";

function isObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function generateInvoiceNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${y}${m}${d}-${rand}`;
}

async function getUserPlan(userId) {
  const student = await StudentModel.findOne({ userId }).select("plan").lean();
  return student?.plan || "free";
}

export const purchaseController = {
  async createPurchase(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

      const { type, courseId, moduleCourseId, billingName, billingEmail, billingAddress, recipientUserId } = req.body;
      if (!type) return res.status(400).json({ success: false, message: "type is required" });

      let amount = 0;
      let currency = "INR";
      let createdAccess = null;
      let courseRef = null;

      if (type === "sub_course") {
        if (!isObjectId(moduleCourseId)) return res.status(400).json({ success: false, message: "moduleCourseId required" });
        const moduleCourse = await CourseModel.findById(moduleCourseId).lean();
        if (!moduleCourse || moduleCourse.type !== "module") return res.status(404).json({ success: false, message: "Module course not found" });

        // If user already has access (direct or via full parent), do not allow duplicate purchase
        const plan = await getUserPlan(userId);
        if (plan === "pro") return res.status(400).json({ success: false, message: "You already have Pro access" });
        const hasDirect = await CourseAccessModel.findOne({ userId, courseId: moduleCourse._id });
        if (hasDirect) return res.status(400).json({ success: false, message: "You already own this module" });
        if (moduleCourse.parentCourse) {
          const hasFull = await CourseAccessModel.findOne({ userId, courseId: moduleCourse.parentCourse, accessType: { $in: ["full_course", "bundle", "admin_grant"] } });
          if (hasFull) return res.status(400).json({ success: false, message: "You already have full course access" });
        }

        amount = Number(moduleCourse.pricing?.individualPrice || 0);
        courseRef = moduleCourse;

        const purchase = await PurchaseModel.create({
          userId,
          type,
          courseId: moduleCourse._id,
          parentCourseId: moduleCourse.parentCourse || undefined,
          amount,
          currency,
          status: "paid",
          invoice: {
            invoiceNumber: generateInvoiceNumber(),
            billingName: billingName || "",
            billingEmail: billingEmail || "",
            billingAddress: billingAddress || "",
            amount,
            currency,
          },
        });

        createdAccess = await CourseAccessModel.create({
          userId,
          courseId: moduleCourse._id,
          accessType: "sub_course",
          purchaseId: purchase._id,
        });

        return res.status(201).json({ success: true, data: { purchase, access: createdAccess } });
      }

      if (type === "full_course") {
        if (!isObjectId(courseId)) return res.status(400).json({ success: false, message: "courseId (parent) required" });
        const parentCourse = await CourseModel.findById(courseId).lean();
        if (!parentCourse || parentCourse.type !== "parent") return res.status(404).json({ success: false, message: "Parent course not found" });

        const plan = await getUserPlan(userId);
        if (plan === "pro") return res.status(400).json({ success: false, message: "You already have Pro access" });

        // If already has full access, no need
        const hasFull = await CourseAccessModel.findOne({ userId, courseId: parentCourse._id, accessType: { $in: ["full_course", "bundle", "admin_grant"] } });
        if (hasFull) return res.status(400).json({ success: false, message: "You already have full access" });

        const modules = await CourseModel.find({ parentCourse: parentCourse._id, type: "module" }).select("_id pricing.individualPrice").lean();
        const ownedModules = await CourseAccessModel.find({ userId, accessType: { $in: ["sub_course", "gift"] }, courseId: { $in: modules.map((m) => m._id) } }).lean();
        const ownedPriceSum = modules
          .filter((m) => ownedModules.some((o) => o.courseId.toString() === m._id.toString()))
          .reduce((sum, m) => sum + Number(m.pricing?.individualPrice || 0), 0);
        const bundlePrice = Number(parentCourse.pricing?.bundlePrice || 0);
        amount = Math.max(0, bundlePrice - ownedPriceSum);
        courseRef = parentCourse;

        const purchase = await PurchaseModel.create({
          userId,
          type,
          courseId: parentCourse._id,
          amount,
          currency,
          status: "paid",
          invoice: {
            invoiceNumber: generateInvoiceNumber(),
            billingName: billingName || "",
            billingEmail: billingEmail || "",
            billingAddress: billingAddress || "",
            amount,
            currency,
          },
          metadata: { ownedPriceSum, bundlePrice },
        });

        createdAccess = await CourseAccessModel.create({
          userId,
          courseId: parentCourse._id,
          accessType: "full_course",
          purchaseId: purchase._id,
        });

        return res.status(201).json({ success: true, data: { purchase, access: createdAccess } });
      }

      if (type === "gift") {
        if (!isObjectId(moduleCourseId) && !isObjectId(courseId)) return res.status(400).json({ success: false, message: "Provide courseId (parent) or moduleCourseId" });
        if (!isObjectId(recipientUserId)) return res.status(400).json({ success: false, message: "recipientUserId required" });

        let targetCourse = null;
        let accessType = "gift";
        if (courseId) {
          const parentCourse = await CourseModel.findById(courseId).lean();
          if (!parentCourse || parentCourse.type !== "parent") return res.status(404).json({ success: false, message: "Parent course not found" });
          amount = Number(parentCourse.pricing?.bundlePrice || 0);
          targetCourse = parentCourse;
        } else if (moduleCourseId) {
          const moduleCourse = await CourseModel.findById(moduleCourseId).lean();
          if (!moduleCourse || moduleCourse.type !== "module") return res.status(404).json({ success: false, message: "Module course not found" });
          amount = Number(moduleCourse.pricing?.individualPrice || 0);
          targetCourse = moduleCourse;
        }

        const purchase = await PurchaseModel.create({
          userId,
          type: "gift",
          courseId: targetCourse._id,
          amount,
          currency,
          status: "paid",
          invoice: {
            invoiceNumber: generateInvoiceNumber(),
            billingName: billingName || "",
            billingEmail: billingEmail || "",
            billingAddress: billingAddress || "",
            amount,
            currency,
          },
          giftedToUserId: recipientUserId,
        });

        createdAccess = await CourseAccessModel.create({
          userId: recipientUserId,
          courseId: targetCourse._id,
          accessType: targetCourse.type === "parent" ? "full_course" : "sub_course",
          purchaseId: purchase._id,
        });

        return res.status(201).json({ success: true, data: { purchase, access: createdAccess } });
      }

      return res.status(400).json({ success: false, message: "Unsupported purchase type" });
    } catch (error) {
      next(error);
    }
  },

  async listMyPurchases(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
      const purchases = await PurchaseModel.find({ userId }).sort({ createdAt: -1 }).lean();
      return res.json({ success: true, data: purchases });
    } catch (error) {
      next(error);
    }
  },

  async getInvoice(req, res, next) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
      if (!isObjectId(id)) return res.status(400).json({ success: false, message: "Invalid id" });
      const purchase = await PurchaseModel.findOne({ _id: id, userId }).lean();
      if (!purchase) return res.status(404).json({ success: false, message: "Not found" });
      return res.json({ success: true, data: purchase.invoice });
    } catch (error) {
      next(error);
    }
  },
};
