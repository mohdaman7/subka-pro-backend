// backend/src/controllers/leadController.js
import { LeadModel } from "../models/Lead.js";
import { UserModel } from "../models/User.js";

// ============================================
// LEAD CRUD OPERATIONS
// ============================================

// Create a new lead
export const createLead = async (req, res, next) => {
  try {
    const leadData = req.body;
    
    // Enhanced duplicate detection by email OR phone OR whatsapp
    const dupFilter = { isDeleted: false };
    const $or = [];
    if (leadData.email) $or.push({ email: leadData.email.toLowerCase() });
    if (leadData.phone) $or.push({ phone: leadData.phone });
    if (leadData.whatsapp) $or.push({ whatsapp: leadData.whatsapp });
    const existingLead = $or.length
      ? await LeadModel.findOne({ ...dupFilter, $or })
      : null;
    
    if (existingLead) {
      return res.status(400).json({
        success: false,
        message: "Lead with this email already exists",
      });
    }

    // Create new lead
    const lead = new LeadModel(leadData);
    await lead.save();
    
    // Update lead score
    await lead.updateScore();
    
    // Populate assigned user if exists
    if (lead.assignedTo) {
      await lead.populate("assignedTo", "firstName lastName email");
    }

    res.status(201).json({
      success: true,
      data: lead,
      message: "Lead created successfully",
    });
  } catch (err) {
    next(err);
  }
};

// ============================================
// AUTO ASSIGNMENT (ROUND-ROBIN / LOWEST LOAD)
// ============================================

export const roundRobinAssignLeads = async (req, res, next) => {
  try {
    const { leadIds = [] } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "leadIds must be a non-empty array",
      });
    }

    // Find candidate assignees: admins act as CRM staff for now
    const staff = await UserModel.find({ role: "admin", status: { $in: ["active", "pending"] } }).select("_id firstName lastName email");
    if (staff.length === 0) {
      return res.status(400).json({ success: false, message: "No staff users available for assignment" });
    }

    // Precompute current load (open leads) for each staff
    const loads = await Promise.all(
      staff.map(async (u) => {
        const count = await LeadModel.countDocuments({
          assignedTo: u._id,
          isDeleted: false,
          status: { $nin: ["converted", "lost"] },
        });
        return { user: u, load: count };
      })
    );

    const assigned = [];
    for (const leadId of leadIds) {
      // pick lowest load
      loads.sort((a, b) => a.load - b.load);
      const pick = loads[0];
      const lead = await LeadModel.findOneAndUpdate(
        { _id: leadId, isDeleted: false },
        { assignedTo: pick.user._id, assignedBy: req.user?.id || pick.user._id, assignedAt: new Date() },
        { new: true }
      ).populate("assignedTo", "firstName lastName email");

      if (lead) {
        assigned.push(lead._id.toString());
        pick.load += 1; // increase load for fairness
      }
    }

    return res.json({
      success: true,
      data: { assignedCount: assigned.length, assignedIds: assigned },
      message: `${assigned.length} leads assigned via round-robin`,
    });
  } catch (err) {
    next(err);
  }
};

