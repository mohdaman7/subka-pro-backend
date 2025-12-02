// backend/src/models/SkillAcademyUser.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const skillAcademyUserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    phoneVerified: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    registrationDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Indexes for faster queries
skillAcademyUserSchema.index({ email: 1 });
skillAcademyUserSchema.index({ phone: 1 });
skillAcademyUserSchema.index({ isActive: 1 });

export const SkillAcademyUserModel = mongoose.model(
  "SkillAcademyUser",
  skillAcademyUserSchema
);
