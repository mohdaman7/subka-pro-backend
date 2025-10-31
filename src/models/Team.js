import mongoose from "mongoose";

const { Schema } = mongoose;

const teamMemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    invitedEmail: { type: String },
    role: {
      type: String,
      enum: ["owner", "admin", "hiring_manager", "recruiter", "viewer"],
      default: "recruiter",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "invited", "removed"],
      default: "active",
      index: true,
    },
    invitedAt: { type: Date },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const teamSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, default: "Employer Team" },
    members: [teamMemberSchema],
    settings: {
      defaultRoleForNewMembers: {
        type: String,
        enum: ["admin", "hiring_manager", "recruiter", "viewer"],
        default: "recruiter",
      },
      notes: {
        defaultVisibility: { type: String, enum: ["team", "private"], default: "team" },
      },
    },
  },
  { timestamps: true }
);

teamSchema.index({ ownerId: 1 });
teamSchema.index({ "members.userId": 1 });

export const TeamModel = mongoose.model("Team", teamSchema);
