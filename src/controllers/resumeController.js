import { z } from "zod";
import { ResumeModel } from "../models/Resume.js";
import { VideoResumeModel } from "../models/VideoResume.js";
import { UserModel } from "../models/User.js";

// =============== ATS RESUME ENDPOINTS ===============

// Upload and parse resume
export const uploadResume = async (req, res, next) => {
  try {
    const { name, fileUrl, fileName, fileSize, templateId, templateName } = req.body;

    // Simulate ATS parsing and scoring
    const atsAnalysis = await analyzeResume(fileUrl);

    const resume = await ResumeModel.create({
      studentId: req.user.id,
      name: name || fileName,
      type: templateId ? "custom" : "ats",
      fileUrl,
      fileName,
      fileSize,
      templateId,
      templateName,
      atsScore: atsAnalysis.score,
      keywords: atsAnalysis.keywords,
      suggestions: atsAnalysis.suggestions,
      parsedData: atsAnalysis.parsedData,
      isPrimary: false, // Will be set via separate endpoint
    });

    res.status(201).json({
      success: true,
      message: "Resume uploaded and analyzed successfully",
      data: resume,
    });
  } catch (err) {
    console.error("❌ Upload resume error:", err);
    next(err);
  }
};

// Get all resumes for current student
export const getMyResumes = async (req, res, next) => {
  try {
    const resumes = await ResumeModel.find({ studentId: req.user.id })
      .sort({ isPrimary: -1, createdAt: -1 })
      .lean();

    const totalViews = resumes.reduce((sum, r) => sum + (r.views || 0), 0);
    const totalDownloads = resumes.reduce((sum, r) => sum + (r.downloads || 0), 0);
    const avgScore =
      resumes.length > 0
        ? resumes.reduce((sum, r) => sum + (r.atsScore || 0), 0) / resumes.length
        : 0;

    res.json({
      success: true,
      data: resumes,
      stats: {
        totalResumes: resumes.length,
        totalViews,
        totalDownloads,
        avgScore: Math.round(avgScore),
      },
    });
  } catch (err) {
    console.error("❌ Get resumes error:", err);
    next(err);
  }
};

// Get single resume by ID
export const getResumeById = async (req, res, next) => {
  try {
    const resume = await ResumeModel.findOne({
      _id: req.params.id,
      studentId: req.user.id,
    });

    if (!resume) {
      return res.status(404).json({ success: false, message: "Resume not found" });
    }

    res.json({ success: true, data: resume });
  } catch (err) {
    console.error("❌ Get resume error:", err);
    next(err);
  }
};

// Set primary resume
export const setPrimaryResume = async (req, res, next) => {
  try {
    const resume = await ResumeModel.findOneAndUpdate(
      { _id: req.params.id, studentId: req.user.id },
      { isPrimary: true },
      { new: true }
    );

    if (!resume) {
      return res.status(404).json({ success: false, message: "Resume not found" });
    }

    res.json({
      success: true,
      message: "Primary resume updated",
      data: resume,
    });
  } catch (err) {
    console.error("❌ Set primary resume error:", err);
    next(err);
  }
};

// Update resume settings
export const updateResume = async (req, res, next) => {
  try {
    const { name, isPublic } = req.body;

    const resume = await ResumeModel.findOneAndUpdate(
      { _id: req.params.id, studentId: req.user.id },
      { name, isPublic },
      { new: true, runValidators: true }
    );

    if (!resume) {
      return res.status(404).json({ success: false, message: "Resume not found" });
    }

    res.json({
      success: true,
      message: "Resume updated",
      data: resume,
    });
  } catch (err) {
    console.error("❌ Update resume error:", err);
    next(err);
  }
};

// Delete resume
export const deleteResume = async (req, res, next) => {
  try {
    const resume = await ResumeModel.findOneAndDelete({
      _id: req.params.id,
      studentId: req.user.id,
    });

    if (!resume) {
      return res.status(404).json({ success: false, message: "Resume not found" });
    }

    res.json({
      success: true,
      message: "Resume deleted successfully",
    });
  } catch (err) {
    console.error("❌ Delete resume error:", err);
    next(err);
  }
};

// Duplicate resume
export const duplicateResume = async (req, res, next) => {
  try {
    const original = await ResumeModel.findOne({
      _id: req.params.id,
      studentId: req.user.id,
    });

    if (!original) {
      return res.status(404).json({ success: false, message: "Resume not found" });
    }

    const duplicate = await ResumeModel.create({
      ...original.toObject(),
      _id: undefined,
      name: `${original.name} (Copy)`,
      isPrimary: false,
      views: 0,
      downloads: 0,
      appliedJobs: [],
      createdAt: undefined,
      updatedAt: undefined,
    });

    res.status(201).json({
      success: true,
      message: "Resume duplicated successfully",
      data: duplicate,
    });
  } catch (err) {
    console.error("❌ Duplicate resume error:", err);
    next(err);
  }
};

