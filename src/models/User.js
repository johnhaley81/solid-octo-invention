const db = require('../config/database');

class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.authMethod = data.auth_method;
    this.isActive = data.is_active;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  static async create(email, authMethod = 'password') {
    const query = `
      INSERT INTO users (email, auth_method)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await db.query(query, [email, authMethod]);
    return new User(result.rows[0]);
  }

  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
    const result = await db.query(query, [id]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
    const result = await db.query(query, [email]);
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  async updateAuthMethod(newMethod) {
    const query = `
      UPDATE users 
      SET auth_method = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    const result = await db.query(query, [newMethod, this.id]);
    if (result.rows[0]) {
      this.authMethod = result.rows[0].auth_method;
      this.updatedAt = result.rows[0].updated_at;
    }
    return this;
  }

  async deactivate() {
    const query = `
      UPDATE users 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [this.id]);
    if (result.rows[0]) {
      this.isActive = result.rows[0].is_active;
      this.updatedAt = result.rows[0].updated_at;
    }
    return this;
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      authMethod: this.authMethod,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = User;

