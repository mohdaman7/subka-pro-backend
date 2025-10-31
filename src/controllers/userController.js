// backend/src/controllers/userController.js
import bcrypt from "bcryptjs";
import { z } from "zod";
import { UserModel } from "../models/User.js";
import { StudentModel } from "../models/Student.js";
import { EmployerModel } from "../models/Employer.js";

export const updateProfileSchema = z.object({}).passthrough();

export async function getProfile(req, res, next) {
  try {
    const user = await UserModel.findById(req.user.id).select(
      "firstName lastName email role status profileCompleted"
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    let profile = null;
    if (user.role === "student") {
      profile = await StudentModel.findOne({ userId: user._id });
    } else if (user.role === "employer") {
      profile = await EmployerModel.findOne({ userId: user._id });
    }

    res.json({ success: true, data: { user, profile } });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const parsed = updateProfileSchema.parse(req.body);

    let updatedProfile = null;
    if (req.user.role === "student") {
      updatedProfile = await StudentModel.findOneAndUpdate(
        { userId: req.user.id },
        { $set: parsed },
        { new: true, runValidators: true }
      );
    } else if (req.user.role === "employer") {
      updatedProfile = await EmployerModel.findOneAndUpdate(
        { userId: req.user.id },
        { $set: parsed },
        { new: true, runValidators: true }
      );
    }

    if (!updatedProfile) {
      return res
        .status(404)
        .json({ success: false, message: "Profile not found" });
    }

    await UserModel.findByIdAndUpdate(req.user.id, { profileCompleted: true });

    res.json({ success: true, data: updatedProfile, message: "Profile updated" });
  } catch (err) {
    next(err);
  }
}

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6),
});

export async function changePassword(req, res, next) {
  try {
    const parsed = changePasswordSchema.parse(req.body);
    const user = await UserModel.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const valid = await bcrypt.compare(parsed.currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ success: false, message: "Current password is incorrect" });

    const hash = await bcrypt.hash(parsed.newPassword, 10);
    user.passwordHash = hash;
    await user.save();

    res.json({ success: true, message: "Password updated" });
  } catch (err) {
    next(err);
  }
}

export async function uploadProfilePicture(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    let updated = null;
    if (req.user.role === "student") {
      updated = await StudentModel.findOneAndUpdate(
        { userId: req.user.id },
        { $set: { profilePicture: { filename: req.file.originalname, url: fileUrl, uploadedAt: new Date() } } },
        { new: true }
      );
    } else if (req.user.role === "employer") {
      updated = await EmployerModel.findOneAndUpdate(
        { userId: req.user.id },
        { $set: { "company.logo": { filename: req.file.originalname, url: fileUrl, uploadedAt: new Date() } } },
        { new: true }
      );
    }

    if (!updated) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    res.json({ success: true, data: updated, message: "Profile picture updated" });
  } catch (err) {
    next(err);
  }
}

export async function uploadResume(req, res, next) {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    // Basic server-side validation for resume file types
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Please upload PDF, DOC, or DOCX files only",
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    // Only students can upload resumes for now
    if (req.user.role !== "student") {
      return res
        .status(403)
        .json({ success: false, message: "Only students can upload resumes" });
    }

    const updated = await StudentModel.findOneAndUpdate(
      { userId: req.user.id },
      {
        $set: {
          resume: {
            filename: req.file.filename,
            originalName: req.file.originalname,
            url: fileUrl,
            uploadedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Student profile not found" });
    }

    return res.json({
      success: true,
      data: { url: fileUrl },
      message: "Resume uploaded successfully",
    });
  } catch (err) {
    next(err);
  }
}
