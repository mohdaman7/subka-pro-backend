import mongoose from "mongoose";

const { Schema } = mongoose;

const jobSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    employerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    jobType: {
      type: String,
      enum: ["Full-time", "Part-time", "Contract", "Internship", "Freelance"],
      required: true,
    },
    workMode: {
      type: String,
      enum: ["On-site", "Remote", "Hybrid"],
      required: true,
    },
    experience: {
      type: String,
      required: true,
    },
    education: {
      type: String,
      required: true,
    },
    salary: {
      type: String,
      required: true,
    },
    vacancies: {
      type: Number,
      required: true,
      min: 1,
    },
    deadline: {
      type: String, // Change to String to accept ISO string dates
      required: true,
    },
    skills: [
      {
        type: String,
        trim: true,
      },
    ],
    responsibilities: {
      type: String,
      required: true,
    },
    requirements: {
      type: String,
    },
    status: {
      type: String,
      enum: ["draft", "active", "paused", "closed"],
      default: "draft",
    },
    applications: [
      {
        type: Schema.Types.ObjectId,
        ref: "Application",
      },
    ],
    // Moderation fields for admin review and content analysis
    moderation: {
      approvalStatus: {
        type: String,
        enum: ["pending", "approved", "rejected", "needs_changes"],
        default: "pending",
        index: true,
      },
      reviewerId: { type: Schema.Types.ObjectId, ref: "User" },
      reviewedAt: { type: Date },
      rejectionReason: { type: String },
      requestChangesNote: { type: String },
      spamScore: { type: Number, default: 0, min: 0, max: 1 },
      flags: [
        {
          type: String,
          enum: [
            "suspicious_link",
            "profanity",
            "contact_info",
            "salary_outlier",
            "short_description",
            "caps_overuse",
            "blacklisted_term",
          ],
        },
      ],
      lastAnalyzedAt: { type: Date },
      autoFlagged: { type: Boolean, default: false },
      notes: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for formatted deadline date
jobSchema.virtual("deadlineDate").get(function () {
  return this.deadline ? new Date(this.deadline) : null;
});

// Ensure virtual fields are serialized
jobSchema.set("toJSON", { virtuals: true });
jobSchema.set("toObject", { virtuals: true });

// Index for better query performance
jobSchema.index({ employerId: 1, createdAt: -1 });
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ location: 1, jobType: 1 });
jobSchema.index({ "moderation.approvalStatus": 1, createdAt: -1 });

export const JobModel = mongoose.model("Job", jobSchema);