// Track resume view (when employer views)
export const trackResumeView = async (req, res, next) => {
  try {
    await ResumeModel.findByIdAndUpdate(req.params.id, {
      $inc: { views: 1 },
    });

    res.json({ success: true, message: "View tracked" });
  } catch (err) {
    console.error("❌ Track view error:", err);
    next(err);
  }
};

// Track resume download
export const trackResumeDownload = async (req, res, next) => {
  try {
    await ResumeModel.findByIdAndUpdate(req.params.id, {
      $inc: { downloads: 1 },
    });

    res.json({ success: true, message: "Download tracked" });
  } catch (err) {
    console.error("❌ Track download error:", err);
    next(err);
  }
};

// Get ATS optimization suggestions
export const getATSSuggestions = async (req, res, next) => {
  try {
    const resume = await ResumeModel.findOne({
      _id: req.params.id,
      studentId: req.user.id,
    });

    if (!resume) {
      return res.status(404).json({ success: false, message: "Resume not found" });
    }

    // Generate enhanced suggestions
    const suggestions = generateEnhancedSuggestions(resume);

    res.json({
      success: true,
      data: {
        currentScore: resume.atsScore,
        potentialScore: Math.min(100, resume.atsScore + suggestions.length * 3),
        suggestions,
        keywords: resume.keywords,
      },
    });
  } catch (err) {
    console.error("❌ Get suggestions error:", err);
    next(err);
  }
};

// =============== VIDEO RESUME ENDPOINTS ===============

// Upload video resume
export const uploadVideoResume = async (req, res, next) => {
  try {
    const {
      name,
      videoUrl,
      thumbnailUrl,
      duration,
      fileSize,
      templateId,
      templateName,
      description,
      tags,
    } = req.body;

    const videoResume = await VideoResumeModel.create({
      studentId: req.user.id,
      name,
      videoUrl,
      thumbnailUrl,
      duration,
      fileSize,
      templateId,
      templateName,
      description,
      tags: tags || [],
      isPrimary: false,
      privacy: "public",
    });

    res.status(201).json({
      success: true,
      message: "Video resume uploaded successfully",
      data: videoResume,
    });
  } catch (err) {
    console.error("❌ Upload video resume error:", err);
    next(err);
  }
};

// Get all video resumes for current student
export const getMyVideoResumes = async (req, res, next) => {
  try {
    const videos = await VideoResumeModel.find({ studentId: req.user.id })
      .sort({ isPrimary: -1, createdAt: -1 })
      .lean();

    const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
    const totalShares = videos.reduce((sum, v) => sum + (v.shares || 0), 0);

    res.json({
      success: true,
      data: videos,
      stats: {
        totalVideos: videos.length,
        totalViews,
        totalShares,
      },
    });
  } catch (err) {
    console.error("❌ Get video resumes error:", err);
    next(err);
  }
};

// Set primary video resume
export const setPrimaryVideo = async (req, res, next) => {
  try {
    const video = await VideoResumeModel.findOneAndUpdate(
      { _id: req.params.id, studentId: req.user.id },
      { isPrimary: true },
      { new: true }
    );

    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }

    res.json({
      success: true,
      message: "Primary video updated",
      data: video,
    });
  } catch (err) {
    console.error("❌ Set primary video error:", err);
    next(err);
  }
};

// Update video settings
export const updateVideoResume = async (req, res, next) => {
  try {
    const { name, description, privacy, allowDownload, tags } = req.body;

    const video = await VideoResumeModel.findOneAndUpdate(
      { _id: req.params.id, studentId: req.user.id },
      { name, description, privacy, allowDownload, tags },
      { new: true, runValidators: true }
    );

    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }

    res.json({
      success: true,
      message: "Video settings updated",
      data: video,
    });
  } catch (err) {
    console.error("❌ Update video error:", err);
    next(err);
  }
};

// Delete video resume
export const deleteVideoResume = async (req, res, next) => {
  try {
    const video = await VideoResumeModel.findOneAndDelete({
      _id: req.params.id,
      studentId: req.user.id,
    });

    if (!video) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }

    res.json({
      success: true,
      message: "Video deleted successfully",
    });
  } catch (err) {
    console.error("❌ Delete video error:", err);
    next(err);
  }
};

// Track video view
export const trackVideoView = async (req, res, next) => {
  try {
    const { duration } = req.body; // How long they watched

    await VideoResumeModel.findByIdAndUpdate(req.params.id, {
      $inc: { views: 1 },
      $push: {
        uniqueViews: {
          viewerId: req.user?.id || null,
          viewedAt: new Date(),
          duration: duration || 0,
        },
      },
    });

    res.json({ success: true, message: "View tracked" });
  } catch (err) {
    console.error("❌ Track video view error:", err);
    next(err);
  }
};

