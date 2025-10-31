import mongoose from "mongoose";

const { Schema} = mongoose;

const videoResumeSchema = new Schema(
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
    videoUrl: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
    },
    duration: {
      type: Number, // in seconds
      required: true,
    },
    fileSize: {
      type: Number, // in bytes
    },
    // Settings
    isPrimary: {
      type: Boolean,
      default: false,
    },
    privacy: {
      type: String,
      enum: ["public", "private", "unlisted"],
      default: "public",
    },
    allowDownload: {
      type: Boolean,
      default: false,
    },
    drmEnabled: {
      type: Boolean,
      default: false, // Pro feature
    },
    watermarkEnabled: {
      type: Boolean,
      default: false, // Pro feature
    },
    // Template Info
    templateId: {
      type: String,
    },
    templateName: {
      type: String,
    },
    // Analytics
    views: {
      type: Number,
      default: 0,
    },
    uniqueViews: [
      {
        viewerId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
        duration: Number, // How long they watched in seconds
      },
    ],
    shares: {
      type: Number,
      default: 0,
    },
    // Editing Info (Pro feature)
    editHistory: [
      {
        action: String, // 'trim', 'merge', 'filter'
        timestamp: {
          type: Date,
          default: Date.now,
        },
        details: Schema.Types.Mixed,
      },
    ],
    // Transcription (Auto-generated)
    transcription: {
      type: String,
    },
    // Metadata
    tags: [String],
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
videoResumeSchema.index({ studentId: 1, isPrimary: 1 });
videoResumeSchema.index({ studentId: 1, createdAt: -1 });
videoResumeSchema.index({ privacy: 1 });

// Ensure only one primary video per student
videoResumeSchema.pre("save", async function (next) {
  if (this.isPrimary && this.isModified("isPrimary")) {
    await mongoose.model("VideoResume").updateMany(
      {
        studentId: this.studentId,
        _id: { $ne: this._id },
      },
      { isPrimary: false }
    );
  }
  next();
});

// Format duration for display
videoResumeSchema.virtual("formattedDuration").get(function () {
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
});

export const VideoResumeModel = mongoose.model("VideoResume", videoResumeSchema);
