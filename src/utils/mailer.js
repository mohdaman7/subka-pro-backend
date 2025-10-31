// backend/src/utils/mailer.js
import nodemailer from "nodemailer";
import { env } from "../config/env.js";

const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpSecure === "true",
  auth: {
    user: env.smtpUser,
    pass: env.smtpPass,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.warn("⚠️ SMTP connection error:", error.message);
  } else {
    console.log("✅ SMTP server is ready to send emails");
  }
});

// Send Registration Confirmation Email to User
export async function sendRegistrationConfirmation(user, profile) {
  try {
    const roleDisplayName = user.role === "student" ? "Candidate" : "Employer";
    const nextSteps =
      user.role === "student"
        ? "Our team will review your profile and you'll be able to start exploring job opportunities once approved."
        : "Our team will review your company details and you'll be able to start posting jobs once approved.";

    const mailOptions = {
      from: `"Sabka Pro" <${env.smtpUser}>`,
      to: user.email,
      subject: "🎉 Registration Received - Sabka Pro",
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 0;">
          <table align="center" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">
            <!-- Header -->
            <tr>
              <td align="center" style="background: linear-gradient(135deg, #803791 0%, #b87bd1 100%); padding: 40px 30px;">
                <div style="background-color: rgba(255,255,255,0.2); border-radius: 50%; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                  <span style="font-size: 36px; color: white;">📧</span>
                </div>
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                  Registration Received!
                </h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
                  Welcome to Sabka Pro - Your journey begins here
                </p>
              </td>
            </tr>

            <!-- Main Content -->
            <tr>
              <td style="padding: 40px 30px;">
                <!-- Welcome Message -->
                <div style="text-align: center; margin-bottom: 30px;">
                  <h2 style="color: #2d3748; margin: 0 0 15px 0; font-size: 22px;">
                    Hello ${user.firstName || "there"}! 👋
                  </h2>
                  <p style="color: #718096; font-size: 16px; line-height: 1.6; margin: 0;">
                    Thank you for registering as a <strong>${roleDisplayName}</strong> with Sabka Pro. 
                    We're excited to have you on board!
                  </p>
                </div>

                <!-- Status Card -->
                <div style="background: linear-gradient(135deg, #fff9f0 0%, #fff0f0 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid #803791;">
                  <div style="display: flex; align-items: center; gap: 15px;">
                    <div style="background: #803791; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
                      <span style="color: white; font-size: 18px;">⏳</span>
                    </div>
                    <div>
                      <h3 style="color: #2d3748; margin: 0 0 5px 0; font-size: 18px;">
                        Account Under Review
                      </h3>
                      <p style="color: #718096; margin: 0; font-size: 14px; line-height: 1.5;">
                        Your registration is currently pending admin approval. ${nextSteps}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Registration Details -->
                <div style="background-color: #f8fafc; border-radius: 12px; padding: 25px; margin: 25px 0;">
                  <h3 style="color: #2d3748; margin: 0 0 20px 0; font-size: 18px; text-align: center;">
                    📋 Registration Details
                  </h3>
                  
                  <table width="100%" cellpadding="12" cellspacing="0" style="border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="font-weight: 600; color: #4a5568; width: 140px;">Name</td>
                      <td style="color: #2d3748;">${user.firstName || ""} ${
        user.lastName || ""
      }</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="font-weight: 600; color: #4a5568;">Email</td>
                      <td style="color: #2d3748;">${user.email}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="font-weight: 600; color: #4a5568;">Role</td>
                      <td style="color: #2d3748;">
                        <span style="background: #803791; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                          ${roleDisplayName}
                        </span>
                      </td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="font-weight: 600; color: #4a5568;">Status</td>
                      <td style="color: #2d3748;">
                        <span style="background: #f59e0b; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">
                          ⏳ Pending Approval
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style="font-weight: 600; color: #4a5568;">Registered On</td>
                      <td style="color: #2d3748;">${new Date(
                        user.createdAt
                      ).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}</td>
                    </tr>
                  </table>
                </div>

                <!-- What's Next -->
                <div style="background-color: #f0fff4; border-radius: 12px; padding: 25px; margin: 25px 0; border: 1px solid #c6f6d5;">
                  <h3 style="color: #2d3748; margin: 0 0 15px 0; font-size: 18px; display: flex; align-items: center; gap: 10px;">
                    <span style="background: #48bb78; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 14px;">✓</span>
                    What Happens Next?
                  </h3>
                  <ul style="color: #718096; margin: 0; padding-left: 20px; line-height: 1.6;">
                    <li>Our team will review your registration details</li>
                    <li>You'll receive an approval email within 24-48 hours</li>
                    <li>Once approved, you can access all platform features</li>
                    <li>We may contact you for additional verification if needed</li>
                  </ul>
                </div>

                <!-- Support Info -->
                <div style="text-align: center; margin-top: 30px; padding-top: 25px; border-top: 1px solid #e2e8f0;">
                  <p style="color: #718096; font-size: 14px; margin: 0 0 15px 0;">
                    Need help or have questions?
                  </p>
                  <a href="mailto:${env.smtpUser}" 
                     style="background: linear-gradient(135deg, #803791 0%, #b87bd1 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block;">
                    📞 Contact Support
                  </a>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" style="background-color: #2d3748; padding: 25px; color: #a0aec0; font-size: 13px;">
                <p style="margin: 0 0 10px 0;">
                  © ${new Date().getFullYear()} Sabka Pro. All rights reserved.
                </p>
                <p style="margin: 0; font-size: 12px;">
                  Building better careers, connecting great talent with amazing opportunities.
                </p>
                <div style="margin-top: 15px;">
                  <a href="${
                    env.corsOrigin || "http://localhost:3000"
                  }" style="color: #b87bd1; text-decoration: none; margin: 0 10px;">Website</a>
                  <span style="color: #4a5568;">•</span>
                  <a href="#" style="color: #b87bd1; text-decoration: none; margin: 0 10px;">Privacy Policy</a>
                  <span style="color: #4a5568;">•</span>
                  <a href="#" style="color: #b87bd1; text-decoration: none; margin: 0 10px;">Terms of Service</a>
                </div>
              </td>
            </tr>
          </table>
        </div>
      `,
      text: `
Welcome to Sabka Pro!

Hello ${user.firstName || "there"}!

Thank you for registering as a ${roleDisplayName} with Sabka Pro. We're excited to have you on board!

📋 YOUR REGISTRATION DETAILS:
Name: ${user.firstName || ""} ${user.lastName || ""}
Email: ${user.email}
Role: ${roleDisplayName}
Status: ⏳ Pending Approval
Registered On: ${new Date(user.createdAt).toLocaleDateString()}

⏳ ACCOUNT STATUS:
Your registration is currently pending admin approval. ${nextSteps}

📞 WHAT HAPPENS NEXT?
• Our team will review your registration details
• You'll receive an approval email within 24-48 hours
• Once approved, you can access all platform features
• We may contact you for additional verification if needed

Need help? Contact our support team at: ${env.smtpUser}

© ${new Date().getFullYear()} Sabka Pro. All rights reserved.
Building better careers, connecting great talent with amazing opportunities.
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Registration confirmation sent to: ${user.email}`);
  } catch (error) {
    console.error(
      "❌ Failed to send registration confirmation:",
      error.message
    );
    throw error;
  }
}

// Send Registration Alert Email (Enhanced)
export async function sendRegistrationAlert(user, profile) {
  try {
    const profileDetails = profile?.toObject() || {};

    let additionalInfo = "";
    if (user.role === "student") {
      additionalInfo = `
        <tr>
          <td style="font-weight: bold; color: #111;">Experience Type:</td>
          <td>${profileDetails.experienceType || "N/A"}</td>
        </tr>
        <tr style="background-color: #f3f4f6;">
          <td style="font-weight: bold; color: #111;">Location:</td>
          <td>${profileDetails.address?.city || "N/A"}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #111;">KYC Document:</td>
          <td>${profileDetails.kycInfo?.type || "N/A"} - ${
        profileDetails.kycInfo?.number || "N/A"
      }</td>
        </tr>
      `;
    } else if (user.role === "employer") {
      additionalInfo = `
        <tr>
          <td style="font-weight: bold; color: #111;">Company:</td>
          <td>${profileDetails.company?.name || "N/A"}</td>
        </tr>
        <tr style="background-color: #f3f4f6;">
          <td style="font-weight: bold; color: #111;">Position:</td>
          <td>${profileDetails.position || "N/A"}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #111;">Industry:</td>
          <td>${profileDetails.company?.industry || "N/A"}</td>
        </tr>
        <tr style="background-color: #f3f4f6;">
          <td style="font-weight: bold; color: #111;">Location:</td>
          <td>${profileDetails.contact?.address?.city || "N/A"}</td>
        </tr>
      `;
    }

    const mailOptions = {
      from: `"Sabka Pro" <${env.smtpUser}>`,
      to: env.adminEmail,
      subject: `🔔 New ${user.role.toUpperCase()} Registration Pending Approval`,
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f9fc; padding: 40px 0;">
          <table align="center" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
            <tr>
              <td align="center" style="background-color: #002b5b; padding: 20px;">
                <h1 style="color: #ffffff; margin: 0; font-size: 22px;">⏳ Approval Required</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 30px;">
                <p style="font-size: 16px; color: #333;">Hello Admin,</p>
                <p style="font-size: 15px; color: #444;">A new <strong>${
                  user.role
                }</strong> has registered and is waiting for your approval:</p>
                
                <table width="100%" cellpadding="8" cellspacing="0" style="margin-top: 10px; border-collapse: collapse;">
                  <tr style="background-color: #f3f4f6;">
                    <td style="font-weight: bold; color: #111;">Name:</td>
                    <td>${user.firstName || ""} ${user.lastName || ""}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold; color: #111;">Email:</td>
                    <td>${user.email}</td>
                  </tr>
                  <tr style="background-color: #f3f4f6;">
                    <td style="font-weight: bold; color: #111;">Role:</td>
                    <td>${user.role}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold; color: #111;">Phone:</td>
                    <td>${
                      profileDetails.phone ||
                      profileDetails.contact?.phone ||
                      "N/A"
                    }</td>
                  </tr>
                  ${additionalInfo}
                  <tr style="background-color: #f3f4f6;">
                    <td style="font-weight: bold; color: #111;">Registered On:</td>
                    <td>${new Date(user.createdAt).toLocaleString()}</td>
                  </tr>
                </table>

                <div style="text-align: center; margin-top: 30px; padding: 20px; background-color: #fff3cd; border-radius: 8px;">
                  <p style="margin: 0; color: #856404; font-weight: 600;">⚠️ This user is pending approval</p>
                </div>
                
                <div style="text-align: center; margin-top: 30px;">
                  <a href="${
                    env.corsOrigin || "http://localhost:3000"
                  }/admin/leads" 
                     style="background-color: #28a745; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 15px; margin-right: 10px; display: inline-block;">
                    ✅ Approve
                  </a>
                  <a href="${
                    env.corsOrigin || "http://localhost:3000"
                  }/admin/leads" 
                     style="background-color: #dc3545; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 15px; display: inline-block;">
                    ❌ Reject
                  </a>
                </div>
              </td>
            </tr>
            <tr>
              <td align="center" style="background-color: #f3f4f6; padding: 15px; font-size: 13px; color: #777;">
                © ${new Date().getFullYear()} Sabka Pro. All rights reserved.
              </td>
            </tr>
          </table>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📩 Admin notified about new ${user.role}: ${user.email}`);
  } catch (error) {
    console.error("❌ Failed to send registration alert:", error.message);
    throw error;
  }
}

