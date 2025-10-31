import mongoose from "mongoose";

const { Schema } = mongoose;

const candidateNoteSchema = new Schema(
  {
    employerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    candidateUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: "Application" },
    jobId: { type: Schema.Types.ObjectId, ref: "Job" },
    content: { type: String, required: true, maxlength: 4000 },
    visibility: { type: String, enum: ["team", "private"], default: "team", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

candidateNoteSchema.index({ employerId: 1, candidateUserId: 1 });
candidateNoteSchema.index({ jobId: 1, applicationId: 1 });

export const CandidateNoteModel = mongoose.model("CandidateNote", candidateNoteSchema);
