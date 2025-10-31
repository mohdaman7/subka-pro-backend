import mongoose from "mongoose";

const { Schema } = mongoose;

const savedViewSchema = new Schema(
  {
    employerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["candidates", "applications"], default: "candidates" },
    query: { type: Schema.Types.Mixed, required: true },
    sharedWithTeam: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

savedViewSchema.index({ employerId: 1, type: 1, sharedWithTeam: 1 });

export const SavedViewModel = mongoose.model("SavedView", savedViewSchema);