// Send Approval Email with Credentials
export async function sendApprovalEmail(user, password) {
  try {
    const mailOptions = {
      from: `"Sabka Pro" <${env.smtpUser}>`,
      to: user.email,
      subject: "✅ Your Account Has Been Approved - Sabka Pro",
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f9fc; padding: 40px 0;">
          <table align="center" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
            <tr>
              <td align="center" style="background-color: #28a745; padding: 30px;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">🎉 Account Approved!</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 40px 30px;">
                <p style="font-size: 18px; color: #333;">
                  Hi ${user.firstName || "there"}! 👋
                </p>
                
                <p style="font-size: 15px; color: #444; line-height: 1.6;">
                  Great news! Your <strong>Sabka Pro</strong> account has been approved by our admin team.
                </p>
                
                <div style="background-color: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 25px 0; border-radius: 4px;">
                  <h3 style="margin: 0 0 15px 0; color: #155724;">Your Login Credentials:</h3>
                  <table width="100%" cellpadding="8" style="background-color: white; border-radius: 4px;">
                    <tr>
                      <td style="font-weight: bold; color: #155724; width: 120px;">Username:</td>
                      <td style="color: #155724; font-family: 'Courier New', monospace;">${
                        user.email
                      }</td>
                    </tr>
                    <tr>
                      <td style="font-weight: bold; color: #155724;">Password:</td>
                      <td style="color: #155724; font-family: 'Courier New', monospace; font-size: 16px; letter-spacing: 1px;">${password}</td>
                    </tr>
                  </table>
                </div>

                <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <p style="margin: 0; color: #856404; font-size: 14px;">
                    ⚠️ <strong>Important:</strong> Please change your password after your first login for security purposes.
                  </p>
                </div>
                
                <p style="font-size: 15px; color: #444; line-height: 1.6; margin-top: 25px;">
                  ${
                    user.role === "student"
                      ? "You can now start exploring job opportunities and apply for positions that match your skills."
                      : "You can now start posting jobs and managing applications from qualified candidates."
                  }
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${env.corsOrigin || "http://localhost:3000"}/${
        user.role
      }/login" 
                     style="background-color: #002b5b; color: white; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 16px; display: inline-block;">
                    Login to Your Account
                  </a>
                </div>
                
                <p style="font-size: 14px; color: #666; margin-top: 30px; line-height: 1.6;">
                  If you have any questions or need assistance, feel free to reach out to our support team at 
                  <a href="mailto:${env.smtpUser}" style="color: #002b5b;">${
        env.smtpUser
      }</a>
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="background-color: #f3f4f6; padding: 15px; font-size: 13px; color: #777;">
                © ${new Date().getFullYear()} Sabka Pro. All rights reserved.
              </td>
            </tr>
          </table>
        </div>
      `,
      text: `
Hi ${user.firstName || "there"}!

Your Sabka Pro account has been approved!

Login Credentials:
Username: ${user.email}
Password: ${password}

IMPORTANT: Please change your password after your first login.

Login here: ${env.corsOrigin || "http://localhost:3000"}/${user.role}/login

If you have any questions, contact us at ${env.smtpUser}

© ${new Date().getFullYear()} Sabka Pro. All rights reserved.
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Approval email sent to: ${user.email}`);
  } catch (error) {
    console.error("❌ Failed to send approval email:", error.message);
    throw error;
  }
}

// Send job moderation status email to employer
export async function sendJobModerationEmail({ to, jobTitle, action, reasonOrNote }) {
  try {
    const subjectMap = {
      approved: `✅ Your job "${jobTitle}" has been approved`,
      rejected: `❌ Your job "${jobTitle}" was rejected`,
      needs_changes: `✏️ Changes requested for your job "${jobTitle}"`,
    };

    const messageMap = {
      approved:
        "Your job posting has been approved by our moderation team. You can now activate it to make it visible to candidates.",
      rejected:
        "Unfortunately, your job posting was rejected. Please review the reason below and consider submitting a revised posting.",
      needs_changes:
        "We have reviewed your job posting and require some changes. Please review the notes below and update your posting.",
    };

    const html = `
      <div style="font-family: Arial, sans-serif;">
        <h2>Job Moderation Update</h2>
        <p><strong>Job:</strong> ${jobTitle}</p>
        <p><strong>Status:</strong> ${action.replace("_", " ")}</p>
        <p>${messageMap[action] || ""}</p>
        ${reasonOrNote ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;padding:12px;border-radius:8px;"><strong>Details:</strong><br/>${reasonOrNote}</div>` : ""}
        <p style="margin-top:16px;">Regards,<br/>Sabka Pro Team</p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Sabka Pro" <${env.smtpUser}>`,
      to,
      subject: subjectMap[action] || `Update on your job ${jobTitle}`,
      html,
    });
  } catch (error) {
    console.error("❌ Failed to send job moderation email:", error.message);
  }
}

