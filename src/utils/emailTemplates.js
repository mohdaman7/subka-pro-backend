// Professional email templates for Sabka Pro
import { env } from "../config/env.js";

const baseStyles = {
  container: "font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 0;",
  table: "background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);",
  header: "background: linear-gradient(135deg, #803791 0%, #b87bd1 100%); padding: 40px 30px;",
  footer: "background-color: #2d3748; padding: 25px; color: #a0aec0; font-size: 13px;",
};

export const emailTemplates = {
  // Application Status Change Email
  applicationStatusChange: (data) => `
    <div style="${baseStyles.container}">
      <table align="center" width="600" cellpadding="0" cellspacing="0" style="${baseStyles.table}">
        <tr>
          <td align="center" style="${baseStyles.header}">
            <div style="background-color: rgba(255,255,255,0.2); border-radius: 50%; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
              <span style="font-size: 36px; color: white;">${data.statusEmoji}</span>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
              Application Status Update
            </h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
              ${data.jobTitle}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="color: #2d3748; margin: 0 0 15px 0; font-size: 22px;">
              Hello ${data.candidateName}! 👋
            </h2>
            <p style="color: #718096; font-size: 16px; line-height: 1.6;">
              Your application status has been updated to <strong style="color: #803791;">${data.newStatus}</strong>.
            </p>
            
            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #803791;">
              <h3 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px;">📋 Application Details</h3>
              <table width="100%" cellpadding="8">
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Position:</td>
                  <td style="color: #2d3748;">${data.jobTitle}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Company:</td>
                  <td style="color: #2d3748;">${data.companyName}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Status:</td>
                  <td><span style="background: ${data.statusColor}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">${data.newStatus}</span></td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Updated:</td>
                  <td style="color: #2d3748;">${new Date().toLocaleDateString()}</td>
                </tr>
              </table>
            </div>

            ${data.message ? `
            <div style="background-color: #f0fff4; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #c6f6d5;">
              <p style="color: #2d3748; margin: 0; line-height: 1.6;">${data.message}</p>
            </div>
            ` : ''}

            <div style="text-align: center; margin-top: 30px;">
              <a href="${env.corsOrigin}/student/applications" 
                 style="background: linear-gradient(135deg, #803791 0%, #b87bd1 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                View Application
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td align="center" style="${baseStyles.footer}">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} Sabka Pro. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </div>
  `,

  // Interview Scheduled Email
  interviewScheduled: (data) => `
    <div style="${baseStyles.container}">
      <table align="center" width="600" cellpadding="0" cellspacing="0" style="${baseStyles.table}">
        <tr>
          <td align="center" style="${baseStyles.header}">
            <div style="background-color: rgba(255,255,255,0.2); border-radius: 50%; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
              <span style="font-size: 36px; color: white;">📅</span>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
              Interview Scheduled!
            </h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
              ${data.jobTitle} - ${data.stage} Round
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="color: #2d3748; margin: 0 0 15px 0; font-size: 22px;">
              Hello ${data.candidateName}! 👋
            </h2>
            <p style="color: #718096; font-size: 16px; line-height: 1.6;">
              Great news! Your interview has been scheduled for <strong>${data.jobTitle}</strong> at <strong>${data.companyName}</strong>.
            </p>
            
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #f59e0b;">
              <h3 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px;">📅 Interview Details</h3>
              <table width="100%" cellpadding="8">
                <tr>
                  <td style="font-weight: 600; color: #4a5568; width: 140px;">Date & Time:</td>
                  <td style="color: #2d3748; font-weight: 600; font-size: 16px;">${data.dateTime}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Duration:</td>
                  <td style="color: #2d3748;">${data.duration} minutes</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Type:</td>
                  <td style="color: #2d3748;">${data.type}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Stage:</td>
                  <td style="color: #2d3748;">${data.stage}</td>
                </tr>
                ${data.meetingLink ? `
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Meeting Link:</td>
                  <td><a href="${data.meetingLink}" style="color: #803791; word-break: break-all;">${data.meetingLink}</a></td>
                </tr>
                ` : ''}
                ${data.location ? `
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Location:</td>
                  <td style="color: #2d3748;">${data.location}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            ${data.interviewers && data.interviewers.length > 0 ? `
            <div style="background-color: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #2d3748; margin: 0 0 15px 0; font-size: 16px;">👥 Interview Panel</h3>
              ${data.interviewers.map(interviewer => `
                <div style="margin-bottom: 10px;">
                  <strong style="color: #2d3748;">${interviewer.name}</strong>
                  ${interviewer.role ? `<span style="color: #718096;"> - ${interviewer.role}</span>` : ''}
                </div>
              `).join('')}
            </div>
            ` : ''}

            ${data.notes ? `
            <div style="background-color: #eff6ff; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #dbeafe;">
              <h3 style="color: #2d3748; margin: 0 0 10px 0; font-size: 16px;">📝 Additional Notes</h3>
              <p style="color: #2d3748; margin: 0; line-height: 1.6;">${data.notes}</p>
            </div>
            ` : ''}

            <div style="background-color: #fef2f2; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #fecaca;">
              <h3 style="color: #991b1b; margin: 0 0 10px 0; font-size: 16px;">⚠️ Important Reminders</h3>
              <ul style="color: #7f1d1d; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li>Join 5 minutes before the scheduled time</li>
                <li>Test your audio/video beforehand</li>
                <li>Keep your resume and documents ready</li>
                <li>Dress professionally</li>
              </ul>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${env.corsOrigin}/student/interviews" 
                 style="background: linear-gradient(135deg, #803791 0%, #b87bd1 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                View Interview Details
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td align="center" style="${baseStyles.footer}">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} Sabka Pro. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </div>
  `,

  // Application Received Email
  applicationReceived: (data) => `
    <div style="${baseStyles.container}">
      <table align="center" width="600" cellpadding="0" cellspacing="0" style="${baseStyles.table}">
        <tr>
          <td align="center" style="${baseStyles.header}">
            <div style="background-color: rgba(255,255,255,0.2); border-radius: 50%; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
              <span style="font-size: 36px; color: white;">✅</span>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
              Application Received!
            </h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
              We've received your application
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="color: #2d3748; margin: 0 0 15px 0; font-size: 22px;">
              Hello ${data.candidateName}! 👋
            </h2>
            <p style="color: #718096; font-size: 16px; line-height: 1.6;">
              Thank you for applying to <strong>${data.jobTitle}</strong> at <strong>${data.companyName}</strong>. Your application has been successfully submitted!
            </p>
            
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #22c55e;">
              <h3 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px;">📋 Application Summary</h3>
              <table width="100%" cellpadding="8">
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Position:</td>
                  <td style="color: #2d3748;">${data.jobTitle}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Company:</td>
                  <td style="color: #2d3748;">${data.companyName}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Location:</td>
                  <td style="color: #2d3748;">${data.location || 'Remote'}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Applied On:</td>
                  <td style="color: #2d3748;">${new Date().toLocaleDateString()}</td>
                </tr>
              </table>
            </div>

            <div style="background-color: #eff6ff; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #dbeafe;">
              <h3 style="color: #2d3748; margin: 0 0 10px 0; font-size: 16px;">📌 What's Next?</h3>
              <ul style="color: #2d3748; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li>Our team will review your application</li>
                <li>You'll be notified of any status updates</li>
                <li>If shortlisted, we'll contact you for next steps</li>
                <li>Track your application status in your dashboard</li>
              </ul>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${env.corsOrigin}/student/applications" 
                 style="background: linear-gradient(135deg, #803791 0%, #b87bd1 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                Track Application
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td align="center" style="${baseStyles.footer}">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} Sabka Pro. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </div>
  `,

  // Team Invitation Email
  teamInvitation: (data) => `
    <div style="${baseStyles.container}">
      <table align="center" width="600" cellpadding="0" cellspacing="0" style="${baseStyles.table}">
        <tr>
          <td align="center" style="${baseStyles.header}">
            <div style="background-color: rgba(255,255,255,0.2); border-radius: 50%; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
              <span style="font-size: 36px; color: white;">👥</span>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
              Team Invitation
            </h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
              You've been invited to join a team
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="color: #2d3748; margin: 0 0 15px 0; font-size: 22px;">
              Hello! 👋
            </h2>
            <p style="color: #718096; font-size: 16px; line-height: 1.6;">
              <strong>${data.inviterName}</strong> has invited you to join their team at <strong>${data.companyName}</strong> on Sabka Pro.
            </p>
            
            <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #f59e0b;">
              <h3 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px;">📋 Invitation Details</h3>
              <table width="100%" cellpadding="8">
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Company:</td>
                  <td style="color: #2d3748;">${data.companyName}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Role:</td>
                  <td><span style="background: #803791; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">${data.role}</span></td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Invited By:</td>
                  <td style="color: #2d3748;">${data.inviterName}</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${data.acceptLink}" 
                 style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block; margin-right: 10px;">
                Accept Invitation
              </a>
              <a href="${data.declineLink}" 
                 style="background: #ef4444; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                Decline
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td align="center" style="${baseStyles.footer}">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} Sabka Pro. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </div>
  `,

  // Candidate Hired Email
  candidateHired: (data) => `
    <div style="${baseStyles.container}">
      <table align="center" width="600" cellpadding="0" cellspacing="0" style="${baseStyles.table}">
        <tr>
          <td align="center" style="${baseStyles.header}">
            <div style="background-color: rgba(255,255,255,0.2); border-radius: 50%; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
              <span style="font-size: 36px; color: white;">🎉</span>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">
              Congratulations!
            </h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
              You've been selected for the position
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="color: #2d3748; margin: 0 0 15px 0; font-size: 22px;">
              Dear ${data.candidateName}! 🎊
            </h2>
            <p style="color: #718096; font-size: 16px; line-height: 1.6;">
              We are delighted to inform you that you have been selected for the position of <strong>${data.position}</strong> at <strong>${data.companyName}</strong>!
            </p>
            
            <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #22c55e;">
              <h3 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px;">📋 Offer Details</h3>
              <table width="100%" cellpadding="8">
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Position:</td>
                  <td style="color: #2d3748;">${data.position}</td>
                </tr>
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Company:</td>
                  <td style="color: #2d3748;">${data.companyName}</td>
                </tr>
                ${data.salary ? `
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Salary:</td>
                  <td style="color: #2d3748; font-weight: 600;">₹${data.salary.toLocaleString()}</td>
                </tr>
                ` : ''}
                ${data.joiningDate ? `
                <tr>
                  <td style="font-weight: 600; color: #4a5568;">Joining Date:</td>
                  <td style="color: #2d3748;">${new Date(data.joiningDate).toLocaleDateString()}</td>
                </tr>
                ` : ''}
              </table>
            </div>

            ${data.notes ? `
            <div style="background-color: #eff6ff; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #dbeafe;">
              <h3 style="color: #2d3748; margin: 0 0 10px 0; font-size: 16px;">📝 Additional Information</h3>
              <p style="color: #2d3748; margin: 0; line-height: 1.6;">${data.notes}</p>
            </div>
            ` : ''}

            <div style="background-color: #fef3c7; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #fde68a;">
              <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">📌 Next Steps</h3>
              <ul style="color: #78350f; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li>Our HR team will contact you shortly</li>
                <li>Please review and sign the offer letter</li>
                <li>Complete any pending documentation</li>
                <li>Prepare for your onboarding</li>
              </ul>
            </div>

            <div style="text-align: center; margin-top: 30px;">
              <a href="${env.corsOrigin}/student/applications" 
                 style="background: linear-gradient(135deg, #803791 0%, #b87bd1 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; display: inline-block;">
                View Offer Details
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td align="center" style="${baseStyles.footer}">
            <p style="margin: 0 0 10px 0;">© ${new Date().getFullYear()} Sabka Pro. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </div>
  `,
};
