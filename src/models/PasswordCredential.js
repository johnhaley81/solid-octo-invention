const db = require('../config/database');
const bcrypt = require('bcrypt');

class PasswordCredential {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.passwordHash = data.password_hash;
    this.emailVerified = data.email_verified;
    this.emailVerificationToken = data.email_verification_token;
    this.emailVerificationExpires = data.email_verification_expires;
    this.passwordResetToken = data.password_reset_token;
    this.passwordResetExpires = data.password_reset_expires;
    this.failedLoginAttempts = data.failed_login_attempts;
    this.lockedUntil = data.locked_until;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  static async create(userId, password) {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    const query = `
      INSERT INTO password_credentials (user_id, password_hash)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await db.query(query, [userId, passwordHash]);
    return new PasswordCredential(result.rows[0]);
  }

  static async findByUserId(userId) {
    const query = 'SELECT * FROM password_credentials WHERE user_id = $1';
    const result = await db.query(query, [userId]);
    return result.rows[0] ? new PasswordCredential(result.rows[0]) : null;
  }

  async verifyPassword(password) {
    return await bcrypt.compare(password, this.passwordHash);
  }

  async updatePassword(newPassword) {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    const query = `
      UPDATE password_credentials 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [passwordHash, this.id]);
    if (result.rows[0]) {
      this.passwordHash = result.rows[0].password_hash;
      this.updatedAt = result.rows[0].updated_at;
    }
    return this;
  }

  async setEmailVerificationToken(token, expiresAt) {
    const query = `
      UPDATE password_credentials 
      SET email_verification_token = $1, email_verification_expires = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    const result = await db.query(query, [token, expiresAt, this.id]);
    if (result.rows[0]) {
      this.emailVerificationToken = result.rows[0].email_verification_token;
      this.emailVerificationExpires = result.rows[0].email_verification_expires;
      this.updatedAt = result.rows[0].updated_at;
    }
    return this;
  }

  async verifyEmail() {
    const query = `
      UPDATE password_credentials 
      SET email_verified = true, email_verification_token = NULL, 
          email_verification_expires = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [this.id]);
    if (result.rows[0]) {
      this.emailVerified = result.rows[0].email_verified;
      this.emailVerificationToken = null;
      this.emailVerificationExpires = null;
      this.updatedAt = result.rows[0].updated_at;
    }
    return this;
  }

  async incrementFailedAttempts() {
    const maxAttempts = 5;
    const lockDuration = 15 * 60 * 1000; // 15 minutes
    
    const newAttempts = this.failedLoginAttempts + 1;
    const lockedUntil = newAttempts >= maxAttempts ? 
      new Date(Date.now() + lockDuration) : null;
    
    const query = `
      UPDATE password_credentials 
      SET failed_login_attempts = $1, locked_until = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
    `;
    const result = await db.query(query, [newAttempts, lockedUntil, this.id]);
    if (result.rows[0]) {
      this.failedLoginAttempts = result.rows[0].failed_login_attempts;
      this.lockedUntil = result.rows[0].locked_until;
      this.updatedAt = result.rows[0].updated_at;
    }
    return this;
  }

  async resetFailedAttempts() {
    const query = `
      UPDATE password_credentials 
      SET failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [this.id]);
    if (result.rows[0]) {
      this.failedLoginAttempts = 0;
      this.lockedUntil = null;
      this.updatedAt = result.rows[0].updated_at;
    }
    return this;
  }

  isLocked() {
    return this.lockedUntil && new Date() < new Date(this.lockedUntil);
  }

  async delete() {
    const query = 'DELETE FROM password_credentials WHERE id = $1';
    await db.query(query, [this.id]);
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      emailVerified: this.emailVerified,
      failedLoginAttempts: this.failedLoginAttempts,
      isLocked: this.isLocked(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = PasswordCredential;