// Send OTP Email
export async function sendOTPEmail(email, otp) {
  try {
    const mailOptions = {
      from: `"Sabka Pro" <${env.smtpUser}>`,
      to: email,
      subject: "Your OTP Code - Sabka Pro",
      html: `
        <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f6f9fc; padding: 40px 0;">
          <table align="center" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
            <tr>
              <td align="center" style="background-color: #002b5b; padding: 30px;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Email Verification</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 40px 30px; text-align: center;">
                <p style="font-size: 16px; color: #333; margin-bottom: 30px;">
                  Your One-Time Password (OTP) for registration:
                </p>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; display: inline-block; margin: 20px 0;">
                  <h2 style="color: #002b5b; font-size: 36px; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">
                    ${otp}
                  </h2>
                </div>
                
                <p style="font-size: 14px; color: #666; margin-top: 30px;">
                  This OTP will expire in <strong>10 minutes</strong>.<br>
                  Please do not share this code with anyone.
                </p>
                
                <p style="font-size: 13px; color: #999; margin-top: 20px;">
                  If you didn't request this OTP, please ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="background-color: #f3f4f6; padding: 15px; font-size: 13px; color: #777;">
                © ${new Date().getFullYear()} Sabka Pro. All rights reserved.
              </td>
            </tr>
          </table>
        </div>
      `,
      text: `Your OTP for Sabka Pro registration is: ${otp}\n\nThis code will expire in 10 minutes.\nIf you didn't request this OTP, please ignore this email.`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 OTP email sent to: ${email}`);
  } catch (error) {
    console.error("❌ Failed to send OTP email:", error.message);
  }
}
