// backend/src/middleware/plan.js
import { planLimits } from "../config/plan.js";
import { ApplicationModel } from "../models/Application.js";
import { JobModel } from "../models/Job.js";
import { StudentModel } from "../models/Student.js";
import { EmployerModel } from "../models/Employer.js";

export function requirePlan(requiredPlan) {
  return async (req, res, next) => {
    try {
      const role = req.user?.role;
      if (!role) return res.status(401).json({ success: false, message: "Unauthorized" });

      let plan = "free";
      if (role === "student") {
        const profile = await StudentModel.findOne({ userId: req.user.id }).select("plan");
        plan = profile?.plan || "free";
      } else if (role === "employer") {
        const profile = await EmployerModel.findOne({ userId: req.user.id }).select("plan");
        plan = profile?.plan || "free";
      }

      if (requiredPlan === "pro" && plan !== "pro") {
        return res.status(403).json({ success: false, message: "Feature requires Pro plan" });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export function limitByPlan(featureKey) {
  return async (req, res, next) => {
    try {
      const role = req.user?.role;
      if (!role) return res.status(401).json({ success: false, message: "Unauthorized" });

      if (role === "student" && featureKey === "apply_job") {
        const student = await StudentModel.findOne({ userId: req.user.id }).select("plan");
        const plan = student?.plan || "free";
        if (plan === "pro") return next();

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const count = await ApplicationModel.countDocuments({
          studentId: req.user.id,
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        });

        if (count >= planLimits.student.free.maxApplicationsPerMonth) {
          return res.status(403).json({ success: false, message: `Free plan limit reached (${planLimits.student.free.maxApplicationsPerMonth}/month)` });
        }
        return next();
      }

      if (role === "employer" && featureKey === "create_or_activate_job") {
        const employer = await EmployerModel.findOne({ userId: req.user.id }).select("plan");
        const plan = employer?.plan || "free";
        if (plan === "pro") return next();

        const activeJobs = await JobModel.countDocuments({ employerId: req.user.id, status: { $in: ["active", "draft"] } });
        if (activeJobs >= planLimits.employer.free.maxActiveJobs) {
          return res.status(403).json({ success: false, message: `Free plan allows only ${planLimits.employer.free.maxActiveJobs} active jobs` });
        }
        return next();
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
