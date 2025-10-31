import mongoose from "mongoose";

const { Schema } = mongoose;

const supportTicketSchema = new Schema(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["account", "jobs", "courses", "technical", "billing", "other"],
      default: "other",
      index: true,
    },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium", index: true },
    description: { type: String, required: true },
    status: { type: String, enum: ["open", "in_progress", "resolved", "closed"], default: "open", index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

supportTicketSchema.index({ createdAt: -1 });

export const SupportTicketModel = mongoose.model("SupportTicket", supportTicketSchema);
