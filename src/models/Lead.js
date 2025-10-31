// backend/src/models/Lead.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const followUpSchema = new Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  type: {
    type: String,
    enum: ["call", "email", "meeting", "note", "other"],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  outcome: {
    type: String,
    enum: ["positive", "neutral", "negative", "no_response"],
    default: "neutral",
  },
  nextAction: {
    type: String,
  },
  nextActionDate: {
    type: Date,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
}, { timestamps: true });

const leadSchema = new Schema(
  {
    // Basic Information
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    whatsapp: {
      type: String,
      trim: true,
    },
    
    // Lead Source and Type
    source: {
      type: String,
      enum: [
        "website", 
        "social_media", 
        "google_ads", 
        "facebook_ads", 
        "referral", 
        "walk_in", 
        "phone_call", 
        "email_campaign", 
        "event", 
        "partnership", 
        "other"
      ],
      required: true,
      default: "website",
    },
    sourceDetails: {
      type: String, // Additional details about the source
    },
    
    // Lead Status and Priority
    status: {
      type: String,
      enum: [
        "new",
        "contacted",
        "follow_up",
        "proposal_sent",
        "negotiation",
        "converted",
        "lost"
      ],
      default: "new",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    
    // Assignment and Ownership
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedAt: {
      type: Date,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    
    // Lead Details
    qualification: {
      type: String,
      trim: true,
    },
    jobPreferences: {
      type: String,
      trim: true,
    },
    experience: {
      type: String,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    
    // Documents and Attachments
    cvUrl: {
      type: String,
    },
    documents: [{
      name: String,
      url: String,
      type: String,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    }],
    
    // Conversion Details
    convertedTo: {
      type: String,
      enum: ["student", "employer", "other"],
    },
    convertedAt: {
      type: Date,
    },
    conversionValue: {
      type: Number,
      default: 0,
    },
    
    // Follow-up Management
    followUps: [followUpSchema],
    lastFollowUpDate: {
      type: Date,
    },
    nextFollowUpDate: {
      type: Date,
    },
    
    // Lead Scoring
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    
    // Tags for categorization
    tags: [{
      type: String,
      trim: true,
    }],
    
    // Lead Lifecycle
    lifecycleStage: {
      type: String,
      enum: ["awareness", "interest", "consideration", "intent", "evaluation", "purchase"],
      default: "awareness",
    },
    
    // Communication Preferences
    preferredContactMethod: {
      type: String,
      enum: ["email", "phone", "whatsapp", "sms"],
      default: "email",
    },
    bestTimeToContact: {
      type: String,
    },
    
    // Lead Source Campaign Tracking
    campaignId: {
      type: String,
    },
    campaignName: {
      type: String,
    },
    utmSource: {
      type: String,
    },
    utmMedium: {
      type: String,
    },
    utmCampaign: {
      type: String,
    },
    
    // Status History for Audit Trail
    statusHistory: [{
      status: {
        type: String,
        required: true,
      },
      changedAt: {
        type: Date,
        default: Date.now,
      },
      changedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      reason: {
        type: String,
      },
    }],
    
    // Soft Delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for full name
leadSchema.virtual("fullName").get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for lead age in days
leadSchema.virtual("ageInDays").get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Indexes for better query performance
leadSchema.index({ email: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ source: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ status: 1, assignedTo: 1 });
leadSchema.index({ source: 1, status: 1 });
leadSchema.index({ isDeleted: 1, status: 1 });

// Pre-save middleware to update status history
leadSchema.pre("save", function(next) {
  if (this.isModified("status") && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date(),
      changedBy: this.assignedTo || this.assignedBy,
      reason: "Status updated",
    });
  }
  next();
});

// Pre-save middleware to update assignment date
leadSchema.pre("save", function(next) {
  if (this.isModified("assignedTo") && this.assignedTo) {
    this.assignedAt = new Date();
  }
  next();
});

// Static method to get leads by status
leadSchema.statics.getLeadsByStatus = function(status, options = {}) {
  const query = { status, isDeleted: false };
  if (options.assignedTo) {
    query.assignedTo = options.assignedTo;
  }
  return this.find(query).populate("assignedTo", "firstName lastName email");
};

// Static method to get lead statistics
leadSchema.statics.getLeadStats = function(filters = {}) {
  const matchStage = { isDeleted: false };
  if (filters.assignedTo) {
    matchStage.assignedTo = filters.assignedTo;
  }
  if (filters.dateFrom || filters.dateTo) {
    matchStage.createdAt = {};
    if (filters.dateFrom) {
      matchStage.createdAt.$gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      matchStage.createdAt.$lte = new Date(filters.dateTo);
    }
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalValue: { $sum: "$conversionValue" },
      },
    },
  ]);
};

// Instance method to add follow-up
leadSchema.methods.addFollowUp = function(followUpData, userId) {
  this.followUps.push({
    ...followUpData,
    createdBy: userId,
  });
  this.lastFollowUpDate = new Date();
  return this.save();
};

// Instance method to update lead score
leadSchema.methods.updateScore = function() {
  let score = 0;
  
  // Base score from source
  const sourceScores = {
    referral: 20,
    event: 15,
    website: 10,
    social_media: 8,
    google_ads: 5,
    facebook_ads: 5,
    walk_in: 15,
    phone_call: 12,
    email_campaign: 8,
    partnership: 25,
    other: 5,
  };
  score += sourceScores[this.source] || 0;
  
  // Score from qualification
  if (this.qualification) score += 10;
  if (this.experience) score += 10;
  if (this.jobPreferences) score += 5;
  
  // Score from engagement
  if (this.followUps.length > 0) score += 15;
  if (this.documents.length > 0) score += 10;
  
  // Score from contact methods
  if (this.phone) score += 5;
  if (this.whatsapp) score += 5;
  
  this.score = Math.min(score, 100);
  return this.save();
};

export const LeadModel = mongoose.model("Lead", leadSchema);
