import mongoose from "mongoose";

const { Schema } = mongoose;

const lessonSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    durationSec: { type: Number, default: 0 },
    // For now support YouTube; later can add Vimeo
    videoProvider: {
      type: String,
      enum: ["youtube", "vimeo", "external"],
      default: "youtube",
    },
    // If provider is youtube or vimeo, store the provider's ID; otherwise use videoUrl
    videoId: { type: String },
    videoUrl: { type: String },
    isFreePreview: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: true, timestamps: true }
);

const pricingSchema = new Schema(
  {
    // For sub-courses (modules)
    individualPrice: { type: Number, default: 0, min: 0 },
    // For parent course bundles
    bundlePrice: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "INR" },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const courseSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: { type: String, index: true },
    thumbnail: { type: String },
    instructor: { type: String },
    level: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      default: "Beginner",
    },
    tags: [{ type: String }],

    // Hierarchy
    type: { type: String, enum: ["parent", "module"], required: true },
    parentCourse: { type: Schema.Types.ObjectId, ref: "Course", default: null },

    // Pricing
    pricing: { type: pricingSchema, default: {} },

    // Lessons (only for module type)
    lessons: { type: [lessonSchema], default: [] },

    // Status
    status: {
      type: String,
      enum: ["draft", "active", "archived"],
      default: "draft",
      index: true,
    },

    // Derived/metrics
    enrolledCount: { type: Number, default: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
  },
  { timestamps: true }
);

courseSchema.index({ type: 1, parentCourse: 1 });
courseSchema.index({ title: "text", description: "text", tags: "text" });

export const CourseModel = mongoose.model("Course", courseSchema);
