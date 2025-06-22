const db = require('../config/database');

class WebAuthnCredential {
  constructor(data) {
    this.id = data.id;
    this.userId = data.user_id;
    this.credentialId = data.credential_id;
    this.publicKey = data.public_key;
    this.counter = data.counter;
    this.deviceType = data.device_type;
    this.backupEligible = data.backup_eligible;
    this.backupState = data.backup_state;
    this.transports = data.transports;
    this.createdAt = data.created_at;
    this.lastUsed = data.last_used;
  }

  static async create(credentialData) {
    const {
      userId,
      credentialId,
      publicKey,
      counter = 0,
      deviceType = null,
      backupEligible = false,
      backupState = false,
      transports = []
    } = credentialData;

    const query = `
      INSERT INTO webauthn_credentials 
      (user_id, credential_id, public_key, counter, device_type, backup_eligible, backup_state, transports)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await db.query(query, [
      userId, credentialId, publicKey, counter, deviceType, 
      backupEligible, backupState, transports
    ]);
    
    return new WebAuthnCredential(result.rows[0]);
  }

  static async findByCredentialId(credentialId) {
    const query = 'SELECT * FROM webauthn_credentials WHERE credential_id = $1';
    const result = await db.query(query, [credentialId]);
    return result.rows[0] ? new WebAuthnCredential(result.rows[0]) : null;
  }

  static async findByUserId(userId) {
    const query = 'SELECT * FROM webauthn_credentials WHERE user_id = $1 ORDER BY created_at DESC';
    const result = await db.query(query, [userId]);
    return result.rows.map(row => new WebAuthnCredential(row));
  }

  static async deleteAllByUserId(userId) {
    const query = 'DELETE FROM webauthn_credentials WHERE user_id = $1';
    await db.query(query, [userId]);
  }

  async updateCounter(newCounter) {
    const query = `
      UPDATE webauthn_credentials 
      SET counter = $1, last_used = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [newCounter, this.id]);
    if (result.rows[0]) {
      this.counter = result.rows[0].counter;
      this.lastUsed = result.rows[0].last_used;
    }
    return this;
  }

  async updateLastUsed() {
    const query = `
      UPDATE webauthn_credentials 
      SET last_used = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [this.id]);
    if (result.rows[0]) {
      this.lastUsed = result.rows[0].last_used;
    }
    return this;
  }

  async delete() {
    const query = 'DELETE FROM webauthn_credentials WHERE id = $1';
    await db.query(query, [this.id]);
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      credentialId: this.credentialId,
      counter: this.counter,
      deviceType: this.deviceType,
      backupEligible: this.backupEligible,
      backupState: this.backupState,
      transports: this.transports,
      createdAt: this.createdAt,
      lastUsed: this.lastUsed
    };
  }

  // For WebAuthn library compatibility
  toWebAuthnCredential() {
    return {
      id: this.credentialId,
      publicKey: this.publicKey,
      counter: this.counter,
      transports: this.transports
    };
  }
}

module.exports = WebAuthnCredential;