// Get all leads with filtering and pagination
export const getAllLeads = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      source,
      assignedTo,
      priority,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      dateFrom,
      dateTo,
    } = req.query;

    // Build filter object
    const filter = { isDeleted: false };

    if (status) {
      filter.status = status;
    }
    if (source) {
      filter.source = source;
    }
    if (assignedTo) {
      filter.assignedTo = assignedTo;
    }
    if (priority) {
      filter.priority = priority;
    }
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") },
      ];
    }
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) {
        filter.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filter.createdAt.$lte = new Date(dateTo);
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const leads = await LeadModel.find(filter)
      .populate("assignedTo", "firstName lastName email")
      .populate("assignedBy", "firstName lastName email")
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await LeadModel.countDocuments(filter);

    res.json({
      success: true,
      data: leads,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalLeads: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get lead by ID
export const getLeadById = async (req, res, next) => {
  try {
    const lead = await LeadModel.findOne({ 
      _id: req.params.id, 
      isDeleted: false 
    })
      .populate("assignedTo", "firstName lastName email")
      .populate("assignedBy", "firstName lastName email")
      .populate("followUps.createdBy", "firstName lastName email");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.json({
      success: true,
      data: lead,
    });
  } catch (err) {
    next(err);
  }
};

// Update lead
export const updateLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const lead = await LeadModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      updateData,
      { new: true, runValidators: true }
    )
      .populate("assignedTo", "firstName lastName email")
      .populate("assignedBy", "firstName lastName email");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Update lead score if relevant fields changed
    const scoreFields = ["source", "qualification", "experience", "jobPreferences", "phone", "whatsapp"];
    const hasScoreFieldChanged = scoreFields.some(field => updateData.hasOwnProperty(field));
    
    if (hasScoreFieldChanged) {
      await lead.updateScore();
    }

    res.json({
      success: true,
      data: lead,
      message: "Lead updated successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Delete lead (soft delete)
export const deleteLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const lead = await LeadModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user?.id,
      },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.json({
      success: true,
      message: "Lead deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

// ============================================
// LEAD ASSIGNMENT OPERATIONS
// ============================================

// Assign lead to staff member
export const assignLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assignedTo, reason } = req.body;

    // Verify assigned user exists and is staff
    const assignedUser = await UserModel.findById(assignedTo);
    if (!assignedUser) {
      return res.status(404).json({
        success: false,
        message: "Assigned user not found",
      });
    }

    const lead = await LeadModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        assignedTo,
        assignedBy: req.user?.id,
        assignedAt: new Date(),
      },
      { new: true }
    )
      .populate("assignedTo", "firstName lastName email")
      .populate("assignedBy", "firstName lastName email");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.json({
      success: true,
      data: lead,
      message: "Lead assigned successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Unassign lead
export const unassignLead = async (req, res, next) => {
  try {
    const { id } = req.params;

    const lead = await LeadModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        assignedTo: null,
        assignedBy: null,
        assignedAt: null,
      },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.json({
      success: true,
      data: lead,
      message: "Lead unassigned successfully",
    });
  } catch (err) {
    next(err);
  }
};

// ============================================
// LEAD STATUS OPERATIONS
// ============================================

// Update lead status
export const updateLeadStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const lead = await LeadModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { status },
      { new: true }
    )
      .populate("assignedTo", "firstName lastName email");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.json({
      success: true,
      data: lead,
      message: "Lead status updated successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Convert lead to user
export const convertLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { convertedTo, conversionValue } = req.body;

    const lead = await LeadModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        status: "converted",
        convertedTo,
        convertedAt: new Date(),
        conversionValue: conversionValue || 0,
      },
      { new: true }
    )
      .populate("assignedTo", "firstName lastName email");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.json({
      success: true,
      data: lead,
      message: "Lead converted successfully",
    });
  } catch (err) {
    next(err);
  }
};

// ============================================
// FOLLOW-UP OPERATIONS
// ============================================

// Add follow-up to lead
export const addFollowUp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const followUpData = req.body;

    const lead = await LeadModel.findOne({ _id: id, isDeleted: false });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    await lead.addFollowUp(followUpData, req.user?.id);
    
    // Update next follow-up date if provided
    if (followUpData.nextActionDate) {
      lead.nextFollowUpDate = new Date(followUpData.nextActionDate);
      await lead.save();
    }

    const updatedLead = await LeadModel.findById(id)
      .populate("assignedTo", "firstName lastName email")
      .populate("followUps.createdBy", "firstName lastName email");

    res.json({
      success: true,
      data: updatedLead,
      message: "Follow-up added successfully",
    });
  } catch (err) {
    next(err);
  }
};

