import mongoose from "mongoose";

const { Schema } = mongoose;

const companySchema = new Schema({
  name: { type: String },
  description: { type: String },
  industry: { type: String },
  size: {
    type: String,
    enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"],
  },
  website: { type: String },
  logo: {
    filename: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
  },
  foundedYear: { type: Number },
});

const contactSchema = new Schema({
  phone: { type: String },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
  },
});

const employerSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // Subscription plan
    plan: {
      type: String,
      enum: ["free", "pro"],
      default: "free",
      index: true,
    },

    // Company Information
    company: companySchema,

    // Contact Information
    contact: contactSchema,

    // Position in Company
    position: { type: String },
    department: { type: String },

    // Hiring Preferences
    hiringNeeds: {
      typesOfRoles: [{ type: String }],
      locations: [{ type: String }],
      typicalSalaryRanges: [
        {
          role: String,
          min: Number,
          max: Number,
          currency: { type: String, default: "USD" },
        },
      ],
    },

    // About the Employer
    bio: { type: String, maxlength: 500 },
    hiringGoals: { type: String, maxlength: 300 },

    // Branding & Social
    socialLinks: {
      linkedin: { type: String },
      twitter: { type: String },
      facebook: { type: String },
    },
    branding: {
      themeColor: { type: String },
      coverImage: {
        filename: String,
        url: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    },

    // Verification
    isVerified: { type: Boolean, default: false },
    verificationDocuments: [
      {
        type: {
          type: String,
          enum: [
            "business_license",
            "tax_certificate",
            "company_registration",
            "gst",
            "pan",
            "other",
          ],
        },
        filename: String,
        url: String,
        uploadedAt: { type: Date, default: Date.now },
        // Document verification workflow fields
        status: {
          type: String,
          enum: ["uploaded", "verified", "rejected", "needs_reupload"],
          default: "uploaded",
          index: true,
        },
        reviewedAt: { type: Date },
        reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
        reviewNotes: { type: String },
        rejectionReason: { type: String },
      },
    ],

    // Status
    profileCompletion: { type: Number, default: 0, min: 0, max: 100 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const EmployerModel = mongoose.model("Employer", employerSchema);
