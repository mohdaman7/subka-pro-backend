import mongoose from "mongoose";

const { Schema } = mongoose;

const lessonCompletionSchema = new Schema(
  {
    lessonId: { type: Schema.Types.ObjectId, required: true },
    completedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const courseProgressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true }, // module-level course
    completedLessons: { type: [lessonCompletionSchema], default: [] },
    lastLessonId: { type: Schema.Types.ObjectId },
    lastAccessedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

courseProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });

export const CourseProgressModel = mongoose.model("CourseProgress", courseProgressSchema);
