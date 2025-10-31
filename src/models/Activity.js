import mongoose from "mongoose";

const { Schema } = mongoose;

const activitySchema = new Schema(
  {
    employerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "team_member_added",
        "team_member_removed",
        "team_member_role_changed",
        "candidate_note_added",
        "candidate_note_updated",
        "application_status_changed",
        "interview_scheduled",
        "interview_rescheduled",
        "interview_cancelled",
        "job_posted",
        "job_updated",
        "job_status_changed",
        "saved_view_created",
        "saved_view_updated",
        "saved_view_deleted",
      ],
      required: true,
      index: true,
    },
    target: {
      kind: { type: String, enum: ["user", "application", "job", "view", "team"], index: true },
      id: { type: Schema.Types.ObjectId, index: true },
      label: { type: String },
    },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

activitySchema.index({ employerId: 1, createdAt: -1 });

export const ActivityModel = mongoose.model("Activity", activitySchema);
