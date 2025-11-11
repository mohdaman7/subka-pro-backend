import mongoose from "mongoose";

const { Schema } = mongoose;

const courseEnrollmentSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["enrolled", "in_progress", "completed", "dropped"],
      default: "enrolled",
      index: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    completedLessons: [
      {
        lessonId: { type: Schema.Types.ObjectId, required: true },
        completedAt: { type: Date, default: Date.now },
      },
    ],
    enrolledAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
    certificateIssued: {
      type: Boolean,
      default: false,
    },
    certificateUrl: {
      type: String,
    },
    // Payment info
    paymentStatus: {
      type: String,
      enum: ["free", "paid", "pending"],
      default: "free",
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Purchase",
    },
    // Performance metrics
    quizScores: [
      {
        quizId: String,
        score: Number,
        maxScore: Number,
        attemptedAt: Date,
      },
    ],
    averageQuizScore: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound index to ensure one enrollment per student per course
courseEnrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

// Index for analytics queries
courseEnrollmentSchema.index({ status: 1, enrolledAt: -1 });
courseEnrollmentSchema.index({ courseId: 1, status: 1 });

export const CourseEnrollment = mongoose.model("CourseEnrollment", courseEnrollmentSchema);
