import { z } from "zod";
import mongoose from "mongoose";
import { TeamModel } from "../models/Team.js";
import { CandidateNoteModel } from "../models/CandidateNote.js";
import { ActivityModel } from "../models/Activity.js";
import { SavedViewModel } from "../models/SavedView.js";
import { sendTeamInvitationEmail } from "../utils/mailer.js";
import { env } from "../config/env.js";

// Helpers
async function recordActivity({ employerId, actorId, type, target, meta }) {
  try {
    await ActivityModel.create({ employerId, actorId, type, target, meta });
  } catch {}
}

// ---------- Team ----------
const inviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "hiring_manager", "recruiter", "viewer"]).default("recruiter"),
});

export const getTeam = async (req, res, next) => {
  try {
    let team = await TeamModel.findOne({ ownerId: req.user.id })
      .populate("members.userId", "firstName lastName email role");

    if (!team) {
      team = await TeamModel.findOne({ "members.userId": req.user.id })
        .populate("members.userId", "firstName lastName email role");
    }

    if (!team) {
      const created = await TeamModel.create({ ownerId: req.user.id, name: "Employer Team", members: [{ userId: req.user.id, role: "owner", status: "active" }] });
      return res.json({ success: true, data: created });
    }
    res.json({ success: true, data: team });
  } catch (err) { next(err); }
};

export const inviteTeamMember = async (req, res, next) => {
  try {
    const parsed = inviteTeamMemberSchema.parse(req.body);
    const team = await TeamModel.findOneAndUpdate(
      { ownerId: req.user.id },
      {
        $setOnInsert: { name: "Employer Team" },
        $push: {
          members: {
            invitedEmail: parsed.email,
            role: parsed.role,
            status: "invited",
            invitedAt: new Date(),
          },
        },
      },
      { upsert: true, new: true }
    );

    await recordActivity({
      employerId: req.user.id,
      actorId: req.user.id,
      type: "team_member_added",
      target: { kind: "team", id: team._id, label: parsed.email },
    });

    res.status(201).json({ success: true, data: team, message: "Invitation recorded" });

    // Send team invitation email
    try {
      const { UserModel } = await import("../models/User.js");
      const inviter = await UserModel.findById(req.user.id).populate("employerProfile");
      const companyName = inviter?.employerProfile?.company?.name || "Our Company";
      
      await sendTeamInvitationEmail({
        inviteeEmail: parsed.email,
        inviterName: `${req.user.firstName} ${req.user.lastName}`,
        companyName: companyName,
        role: parsed.role,
        acceptLink: `${env.corsOrigin}/employer/team/accept/${team._id}`,
        declineLink: `${env.corsOrigin}/employer/team/decline/${team._id}`
      });
    } catch (emailError) {
      console.error("Failed to send team invitation email:", emailError);
    }
  } catch (err) { next(err); }
};

export const updateTeamMember = async (req, res, next) => {
  try {
    const { memberId } = req.params; // index or subdoc id is not set since members _id: false; use email match
    const { role, status } = req.body || {};
    const allowedRoles = ["admin", "hiring_manager", "recruiter", "viewer"];
    const allowedStatus = ["active", "invited", "removed"];

    const update = {};
    if (role) {
      if (!allowedRoles.includes(role)) return res.status(400).json({ success: false, message: "Invalid role" });
      update["members.$.role"] = role;
    }
    if (status) {
      if (!allowedStatus.includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });
      update["members.$.status"] = status;
    }

    let team = await TeamModel.findOneAndUpdate(
      { ownerId: req.user.id, "members.invitedEmail": memberId },
      { $set: update },
      { new: true }
    );

    if (!team) {
      // Try matching by userId
      let asObjectId;
      try { asObjectId = new mongoose.Types.ObjectId(memberId); } catch {}
      if (asObjectId) {
        team = await TeamModel.findOneAndUpdate(
          { ownerId: req.user.id, "members.userId": asObjectId },
          { $set: update },
          { new: true }
        );
      }
    }

    if (!team) return res.status(404).json({ success: false, message: "Team member not found" });

    await recordActivity({
      employerId: req.user.id,
      actorId: req.user.id,
      type: role ? "team_member_role_changed" : "team_member_removed",
      target: { kind: "team", id: team._id, label: memberId },
      meta: { role, status },
    });

    res.json({ success: true, data: team, message: "Team member updated" });
  } catch (err) { next(err); }
};

export const removeTeamMember = async (req, res, next) => {
  try {
    const { memberId } = req.params; // invitedEmail
    let team = await TeamModel.findOneAndUpdate(
      { ownerId: req.user.id },
      { $pull: { members: { invitedEmail: memberId } } },
      { new: true }
    );
    if (!team) {
      let asObjectId;
      try { asObjectId = new mongoose.Types.ObjectId(memberId); } catch {}
      if (asObjectId) {
        team = await TeamModel.findOneAndUpdate(
          { ownerId: req.user.id },
          { $pull: { members: { userId: asObjectId } } },
          { new: true }
        );
      }
    }
    await recordActivity({ employerId: req.user.id, actorId: req.user.id, type: "team_member_removed", target: { kind: "team", id: team?._id, label: memberId } });
    res.json({ success: true, data: team, message: "Member removed" });
  } catch (err) { next(err); }
};

