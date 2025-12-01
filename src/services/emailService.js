const nodemailer = require('nodemailer');

/**
 * Email service using nodemailer
 */

/**
 * Create transporter based on SMTP configuration
 */
const createTransporter = () => {
  const config = {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  };

  // Return null if not configured
  if (!config.host || !config.auth.user) {
    return null;
  }

  return nodemailer.createTransport(config);
};

/**
 * Send email to owner about form submission
 */
const sendOwnerNotification = async (formType, formData, metadata) => {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.log('[EMAIL] SMTP not configured, skipping owner notification');
    return { sent: false, reason: 'SMTP not configured' };
  }

  const ownerEmail = process.env.OWNER_EMAIL;
  if (!ownerEmail) {
    console.log('[EMAIL] Owner email not configured');
    return { sent: false, reason: 'Owner email not configured' };
  }

  const subject = `New ${formType} Form Submission`;
  const html = `
    <h2>New ${formType} Form Submission</h2>
    <p><strong>Name:</strong> ${escapeHtml(formData.name)}</p>
    <p><strong>Organization:</strong> ${escapeHtml(formData.org || 'N/A')}</p>
    <p><strong>Email:</strong> ${escapeHtml(formData.email)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(formData.phone || 'N/A')}</p>
    <p><strong>Notes:</strong></p>
    <p>${escapeHtml(formData.notes || 'N/A')}</p>
    <hr>
    <p><small>IP: ${metadata.ip} | User-Agent: ${escapeHtml(metadata.userAgent)} | Time: ${metadata.timestamp}</small></p>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: ownerEmail,
      subject,
      html
    });
    console.log(`[EMAIL] Owner notification sent for ${formType} form`);
    return { sent: true };
  } catch (error) {
    console.error('[EMAIL] Failed to send owner notification:', error);
    return { sent: false, reason: error.message };
  }
};

/**
 * Send auto-reply to form submitter
 */
const sendAutoReply = async (formType, formData) => {
  const transporter = createTransporter();
  
  if (!transporter) {
    console.log('[EMAIL] SMTP not configured, skipping auto-reply');
    return { sent: false, reason: 'SMTP not configured' };
  }

  const subject = `Thank you for your ${formType}`;
  const html = `
    <h2>Thank you for reaching out!</h2>
    <p>Dear ${escapeHtml(formData.name)},</p>
    <p>We have received your ${formType} and will get back to you as soon as possible.</p>
    <br>
    <p><strong>Summary of your submission:</strong></p>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(formData.name)}</li>
      <li><strong>Organization:</strong> ${escapeHtml(formData.org || 'N/A')}</li>
      <li><strong>Email:</strong> ${escapeHtml(formData.email)}</li>
      <li><strong>Phone:</strong> ${escapeHtml(formData.phone || 'N/A')}</li>
    </ul>
    <br>
    <p>Best regards,<br>The MTCM Team</p>
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: formData.email,
      subject,
      html
    });
    console.log(`[EMAIL] Auto-reply sent to ${formData.email}`);
    return { sent: true };
  } catch (error) {
    console.error('[EMAIL] Failed to send auto-reply:', error);
    return { sent: false, reason: error.message };
  }
};

/**
 * Escape HTML to prevent XSS in emails
 */
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

module.exports = {
  sendOwnerNotification,
  sendAutoReply,
  createTransporter,
  escapeHtml
};