// Get follow-ups for a lead
export const getFollowUps = async (req, res, next) => {
  try {
    const { id } = req.params;

    const lead = await LeadModel.findOne({ _id: id, isDeleted: false })
      .populate("followUps.createdBy", "firstName lastName email");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.json({
      success: true,
      data: lead.followUps,
    });
  } catch (err) {
    next(err);
  }
};

// ============================================
// ANALYTICS AND STATISTICS
// ============================================

// Get lead statistics
export const getLeadStats = async (req, res, next) => {
  try {
    const { assignedTo, dateFrom, dateTo } = req.query;
    
    const filters = {};
    if (assignedTo) filters.assignedTo = assignedTo;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    const stats = await LeadModel.getLeadStats(filters);

    // Get additional metrics
    const totalLeads = await LeadModel.countDocuments({ isDeleted: false });
    const convertedLeads = await LeadModel.countDocuments({ 
      status: "converted", 
      isDeleted: false 
    });
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    res.json({
      success: true,
      data: {
        statusBreakdown: stats,
        totalLeads,
        convertedLeads,
        conversionRate: Math.round(conversionRate * 100) / 100,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Get leads by source
export const getLeadsBySource = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const matchStage = { isDeleted: false };
    if (dateFrom || dateTo) {
      matchStage.createdAt = {};
      if (dateFrom) {
        matchStage.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        matchStage.createdAt.$lte = new Date(dateTo);
      }
    }

    const sourceStats = await LeadModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
          converted: {
            $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] }
          },
          totalValue: { $sum: "$conversionValue" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.json({
      success: true,
      data: sourceStats,
    });
  } catch (err) {
    next(err);
  }
};

// Get staff performance
export const getStaffPerformance = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const matchStage = { isDeleted: false, assignedTo: { $ne: null } };
    if (dateFrom || dateTo) {
      matchStage.createdAt = {};
      if (dateFrom) {
        matchStage.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        matchStage.createdAt.$lte = new Date(dateTo);
      }
    }

    const performance = await LeadModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$assignedTo",
          totalLeads: { $sum: 1 },
          convertedLeads: {
            $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] }
          },
          totalValue: { $sum: "$conversionValue" },
          avgScore: { $avg: "$score" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "staff",
        },
      },
      { $unwind: "$staff" },
      {
        $project: {
          staffName: { $concat: ["$staff.firstName", " ", "$staff.lastName"] },
          staffEmail: "$staff.email",
          totalLeads: 1,
          convertedLeads: 1,
          conversionRate: {
            $multiply: [
              { $divide: ["$convertedLeads", "$totalLeads"] },
              100
            ]
          },
          totalValue: 1,
          avgScore: { $round: ["$avgScore", 2] },
        },
      },
      { $sort: { conversionRate: -1 } },
    ]);

    res.json({
      success: true,
      data: performance,
    });
  } catch (err) {
    next(err);
  }
};

// ============================================
// BULK OPERATIONS
// ============================================

// Bulk assign leads
export const bulkAssignLeads = async (req, res, next) => {
  try {
    const { leadIds, assignedTo } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Lead IDs array is required",
      });
    }

    // Verify assigned user exists
    const assignedUser = await UserModel.findById(assignedTo);
    if (!assignedUser) {
      return res.status(404).json({
        success: false,
        message: "Assigned user not found",
      });
    }

    const result = await LeadModel.updateMany(
      { _id: { $in: leadIds }, isDeleted: false },
      {
        assignedTo,
        assignedBy: req.user?.id,
        assignedAt: new Date(),
      }
    );

    res.json({
      success: true,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
      message: `${result.modifiedCount} leads assigned successfully`,
    });
  } catch (err) {
    next(err);
  }
};

// Bulk update lead status
export const bulkUpdateStatus = async (req, res, next) => {
  try {
    const { leadIds, status } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Lead IDs array is required",
      });
    }

    const result = await LeadModel.updateMany(
      { _id: { $in: leadIds }, isDeleted: false },
      { status }
    );

    res.json({
      success: true,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
      message: `${result.modifiedCount} leads status updated successfully`,
    });
  } catch (err) {
    next(err);
  }
};
