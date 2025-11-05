/**
 * Migration Script: Move Interview Data from Application to Interview Model
 * 
 * This script migrates all interview data embedded in Application documents
 * to separate Interview documents in the Interview collection.
 * 
 * Usage:
 *   node backend/src/scripts/migrateInterviews.js
 * 
 * Options:
 *   --dry-run    : Preview changes without saving to database
 *   --force      : Skip confirmation prompt
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ApplicationModel } from '../models/Application.js';
import { InterviewModel } from '../models/Interview.js';

// Load environment variables
dotenv.config();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/sabka-pro-hiring';
    await mongoose.connect(mongoUri);
    log('✓ Connected to MongoDB', 'green');
    log(`  Database: ${mongoose.connection.name}`, 'cyan');
  } catch (error) {
    log('✗ Failed to connect to MongoDB', 'red');
    console.error(error);
    process.exit(1);
  }
}

async function disconnectDB() {
  await mongoose.disconnect();
  log('\n✓ Disconnected from MongoDB', 'green');
}

async function getApplicationsWithInterviews() {
  log('Searching for applications with interview data...', 'cyan');
  
  const applications = await ApplicationModel.find({
    'interview.scheduledAt': { $exists: true }
  })
    .populate('jobId', 'title department location')
    .populate('studentId', 'firstName lastName email')
    .populate('employerId', 'firstName lastName companyName email')
    .lean();

  log(`✓ Found ${applications.length} applications with interview data`, 'green');
  return applications;
}

async function checkExistingInterviews(applicationIds) {
  log('\nChecking for existing Interview documents...', 'cyan');
  
  const existingInterviews = await InterviewModel.find({
    applicationId: { $in: applicationIds }
  }).lean();

  if (existingInterviews.length > 0) {
    log(`⚠ Found ${existingInterviews.length} existing Interview documents`, 'yellow');
    log('  These applications already have Interview documents:', 'yellow');
    existingInterviews.forEach(interview => {
      log(`    - Application: ${interview.applicationId}`, 'yellow');
    });
  } else {
    log('✓ No existing Interview documents found', 'green');
  }

  return existingInterviews;
}

function mapInterviewData(application) {
  const interview = application.interview;
  
  // Map panel to interviewers format
  const interviewers = (interview.panel || []).map(panelist => ({
    userId: panelist.userId || null,
    name: panelist.name,
    email: panelist.email,
    role: panelist.role || 'Interviewer',
    isPrimary: panelist.isPrimary || false,
  }));

  // Determine stage from interview type or default
  const stageMap = {
    'hr': 'hr',
    'technical': 'technical',
    'panel': 'final',
    'video': 'screening',
    'phone': 'screening',
    'onsite': 'final',
  };
  const stage = stageMap[interview.type] || 'screening';

  return {
    applicationId: application._id,
    jobId: application.jobId?._id || application.jobId,
    candidateId: application.studentId?._id || application.studentId,
    employerId: application.employerId?._id || application.employerId,
    
    title: `Interview for ${application.jobId?.title || 'Position'}`,
    scheduledAt: interview.scheduledAt,
    timezone: interview.timezone || 'UTC',
    durationMinutes: interview.durationMinutes || 60,
    type: interview.type || 'video',
    
    meetingLink: interview.meetingLink,
    location: interview.location ? {
      address: typeof interview.location === 'string' ? interview.location : interview.location.address,
      room: interview.location.room,
      instructions: interview.location.instructions || interview.notes,
    } : undefined,
    
    interviewers: interviewers.length > 0 ? interviewers : undefined,
    
    status: interview.status || 'scheduled',
    round: interview.round || 1,
    stage: stage,
    
    notes: interview.notes,
    instructions: interview.notes,
    
    // Map feedback to evaluation if exists
    evaluation: interview.feedback ? {
      feedback: interview.feedback,
      recommendation: 'pending',
    } : undefined,
    
    result: interview.status === 'completed' ? 'pending' : 'pending',
    
    // Map history
    history: (interview.history || []).map(h => ({
      action: 'scheduled',
      timestamp: h.timestamp || h.scheduledAt || new Date(),
      performedBy: application.employerId?._id || application.employerId,
      reason: h.reason || 'Migrated from Application model',
      previousData: h,
    })),
    
    createdBy: application.employerId?._id || application.employerId,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

async function previewMigration(applications) {
  logSection('MIGRATION PREVIEW (DRY RUN)');
  
  log(`Total applications to migrate: ${applications.length}`, 'cyan');
  console.log();

  applications.slice(0, 5).forEach((app, index) => {
    const interview = app.interview;
    log(`${index + 1}. Application ID: ${app._id}`, 'bright');
    log(`   Job: ${app.jobId?.title || 'N/A'}`, 'cyan');
    log(`   Candidate: ${app.studentId?.firstName} ${app.studentId?.lastName}`, 'cyan');
    log(`   Scheduled: ${interview.scheduledAt ? new Date(interview.scheduledAt).toLocaleString() : 'N/A'}`, 'cyan');
    log(`   Type: ${interview.type || 'N/A'}`, 'cyan');
    log(`   Status: ${interview.status || 'N/A'}`, 'cyan');
    console.log();
  });

  if (applications.length > 5) {
    log(`... and ${applications.length - 5} more`, 'yellow');
  }
}

async function performMigration(applications, skipExisting = true) {
  logSection('PERFORMING MIGRATION');
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const errors = [];

  // Check which applications already have Interview documents
  const applicationIds = applications.map(app => app._id);
  const existingInterviews = await InterviewModel.find({
    applicationId: { $in: applicationIds }
  }).lean();
  const existingAppIds = new Set(existingInterviews.map(i => i.applicationId.toString()));

  for (const application of applications) {
    try {
      // Skip if Interview document already exists
      if (skipExisting && existingAppIds.has(application._id.toString())) {
        skipCount++;
        log(`⊘ Skipped: ${application._id} (Interview already exists)`, 'yellow');
        continue;
      }

      const interviewData = mapInterviewData(application);
      
      // Create Interview document
      await InterviewModel.create(interviewData);
      
      successCount++;
      log(`✓ Migrated: ${application._id} → ${application.jobId?.title || 'Position'}`, 'green');
      
    } catch (error) {
      errorCount++;
      errors.push({
        applicationId: application._id,
        error: error.message,
      });
      log(`✗ Error: ${application._id} - ${error.message}`, 'red');
    }
  }

  return { successCount, skipCount, errorCount, errors };
}

async function promptConfirmation(applications) {
  if (isForce) {
    return true;
  }

  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    log('\n⚠ WARNING: This will create Interview documents for all applications with interview data.', 'yellow');
    log(`Total applications to migrate: ${applications.length}`, 'cyan');
    
    rl.question('\nDo you want to proceed? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function cleanupApplicationInterviews(applicationIds) {
  logSection('CLEANUP (OPTIONAL)');
  
  log('Do you want to remove interview data from Application documents?', 'yellow');
  log('This will set application.interview to undefined for migrated applications.', 'yellow');
  
  if (isForce) {
    log('Skipping cleanup (use interactive mode to cleanup)', 'cyan');
    return;
  }

  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('\nCleanup application.interview fields? (yes/no): ', async (answer) => {
      rl.close();
      
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        try {
          const result = await ApplicationModel.updateMany(
            { _id: { $in: applicationIds } },
            { $unset: { interview: "" } }
          );
          
          log(`✓ Cleaned up ${result.modifiedCount} applications`, 'green');
        } catch (error) {
          log(`✗ Cleanup failed: ${error.message}`, 'red');
        }
      } else {
        log('Cleanup skipped. Interview data remains in Application documents.', 'cyan');
      }
      
      resolve();
    });
  });
}

async function main() {
  try {
    logSection('INTERVIEW DATA MIGRATION SCRIPT');
    
    if (isDryRun) {
      log('🔍 DRY RUN MODE - No changes will be made to the database', 'yellow');
    }
    
    // Connect to database
    await connectDB();
    
    // Get applications with interview data
    const applications = await getApplicationsWithInterviews();
    
    if (applications.length === 0) {
      log('\n✓ No applications with interview data found. Nothing to migrate.', 'green');
      await disconnectDB();
      return;
    }

    // Check for existing interviews
    const applicationIds = applications.map(app => app._id);
    await checkExistingInterviews(applicationIds);

    // Preview migration
    await previewMigration(applications);

    if (isDryRun) {
      log('\n✓ Dry run complete. Use without --dry-run to perform migration.', 'green');
      await disconnectDB();
      return;
    }

    // Confirm migration
    const confirmed = await promptConfirmation(applications);
    
    if (!confirmed) {
      log('\n✗ Migration cancelled by user', 'red');
      await disconnectDB();
      return;
    }

    // Perform migration
    const results = await performMigration(applications);

    // Display results
    logSection('MIGRATION RESULTS');
    log(`✓ Successfully migrated: ${results.successCount}`, 'green');
    log(`⊘ Skipped (already exists): ${results.skipCount}`, 'yellow');
    log(`✗ Failed: ${results.errorCount}`, results.errorCount > 0 ? 'red' : 'green');

    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach(err => {
        log(`  - ${err.applicationId}: ${err.error}`, 'red');
      });
    }

    // Optional cleanup
    if (results.successCount > 0) {
      await cleanupApplicationInterviews(applicationIds);
    }

    log('\n✓ Migration complete!', 'green');
    
    await disconnectDB();
    
  } catch (error) {
    log('\n✗ Migration failed', 'red');
    console.error(error);
    await disconnectDB();
    process.exit(1);
  }
}

// Run migration
main();
