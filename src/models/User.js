// backend/src/models/User.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["student", "employer", "admin"],
      required: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "active", "inactive", "suspended", "rejected"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
      index: true,
    },
    passwordChangedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ status: 1 });
userSchema.index({ role: 1, status: 1 });

// Virtual relation to Employer profile (one-to-one via userId)
userSchema.virtual("employerProfile", {
  ref: "Employer",
  localField: "_id",
  foreignField: "userId",
  justOne: true,
});

// Ensure virtuals are included in outputs
userSchema.set("toObject", { virtuals: true });
userSchema.set("toJSON", { virtuals: true });

export const UserModel = mongoose.model("User", userSchema);
