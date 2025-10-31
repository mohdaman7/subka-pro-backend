// backend/src/config/plan.js
export const planLimits = {
  student: {
    free: {
      maxApplicationsPerMonth: 15,
    },
    pro: {
      maxApplicationsPerMonth: Infinity,
    },
  },
  employer: {
    free: {
      maxActiveJobs: 2,
    },
    pro: {
      maxActiveJobs: Infinity,
    },
  },
};
