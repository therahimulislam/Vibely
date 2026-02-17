// server/src/services/emailService.js
// Send emails via Google Apps Script relay

const axios = require('axios');

const sendOTPEmail = async (email, otp) => {
    try {
        const response = await axios.post(process.env.EMAIL_SCRIPT_URL, {
            to: email,
            subject: 'Vibely - Email Verification Code',
            body: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 40px; text-align: center;">
            <h1 style="color: white; font-size: 28px; margin: 0 0 8px;">Vibely</h1>
            <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 0;">Secure Messaging Platform</p>
          </div>
          <div style="background: #f8f9fa; border-radius: 16px; padding: 32px; margin-top: 16px; text-align: center;">
            <p style="color: #333; font-size: 16px; margin: 0 0 24px;">Your verification code is:</p>
            <div style="background: white; border: 2px dashed #667eea; border-radius: 12px; padding: 20px; display: inline-block;">
              <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #667eea;">${otp}</span>
            </div>
            <p style="color: #888; font-size: 13px; margin: 24px 0 0;">This code expires in 10 minutes.<br>Do not share it with anyone.</p>
          </div>
        </div>
      `,
        });

        return response.data;
    } catch (error) {
        console.error('Email service error:', error.message);
        throw new Error('Failed to send verification email');
    }
};

module.exports = { sendOTPEmail };
