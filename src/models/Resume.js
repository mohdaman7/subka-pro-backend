import mongoose from "mongoose";

const { Schema } = mongoose;

const resumeSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["ats", "custom"],
      default: "ats",
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number, // in bytes
    },
    // ATS Analysis
    atsScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    keywords: [
      {
        word: String,
        frequency: Number,
        relevance: Number, // 0-100
      },
    ],
    suggestions: [
      {
        category: String, // 'format', 'content', 'keywords', 'experience'
        message: String,
        priority: String, // 'high', 'medium', 'low'
      },
    ],
    // Parsed Data
    parsedData: {
      contact: {
        email: String,
        phone: String,
        linkedin: String,
        portfolio: String,
      },
      summary: String,
      experience: [
        {
          title: String,
          company: String,
          duration: String,
          description: String,
        },
      ],
      education: [
        {
          degree: String,
          institution: String,
          year: String,
        },
      ],
      skills: [String],
      certifications: [String],
    },
    // Settings
    isPrimary: {
      type: Boolean,
      default: false,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    // Analytics
    views: {
      type: Number,
      default: 0,
    },
    downloads: {
      type: Number,
      default: 0,
    },
    appliedJobs: [
      {
        jobId: {
          type: Schema.Types.ObjectId,
          ref: "Job",
        },
        appliedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Template Info
    templateId: {
      type: String,
    },
    templateName: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
resumeSchema.index({ studentId: 1, isPrimary: 1 });
resumeSchema.index({ studentId: 1, createdAt: -1 });
resumeSchema.index({ atsScore: -1 });

// Ensure only one primary resume per student
resumeSchema.pre("save", async function (next) {
  if (this.isPrimary && this.isModified("isPrimary")) {
    await mongoose.model("Resume").updateMany(
      {
        studentId: this.studentId,
        _id: { $ne: this._id },
      },
      { isPrimary: false }
    );
  }
  next();
});

export const ResumeModel = mongoose.model("Resume", resumeSchema);
