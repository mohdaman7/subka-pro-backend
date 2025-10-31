import mongoose from "mongoose";

const { Schema } = mongoose;

const companySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    description: { type: String },
    industry: { type: String, index: true },
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
    location: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

companySchema.index({ name: 1, industry: 1 });

export const CompanyModel = mongoose.model("Company", companySchema);
