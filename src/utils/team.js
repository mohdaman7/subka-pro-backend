import { TeamModel } from "../models/Team.js";
import mongoose from "mongoose";

export async function getTeamOwnerIdForUser(userId) {
  // If user is the team owner
  const asObjectId = new mongoose.Types.ObjectId(userId);
  const ownTeam = await TeamModel.findOne({ ownerId: asObjectId }).select("ownerId");
  if (ownTeam) return ownTeam.ownerId.toString();

  // If user is a member of someone else's team
  const memberTeam = await TeamModel.findOne({ "members.userId": asObjectId }).select("ownerId");
  if (memberTeam) return memberTeam.ownerId.toString();

  // Fallback: no team yet, treat as own owner
  return userId;
}

export async function getOrCreateTeamForOwner(ownerUserId) {
  let team = await TeamModel.findOne({ ownerId: ownerUserId });
  if (!team) {
    team = await TeamModel.create({ ownerId: ownerUserId, name: "Employer Team", members: [{ userId: ownerUserId, role: "owner", status: "active" }] });
  }
  return team;
}
