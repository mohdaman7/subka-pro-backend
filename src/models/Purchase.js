import mongoose from "mongoose";

const { Schema } = mongoose;

const invoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    billingName: { type: String },
    billingEmail: { type: String },
    billingAddress: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    issuedAt: { type: Date, default: Date.now },
    notes: { type: String },
  },
  { _id: false }
);

const purchaseSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["pro_subscription", "full_course", "sub_course", "bundle", "gift"],
      required: true,
      index: true,
    },
    // Parent course for full_course, or specific module for sub_course
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    // Optional: for sub_course purchase, also store parent course id for faster queries
    parentCourseId: { type: Schema.Types.ObjectId, ref: "Course" },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: { type: String, enum: ["pending", "paid", "refunded", "failed"], default: "paid" },
    paymentProvider: { type: String, default: "manual" },
    paymentReference: { type: String },
    invoice: { type: invoiceSchema, required: true },
    giftedToUserId: { type: Schema.Types.ObjectId, ref: "User" },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

purchaseSchema.index({ userId: 1, createdAt: -1 });

export const PurchaseModel = mongoose.model("Purchase", purchaseSchema);
