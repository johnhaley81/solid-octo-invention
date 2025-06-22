const crypto = require('crypto');
const db = require('../config/database');

class OTPService {
  /**
   * Generate a 6-digit OTP
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate a secure token for email verification/password reset
   */
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create and store an OTP token
   */
  async createOTP(userId, token, tokenType, expiresAt) {
    // First, clean up any existing tokens of the same type for this user
    await this.cleanupUserTokens(userId, tokenType);

    const query = `
      INSERT INTO otp_tokens (user_id, token, token_type, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    const result = await db.query(query, [userId, token, tokenType, expiresAt]);
    return result.rows[0];
  }

  /**
   * Verify an OTP token
   */
  async verifyOTP(userId, token, tokenType) {
    const maxAttempts = 3;
    
    // Find the token
    const findQuery = `
      SELECT * FROM otp_tokens 
      WHERE user_id = $1 AND token = $2 AND token_type = $3 
      AND expires_at > CURRENT_TIMESTAMP AND used_at IS NULL
    `;
    
    const result = await db.query(findQuery, [userId, token, tokenType]);
    
    if (result.rows.length === 0) {
      return false;
    }

    const otpRecord = result.rows[0];
    
    // Check attempts
    if (otpRecord.attempts >= maxAttempts) {
      return false;
    }

    // Increment attempts
    const updateQuery = `
      UPDATE otp_tokens 
      SET attempts = attempts + 1
      WHERE id = $1
    `;
    await db.query(updateQuery, [otpRecord.id]);

    // If token matches, mark as used
    if (otpRecord.token === token) {
      const markUsedQuery = `
        UPDATE otp_tokens 
        SET used_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      await db.query(markUsedQuery, [otpRecord.id]);
      return true;
    }

    return false;
  }

  /**
   * Clean up expired tokens
   */
  async cleanupExpiredTokens() {
    const query = 'DELETE FROM otp_tokens WHERE expires_at < CURRENT_TIMESTAMP';
    await db.query(query);
  }

  /**
   * Clean up existing tokens of a specific type for a user
   */
  async cleanupUserTokens(userId, tokenType) {
    const query = `
      DELETE FROM otp_tokens 
      WHERE user_id = $1 AND token_type = $2 AND used_at IS NULL
    `;
    await db.query(query, [userId, tokenType]);
  }

  /**
   * Get token statistics for rate limiting
   */
  async getTokenStats(userId, tokenType, timeWindow = 60) {
    const query = `
      SELECT COUNT(*) as count
      FROM otp_tokens 
      WHERE user_id = $1 AND token_type = $2 
      AND created_at > CURRENT_TIMESTAMP - INTERVAL '${timeWindow} minutes'
    `;
    
    const result = await db.query(query, [userId, tokenType]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Check if user has exceeded rate limits for token generation
   */
  async checkRateLimit(userId, tokenType) {
    const limits = {
      'email_verification': { count: 3, window: 60 }, // 3 per hour
      'login_otp': { count: 5, window: 15 }, // 5 per 15 minutes
      'password_reset': { count: 3, window: 60 } // 3 per hour
    };

    const limit = limits[tokenType];
    if (!limit) {
      return true; // No limit defined, allow
    }

    const count = await this.getTokenStats(userId, tokenType, limit.window);
    return count < limit.count;
  }
}

module.exports = OTPService;

