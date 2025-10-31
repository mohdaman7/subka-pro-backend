// controllers/uploadController.js
import multer from "multer";
import path from "path";
import { StudentModel } from "../models/Student.js";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const fileFilter = (req, file, cb) => {
  // Check file types
  if (file.fieldname === "profilePicture") {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for profile pictures"), false);
    }
  } else if (file.fieldname === "resume") {
    const allowedTypes = [".pdf", ".doc", ".docx"];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(
        new Error("Only PDF, DOC, and DOCX files are allowed for resumes"),
        false
      );
    }
  } else {
    cb(new Error("Invalid file type"), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Upload profile picture
export const uploadProfilePicture = [
  upload.single("profilePicture"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      const student = await StudentModel.findOneAndUpdate(
        { userId: req.user.id },
        {
          $set: {
            profilePicture: {
              url: `/uploads/${req.file.filename}`,
              uploadedAt: new Date(),
            },
          },
        },
        { new: true }
      );

      if (!student) {
        return res
          .status(404)
          .json({ success: false, message: "Student profile not found" });
      }

      res.json({
        success: true,
        data: {
          profilePicture: student.profilePicture,
        },
        message: "Profile picture uploaded successfully",
      });
    } catch (error) {
      next(error);
    }
  },
];

// Upload resume
export const uploadResume = [
  upload.single("resume"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "No file uploaded" });
      }

      const student = await StudentModel.findOneAndUpdate(
        { userId: req.user.id },
        {
          $set: {
            resume: {
              url: `/uploads/${req.file.filename}`,
              originalName: req.file.originalname,
              uploadedAt: new Date(),
            },
          },
        },
        { new: true }
      );

      if (!student) {
        return res
          .status(404)
          .json({ success: false, message: "Student profile not found" });
      }

      res.json({
        success: true,
        data: {
          resume: student.resume,
        },
        message: "Resume uploaded successfully",
      });
    } catch (error) {
      next(error);
    }
  },
];
