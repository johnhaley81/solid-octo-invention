const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const WebAuthnCredential = require('../models/WebAuthnCredential');
const { getWebAuthnConfig } = require('../utils/webauthn-config');

class WebAuthnService {
  constructor() {
    this.config = getWebAuthnConfig();
  }

  /**
   * Generate registration options for WebAuthn credential creation
   */
  async generateRegistrationOptions(user) {
    // Get existing credentials for this user
    const existingCredentials = await WebAuthnCredential.findByUserId(user.id);
    
    const options = await generateRegistrationOptions({
      rpName: this.config.rpName,
      rpID: this.config.rpID,
      userID: user.id,
      userName: user.email,
      userDisplayName: user.email,
      timeout: 60000,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map(cred => ({
        id: cred.credentialId,
        type: 'public-key',
        transports: cred.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform', // Prefer platform authenticators (Touch ID, Face ID, Windows Hello)
      },
      supportedAlgorithmIDs: [-7, -257], // ES256 and RS256
    });

    // Store challenge in session or temporary storage
    // In production, you'd want to store this securely
    this.currentChallenge = options.challenge;

    return options;
  }

  /**
   * Verify WebAuthn registration response
   */
  async verifyRegistration(user, registrationResponse) {
    try {
      const verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge: this.currentChallenge,
        expectedOrigin: this.config.expectedOrigin,
        expectedRPID: this.config.rpID,
        requireUserVerification: false,
      });

      if (!verification.verified || !verification.registrationInfo) {
        throw new Error('Registration verification failed');
      }

      const { registrationInfo } = verification;
      const {
        credentialID,
        credentialPublicKey,
        counter,
        credentialDeviceType,
        credentialBackedUp,
      } = registrationInfo;

      // Store the credential
      const credential = await WebAuthnCredential.create({
        userId: user.id,
        credentialId: Buffer.from(credentialID).toString('base64url'),
        publicKey: Buffer.from(credentialPublicKey).toString('base64'),
        counter,
        deviceType: credentialDeviceType,
        backupEligible: credentialBackedUp,
        backupState: credentialBackedUp,
        transports: registrationResponse.response.transports || [],
      });

      // Clear the challenge
      this.currentChallenge = null;

      return credential;
    } catch (error) {
      console.error('WebAuthn registration error:', error);
      throw new Error('Failed to register WebAuthn credential');
    }
  }

  /**
   * Generate authentication options for WebAuthn login
   */
  async generateAuthenticationOptions(user) {
    // Get user's credentials
    const userCredentials = await WebAuthnCredential.findByUserId(user.id);
    
    if (userCredentials.length === 0) {
      throw new Error('No WebAuthn credentials found for user');
    }

    const options = await generateAuthenticationOptions({
      timeout: 60000,
      allowCredentials: userCredentials.map(cred => ({
        id: cred.credentialId,
        type: 'public-key',
        transports: cred.transports,
      })),
      userVerification: 'preferred',
      rpID: this.config.rpID,
    });

    // Store challenge
    this.currentChallenge = options.challenge;

    return options;
  }

  /**
   * Verify WebAuthn authentication response
   */
  async verifyAuthentication(user, authenticationResponse) {
    try {
      const credentialId = authenticationResponse.id;
      
      // Find the credential
      const credential = await WebAuthnCredential.findByCredentialId(credentialId);
      if (!credential || credential.userId !== user.id) {
        throw new Error('Credential not found or does not belong to user');
      }

      const verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: this.currentChallenge,
        expectedOrigin: this.config.expectedOrigin,
        expectedRPID: this.config.rpID,
        authenticator: {
          credentialID: Buffer.from(credential.credentialId, 'base64url'),
          credentialPublicKey: Buffer.from(credential.publicKey, 'base64'),
          counter: credential.counter,
          transports: credential.transports,
        },
        requireUserVerification: false,
      });

      if (!verification.verified) {
        throw new Error('Authentication verification failed');
      }

      // Update counter and last used
      if (verification.authenticationInfo) {
        await credential.updateCounter(verification.authenticationInfo.newCounter);
      } else {
        await credential.updateLastUsed();
      }

      // Clear the challenge
      this.currentChallenge = null;

      return true;
    } catch (error) {
      console.error('WebAuthn authentication error:', error);
      throw new Error('WebAuthn authentication failed');
    }
  }

  /**
   * Get user's WebAuthn credentials
   */
  async getUserCredentials(userId) {
    const credentials = await WebAuthnCredential.findByUserId(userId);
    return credentials.map(cred => ({
      id: cred.id,
      credentialId: cred.credentialId,
      deviceType: cred.deviceType,
      backupEligible: cred.backupEligible,
      backupState: cred.backupState,
      transports: cred.transports,
      createdAt: cred.createdAt,
      lastUsed: cred.lastUsed,
    }));
  }

  /**
   * Delete a WebAuthn credential
   */
  async deleteCredential(userId, credentialId) {
    const credential = await WebAuthnCredential.findByCredentialId(credentialId);
    
    if (!credential || credential.userId !== userId) {
      throw new Error('Credential not found or access denied');
    }

    // Check if this is the last credential for a WebAuthn user
    const userCredentials = await WebAuthnCredential.findByUserId(userId);
    if (userCredentials.length === 1) {
      throw new Error('Cannot delete the last WebAuthn credential. Switch to password authentication first.');
    }

    await credential.delete();
    return { message: 'Credential deleted successfully' };
  }

  /**
   * Check if WebAuthn is supported by checking for existing credentials
   */
  async isWebAuthnEnabled(userId) {
    const credentials = await WebAuthnCredential.findByUserId(userId);
    return credentials.length > 0;
  }
}

module.exports = WebAuthnService;