// Get combined analytics
export const getAnalytics = async (req, res, next) => {
  try {
    const resumes = await ResumeModel.find({ studentId: req.user.id }).lean();
    const videos = await VideoResumeModel.find({ studentId: req.user.id }).lean();

    const totalResumeViews = resumes.reduce((sum, r) => sum + (r.views || 0), 0);
    const totalResumeDownloads = resumes.reduce((sum, r) => sum + (r.downloads || 0), 0);
    const totalVideoViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
    const avgAtsScore =
      resumes.length > 0
        ? Math.round(resumes.reduce((sum, r) => sum + (r.atsScore || 0), 0) / resumes.length)
        : 0;

    // Profile strength calculation
    const profileStrength = calculateProfileStrength(resumes, videos);

    res.json({
      success: true,
      data: {
        overview: {
          totalResumeViews,
          totalResumeDownloads,
          totalVideoViews,
          avgAtsScore,
          profileStrength,
        },
        resumes: resumes.map((r) => ({
          id: r._id,
          name: r.name,
          views: r.views || 0,
          downloads: r.downloads || 0,
          score: r.atsScore || 0,
        })),
        videos: videos.map((v) => ({
          id: v._id,
          name: v.name,
          views: v.views || 0,
          uniqueViewers: v.uniqueViews?.length || 0,
        })),
      },
    });
  } catch (err) {
    console.error("❌ Get analytics error:", err);
    next(err);
  }
};

// =============== HELPER FUNCTIONS ===============

// Simulate ATS parsing and scoring
async function analyzeResume(fileUrl) {
  // In production, integrate with real ATS parsing library
  // For now, return mock data
  const score = Math.floor(Math.random() * 30) + 70; // 70-100

  return {
    score,
    keywords: [
      { word: "JavaScript", frequency: 12, relevance: 95 },
      { word: "React", frequency: 8, relevance: 90 },
      { word: "Node.js", frequency: 6, relevance: 85 },
      { word: "MongoDB", frequency: 4, relevance: 80 },
      { word: "API", frequency: 10, relevance: 75 },
    ],
    suggestions: [
      {
        category: "keywords",
        message: "Add more industry-specific keywords like 'Agile', 'CI/CD'",
        priority: "high",
      },
      {
        category: "format",
        message: "Use bullet points for better readability",
        priority: "medium",
      },
      {
        category: "content",
        message: "Quantify your achievements with metrics",
        priority: "high",
      },
    ],
    parsedData: {
      contact: {
        email: "john.doe@example.com",
        phone: "+1234567890",
        linkedin: "linkedin.com/in/johndoe",
        portfolio: "johndoe.com",
      },
      summary:
        "Experienced software engineer with 5+ years in full-stack development...",
      experience: [
        {
          title: "Senior Software Engineer",
          company: "Tech Corp",
          duration: "2020 - Present",
          description: "Led development of microservices architecture...",
        },
      ],
      education: [
        {
          degree: "B.S. Computer Science",
          institution: "University of Technology",
          year: "2018",
        },
      ],
      skills: ["JavaScript", "React", "Node.js", "MongoDB", "Docker"],
      certifications: ["AWS Certified Developer", "Google Cloud Professional"],
    },
  };
}

// Generate enhanced ATS suggestions
function generateEnhancedSuggestions(resume) {
  const suggestions = [...resume.suggestions];

  if (resume.atsScore < 80) {
    suggestions.push({
      category: "overall",
      message: "Optimize your resume for ATS with our AI-powered suggestions",
      priority: "high",
    });
  }

  if (!resume.parsedData?.summary) {
    suggestions.push({
      category: "content",
      message: "Add a professional summary at the top of your resume",
      priority: "high",
    });
  }

  return suggestions;
}

// Calculate profile strength
function calculateProfileStrength(resumes, videos) {
  let strength = 0;

  // Resume presence (40%)
  if (resumes.length > 0) strength += 20;
  if (resumes.some((r) => r.isPrimary)) strength += 10;
  if (resumes.length > 1) strength += 10;

  // ATS Score (30%)
  const avgScore = resumes.length > 0
    ? resumes.reduce((sum, r) => sum + (r.atsScore || 0), 0) / resumes.length
    : 0;
  strength += Math.round(avgScore * 0.3);

  // Video presence (20%)
  if (videos.length > 0) strength += 10;
  if (videos.some((v) => v.isPrimary)) strength += 10;

  // Activity (10%)
  const totalViews = resumes.reduce((sum, r) => sum + (r.views || 0), 0);
  if (totalViews > 10) strength += 5;
  if (totalViews > 50) strength += 5;

  return Math.min(100, strength);
}