// ---------- Notes ----------
const createNoteSchema = z.object({
  candidateUserId: z.string(),
  applicationId: z.string().optional(),
  jobId: z.string().optional(),
  content: z.string().min(1).max(4000),
  visibility: z.enum(["team", "private"]).default("team"),
});

export const addNote = async (req, res, next) => {
  try {
    const parsed = createNoteSchema.parse(req.body);

    const note = await CandidateNoteModel.create({
      employerId: req.user.id,
      candidateUserId: new mongoose.Types.ObjectId(parsed.candidateUserId),
      applicationId: parsed.applicationId ? new mongoose.Types.ObjectId(parsed.applicationId) : undefined,
      jobId: parsed.jobId ? new mongoose.Types.ObjectId(parsed.jobId) : undefined,
      content: parsed.content,
      visibility: parsed.visibility,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    await recordActivity({
      employerId: req.user.id,
      actorId: req.user.id,
      type: "candidate_note_added",
      target: { kind: "user", id: note.candidateUserId, label: "Candidate" },
    });

    res.status(201).json({ success: true, data: note, message: "Note added" });
  } catch (err) { next(err); }
};

export const listNotes = async (req, res, next) => {
  try {
    const { candidateUserId, applicationId, jobId } = req.query;
    const filter = { employerId: req.user.id };
    if (candidateUserId) filter.candidateUserId = candidateUserId;
    if (applicationId) filter.applicationId = applicationId;
    if (jobId) filter.jobId = jobId;

    const notes = await CandidateNoteModel.find(filter)
      .populate("createdBy", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: notes });
  } catch (err) { next(err); }
};

export const updateNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, visibility } = req.body || {};
    const update = { updatedBy: req.user.id, updatedAt: new Date() };
    if (content) update.content = content;
    if (visibility && ["team", "private"].includes(visibility)) update.visibility = visibility;

    const note = await CandidateNoteModel.findOneAndUpdate(
      { _id: id, employerId: req.user.id },
      { $set: update },
      { new: true }
    );
    if (!note) return res.status(404).json({ success: false, message: "Note not found" });

    await recordActivity({ employerId: req.user.id, actorId: req.user.id, type: "candidate_note_updated", target: { kind: "user", id: note.candidateUserId } });
    res.json({ success: true, data: note, message: "Note updated" });
  } catch (err) { next(err); }
};

export const deleteNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const note = await CandidateNoteModel.findOneAndDelete({ _id: id, employerId: req.user.id });
    if (!note) return res.status(404).json({ success: false, message: "Note not found" });
    res.json({ success: true, message: "Note deleted" });
  } catch (err) { next(err); }
};

// ---------- Activity ----------
export const getActivityFeed = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const filter = { employerId: req.user.id };
    if (type) filter.type = type;

    const activities = await ActivityModel.find(filter)
      .populate("actorId", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await ActivityModel.countDocuments(filter);

    res.json({ success: true, data: activities, pagination: { currentPage: Number(page), totalPages: Math.ceil(total / Number(limit)), total } });
  } catch (err) { next(err); }
};

// ---------- Saved Views ----------
const createSavedViewSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["candidates", "applications"]).default("candidates"),
  query: z.any(),
  sharedWithTeam: z.boolean().default(true),
});

export const createSavedView = async (req, res, next) => {
  try {
    const parsed = createSavedViewSchema.parse(req.body);
    const doc = await SavedViewModel.create({
      employerId: req.user.id,
      name: parsed.name,
      type: parsed.type,
      query: parsed.query,
      sharedWithTeam: parsed.sharedWithTeam,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    await recordActivity({ employerId: req.user.id, actorId: req.user.id, type: "saved_view_created", target: { kind: "view", id: doc._id, label: doc.name } });

    res.status(201).json({ success: true, data: doc, message: "Saved view created" });
  } catch (err) { next(err); }
};

export const listSavedViews = async (req, res, next) => {
  try {
    const { type } = req.query;
    const filter = { employerId: req.user.id };
    if (type) filter.type = type;
    const docs = await SavedViewModel.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
};

export const updateSavedView = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, query, sharedWithTeam } = req.body || {};
    const update = { updatedBy: req.user.id, updatedAt: new Date() };
    if (name) update.name = name;
    if (query) update.query = query;
    if (typeof sharedWithTeam === "boolean") update.sharedWithTeam = sharedWithTeam;

    const doc = await SavedViewModel.findOneAndUpdate(
      { _id: id, employerId: req.user.id },
      { $set: update },
      { new: true }
    );
    if (!doc) return res.status(404).json({ success: false, message: "Saved view not found" });

    await recordActivity({ employerId: req.user.id, actorId: req.user.id, type: "saved_view_updated", target: { kind: "view", id: doc._id, label: doc.name } });
    res.json({ success: true, data: doc, message: "Saved view updated" });
  } catch (err) { next(err); }
};

export const deleteSavedView = async (req, res, next) => {
  try {
    const { id } = req.params;
    const doc = await SavedViewModel.findOneAndDelete({ _id: id, employerId: req.user.id });
    if (!doc) return res.status(404).json({ success: false, message: "Saved view not found" });
    await recordActivity({ employerId: req.user.id, actorId: req.user.id, type: "saved_view_deleted", target: { kind: "view", id: id } });
    res.json({ success: true, message: "Saved view deleted" });
  } catch (err) { next(err); }
};
