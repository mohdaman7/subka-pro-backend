import mongoose from "mongoose";

const { Schema } = mongoose;

const courseAccessSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Can be parent course (for full access) or module course (for individual access)
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    accessType: {
      type: String,
      enum: ["sub_course", "full_course", "bundle", "gift", "admin_grant"],
      required: true,
    },
    purchaseId: { type: Schema.Types.ObjectId, ref: "Purchase" },
    grantedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    notes: { type: String },
  },
  { timestamps: true }
);

courseAccessSchema.index({ userId: 1, courseId: 1 }, { unique: false });

export const CourseAccessModel = mongoose.model("CourseAccess", courseAccessSchema);
