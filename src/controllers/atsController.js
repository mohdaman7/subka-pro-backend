// backend/src/controllers/atsController.js
import { ApplicationModel } from "../models/Application.js";
import { JobModel } from "../models/Job.js";
import { ResumeModel } from "../models/Resume.js";
import { UserModel } from "../models/User.js";
import { StudentModel } from "../models/Student.js";
import { CandidateNoteModel } from "../models/CandidateNote.js";

// ============================================
// Resume Collection & Parsing
// ============================================

/**
 * Get all resumes with parsing data
 * @route GET /api/admin/ats/resumes
 */
export const getAllResumes = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      minScore,
      skills,
      experience,
      education,
    } = req.query;

    const skip = (page - 1) * limit;
    const filter = {};

    // Search by name or email
    if (search) {
      const users = await UserModel.find({
        $or: [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      filter.studentId = { $in: users.map((u) => u._id) };
    }

    // Filter by ATS score
    if (minScore) {
      filter.atsScore = { $gte: parseInt(minScore) };
    }

    // Filter by skills
    if (skills) {
      const skillsArray = skills.split(",").map((s) => s.trim());
      filter["parsedData.skills"] = { $in: skillsArray };
    }

    // Filter by experience (years)
    if (experience) {
      filter["parsedData.experience"] = { $exists: true, $ne: [] };
    }

    // Filter by education
    if (education) {
      filter["parsedData.education.degree"] = {
        $regex: education,
        $options: "i",
      };
    }

    const resumes = await ResumeModel.find(filter)
      .populate("studentId", "firstName lastName email role status planType")
      .sort({ atsScore: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await ResumeModel.countDocuments(filter);

    res.json({
      success: true,
      data: resumes,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Parse resume and extract data
 * @route POST /api/admin/ats/resumes/:id/parse
 */
export const parseResume = async (req, res, next) => {
  try {
    const { id } = req.params;
    const resume = await ResumeModel.findById(id);

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found",
      });
    }

    // TODO: Implement actual resume parsing logic
    // For now, we'll use mock parsing
    const parsedData = {
      contact: {
        email: resume.parsedData?.contact?.email || "",
        phone: resume.parsedData?.contact?.phone || "",
        linkedin: resume.parsedData?.contact?.linkedin || "",
        portfolio: resume.parsedData?.contact?.portfolio || "",
      },
      summary: resume.parsedData?.summary || "",
      experience: resume.parsedData?.experience || [],
      education: resume.parsedData?.education || [],
      skills: resume.parsedData?.skills || [],
      certifications: resume.parsedData?.certifications || [],
    };

    // Calculate ATS score based on completeness
    let score = 0;
    if (parsedData.contact.email) score += 10;
    if (parsedData.contact.phone) score += 10;
    if (parsedData.summary) score += 15;
    if (parsedData.experience.length > 0) score += 25;
    if (parsedData.education.length > 0) score += 20;
    if (parsedData.skills.length > 0) score += 20;

    resume.parsedData = parsedData;
    resume.atsScore = score;
    await resume.save();

    res.json({
      success: true,
      message: "Resume parsed successfully",
      data: resume,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get resume statistics
 * @route GET /api/admin/ats/resumes/stats
 */
export const getResumeStats = async (req, res, next) => {
  try {
    const stats = await ResumeModel.aggregate([
      {
        $group: {
          _id: null,
          totalResumes: { $sum: 1 },
          avgScore: { $avg: "$atsScore" },
          highScoreCount: {
            $sum: { $cond: [{ $gte: ["$atsScore", 70] }, 1, 0] },
          },
          mediumScoreCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$atsScore", 40] },
                    { $lt: ["$atsScore", 70] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          lowScoreCount: {
            $sum: { $cond: [{ $lt: ["$atsScore", 40] }, 1, 0] },
          },
        },
      },
    ]);

    const topSkills = await ResumeModel.aggregate([
      { $unwind: "$parsedData.skills" },
      {
        $group: {
          _id: "$parsedData.skills",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      stats: stats[0] || {
        totalResumes: 0,
        avgScore: 0,
        highScoreCount: 0,
        mediumScoreCount: 0,
        lowScoreCount: 0,
      },
      topSkills: topSkills.map((s) => ({ skill: s._id, count: s.count })),
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Job Posting Management (ATS View)
// ============================================

/**
 * Get all jobs with application counts
 * @route GET /api/admin/ats/jobs
 */
export const getATSJobs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      search,
      assignedTo,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const skip = (page - 1) * limit;
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { department: { $regex: search, $options: "i" } },
        { location: { $regex: search, $options: "i" } },
      ];
    }

    // Note: assignedStaff field not in Job schema, skipping filter
    // if (assignedTo) {
    //   filter.assignedStaff = assignedTo;
    // }

    const jobs = await JobModel.find(filter)
      .populate("employerId", "firstName lastName email companyName")
      .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get application counts for each job
    const jobsWithCounts = await Promise.all(
      jobs.map(async (job) => {
        const applicationCount = await ApplicationModel.countDocuments({
          jobId: job._id,
        });

        const statusBreakdown = await ApplicationModel.aggregate([
          { $match: { jobId: job._id } },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
            },
          },
        ]);

        return {
          ...job,
          applicationCount,
          statusBreakdown: statusBreakdown.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
        };
      })
    );

    const total = await JobModel.countDocuments(filter);

    res.json({
      success: true,
      data: jobsWithCounts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign job to staff member
 * @route POST /api/admin/ats/jobs/:jobId/assign
 */
export const assignJobToStaff = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const { staffId } = req.body;

    const job = await JobModel.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const staff = await UserModel.findById(staffId);
    if (!staff || staff.role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "Invalid staff member",
      });
    }

    job.assignedStaff = staffId;
    await job.save();

    res.json({
      success: true,
      message: "Job assigned successfully",
      data: job,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get job statistics for ATS
 * @route GET /api/admin/ats/jobs/stats
 */
export const getJobStats = async (req, res, next) => {
  try {
    const totalJobs = await JobModel.countDocuments();
    const activeJobs = await JobModel.countDocuments({ status: "active" });
    const draftJobs = await JobModel.countDocuments({ status: "draft" });
    const closedJobs = await JobModel.countDocuments({ status: "closed" });

    const totalApplications = await ApplicationModel.countDocuments();

    const applicationsByStatus = await ApplicationModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const topJobs = await ApplicationModel.aggregate([
      {
        $group: {
          _id: "$jobId",
          applicationCount: { $sum: 1 },
        },
      },
      { $sort: { applicationCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "jobs",
          localField: "_id",
          foreignField: "_id",
          as: "job",
        },
      },
      { $unwind: "$job" },
      {
        $project: {
          jobTitle: "$job.title",
          applicationCount: 1,
        },
      },
    ]);

    res.json({
      success: true,
      stats: {
        totalJobs,
        activeJobs,
        draftJobs,
        closedJobs,
        totalApplications,
        applicationsByStatus: applicationsByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        topJobs,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// Candidate Filtering & Search
// ============================================

/**
 * Advanced candidate search with filters
 * @route GET /api/admin/ats/candidates/search
 */
export const searchCandidates = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      keywords,
      education,
      minExperience,
      maxExperience,
      skills,
      appliedJob,
      status,
      minScore,
      location,
    } = req.query;

    const skip = (page - 1) * limit;

    // Build user filter
    const userFilter = { role: "student" };
    if (status) {
      userFilter.status = status;
    }

    // Build resume filter
    const resumeFilter = {};

    if (minScore) {
      resumeFilter.atsScore = { $gte: parseInt(minScore) };
    }

    if (keywords) {
      resumeFilter.$or = [
        { "parsedData.summary": { $regex: keywords, $options: "i" } },
        { "parsedData.skills": { $regex: keywords, $options: "i" } },
        {
          "parsedData.experience.title": { $regex: keywords, $options: "i" },
        },
        {
          "parsedData.experience.company": { $regex: keywords, $options: "i" },
        },
      ];
    }

    if (education) {
      resumeFilter["parsedData.education.degree"] = {
        $regex: education,
        $options: "i",
      };
    }

    if (skills) {
      const skillsArray = skills.split(",").map((s) => s.trim());
      resumeFilter["parsedData.skills"] = {
        $in: skillsArray.map((s) => new RegExp(s, "i")),
      };
    }

    // Get resumes matching criteria
    const resumes = await ResumeModel.find(resumeFilter)
      .populate({
        path: "studentId",
        match: userFilter,
        select: "firstName lastName email status planType createdAt",
      })
      .sort({ atsScore: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Filter out null studentId (didn't match user filter)
    const validResumes = resumes.filter((r) => r.studentId);

    // If appliedJob filter, get only candidates who applied to that job
    let candidates = validResumes;
    if (appliedJob) {
      const applications = await ApplicationModel.find({
        jobId: appliedJob,
      }).select("studentId");
      const appliedStudentIds = applications.map((a) =>
        a.studentId.toString()
      );

      candidates = validResumes.filter((r) =>
        appliedStudentIds.includes(r.studentId._id.toString())
      );
    }

    // Calculate match score if job is specified
    if (appliedJob) {
      const job = await JobModel.findById(appliedJob);
      if (job) {
        candidates = candidates.map((candidate) => {
          const matchScore = calculateMatchScore(
            candidate.parsedData,
            job.skills || []
          );
          return { ...candidate, matchScore };
        });
        candidates.sort((a, b) => b.matchScore - a.matchScore);
      }
    }

    // Get application history for each candidate
    const candidatesWithHistory = await Promise.all(
      candidates.map(async (candidate) => {
        const applications = await ApplicationModel.find({
          studentId: candidate.studentId._id,
        })
          .populate("jobId", "title status")
          .select("status createdAt jobId")
          .sort({ createdAt: -1 })
          .limit(5);

        return {
          ...candidate,
          applicationHistory: applications,
        };
      })
    );

    const total = await ResumeModel.countDocuments(resumeFilter);

    res.json({
      success: true,
      data: candidatesWithHistory,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calculate match score between candidate and job
 */
function calculateMatchScore(parsedData, jobSkills) {
  if (!parsedData || !parsedData.skills || !jobSkills || jobSkills.length === 0) {
    return 0;
  }

  const candidateSkills = parsedData.skills.map((s) => s.toLowerCase());
  const requiredSkills = jobSkills.map((s) => s.toLowerCase());

  const matchedSkills = requiredSkills.filter((skill) =>
    candidateSkills.some((cs) => cs.includes(skill) || skill.includes(cs))
  );

  return Math.round((matchedSkills.length / requiredSkills.length) * 100);
}

/**
 * Shortlist candidate
 * @route POST /api/admin/ats/candidates/:candidateId/shortlist
 */
export const shortlistCandidate = async (req, res, next) => {
  try {
    const { candidateId } = req.params;
    const { jobId, notes } = req.body;

    const application = await ApplicationModel.findOne({
      studentId: candidateId,
      jobId: jobId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    application.status = "reviewed";
    await application.save();

    // Add note if provided
    if (notes) {
      await CandidateNoteModel.create({
        candidateId,
        authorId: req.user._id,
        content: notes,
        type: "shortlist",
      });
    }

    res.json({
      success: true,
      message: "Candidate shortlisted successfully",
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject candidate
 * @route POST /api/admin/ats/candidates/:candidateId/reject
 */
export const rejectCandidate = async (req, res, next) => {
  try {
    const { candidateId } = req.params;
    const { jobId, reason } = req.body;

    const application = await ApplicationModel.findOne({
      studentId: candidateId,
      jobId: jobId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found",
      });
    }

    application.status = "rejected";
    await application.save();

    // Add rejection note
    if (reason) {
      await CandidateNoteModel.create({
        candidateId,
        authorId: req.user._id,
        content: reason,
        type: "rejection",
      });
    }

    res.json({
      success: true,
      message: "Candidate rejected",
      data: application,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get candidate details with full profile
 * @route GET /api/admin/ats/candidates/:candidateId
 */
export const getCandidateDetails = async (req, res, next) => {
  try {
    const { candidateId } = req.params;

    const user = await UserModel.findById(candidateId).select("-passwordHash");
    if (!user || user.role !== "student") {
      return res.status(404).json({
        success: false,
        message: "Candidate not found",
      });
    }

    const student = await StudentModel.findOne({ userId: candidateId });
    const resumes = await ResumeModel.find({ studentId: candidateId }).sort({
      createdAt: -1,
    });
    const applications = await ApplicationModel.find({
      studentId: candidateId,
    })
      .populate("jobId", "title status department location")
      .sort({ createdAt: -1 });

    const notes = await CandidateNoteModel.find({ candidateId })
      .populate("authorId", "firstName lastName")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        user,
        student,
        resumes,
        applications,
        notes,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add note to candidate
 * @route POST /api/admin/ats/candidates/:candidateId/notes
 */
export const addCandidateNote = async (req, res, next) => {
  try {
    const { candidateId } = req.params;
    const { content, type = "general" } = req.body;

    const note = await CandidateNoteModel.create({
      candidateId,
      authorId: req.user._id,
      content,
      type,
    });

    await note.populate("authorId", "firstName lastName");

    res.json({
      success: true,
      message: "Note added successfully",
      data: note,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get ATS dashboard statistics
 * @route GET /api/admin/ats/dashboard/stats
 */
export const getATSDashboardStats = async (req, res, next) => {
  try {
    // Resume stats
    const totalResumes = await ResumeModel.countDocuments();
    const avgAtsScore = await ResumeModel.aggregate([
      { $group: { _id: null, avg: { $avg: "$atsScore" } } },
    ]);

    // Job stats
    const totalJobs = await JobModel.countDocuments();
    const activeJobs = await JobModel.countDocuments({ status: "active" });

    // Application stats
    const totalApplications = await ApplicationModel.countDocuments();
    const pendingApplications = await ApplicationModel.countDocuments({
      status: "applied",
    });
    const reviewedApplications = await ApplicationModel.countDocuments({
      status: "reviewed",
    });
    const interviewApplications = await ApplicationModel.countDocuments({
      status: "interview",
    });

    // Recent activity
    const recentApplications = await ApplicationModel.find()
      .populate("studentId", "firstName lastName")
      .populate("jobId", "title")
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      success: true,
      stats: {
        resumes: {
          total: totalResumes,
          avgScore: avgAtsScore[0]?.avg || 0,
        },
        jobs: {
          total: totalJobs,
          active: activeJobs,
        },
        applications: {
          total: totalApplications,
          pending: pendingApplications,
          reviewed: reviewedApplications,
          interview: interviewApplications,
        },
        recentActivity: recentApplications,
      },
    });
  } catch (error) {
    next(error);
  }
};
