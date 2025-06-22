require('dotenv').config();

/**
 * WebAuthn configuration
 */
function getWebAuthnConfig() {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  return {
    // Relying Party (RP) Name - your application name
    rpName: process.env.WEBAUTHN_RP_NAME || 'Authentication System',
    
    // Relying Party ID - your domain (without protocol)
    rpID: process.env.WEBAUTHN_RP_ID || (isDevelopment ? 'localhost' : 'yourdomain.com'),
    
    // Expected origin - full URL where WebAuthn will be used
    expectedOrigin: process.env.WEBAUTHN_EXPECTED_ORIGIN || (isDevelopment ? 'http://localhost:3000' : 'https://yourdomain.com'),
    
    // Timeout for WebAuthn operations (in milliseconds)
    timeout: parseInt(process.env.WEBAUTHN_TIMEOUT) || 60000,
    
    // User verification requirement
    userVerification: process.env.WEBAUTHN_USER_VERIFICATION || 'preferred',
    
    // Authenticator attachment preference
    authenticatorAttachment: process.env.WEBAUTHN_AUTHENTICATOR_ATTACHMENT || 'platform',
  };
}

/**
 * Validate WebAuthn configuration
 */
function validateWebAuthnConfig() {
  const config = getWebAuthnConfig();
  const errors = [];

  if (!config.rpName) {
    errors.push('WEBAUTHN_RP_NAME is required');
  }

  if (!config.rpID) {
    errors.push('WEBAUTHN_RP_ID is required');
  }

  if (!config.expectedOrigin) {
    errors.push('WEBAUTHN_EXPECTED_ORIGIN is required');
  }

  // Validate that rpID matches the domain in expectedOrigin
  try {
    const originUrl = new URL(config.expectedOrigin);
    const originHostname = originUrl.hostname;
    
    if (config.rpID !== originHostname) {
      errors.push(`WEBAUTHN_RP_ID (${config.rpID}) must match the hostname in WEBAUTHN_EXPECTED_ORIGIN (${originHostname})`);
    }
  } catch (error) {
    errors.push('WEBAUTHN_EXPECTED_ORIGIN must be a valid URL');
  }

  if (errors.length > 0) {
    throw new Error(`WebAuthn configuration errors:\n${errors.join('\n')}`);
  }

  return config;
}

/**
 * Get supported algorithms for WebAuthn
 */
function getSupportedAlgorithms() {
  return [
    -7,   // ES256 (Elliptic Curve Digital Signature Algorithm using P-256 curve and SHA-256)
    -257, // RS256 (RSASSA-PKCS1-v1_5 using SHA-256)
    -8,   // EdDSA (EdDSA signature algorithms)
    -36,  // ES384 (ECDSA using P-384 curve and SHA-384)
    -37,  // ES512 (ECDSA using P-521 curve and SHA-512)
    -258, // RS384 (RSASSA-PKCS1-v1_5 using SHA-384)
    -259, // RS512 (RSASSA-PKCS1-v1_5 using SHA-512)
  ];
}

/**
 * Get authenticator selection criteria
 */
function getAuthenticatorSelection(preferPlatform = true) {
  return {
    authenticatorAttachment: preferPlatform ? 'platform' : undefined,
    residentKey: 'preferred',
    userVerification: 'preferred',
  };
}

/**
 * Get supported transports
 */
function getSupportedTransports() {
  return ['usb', 'nfc', 'ble', 'internal', 'hybrid'];
}

module.exports = {
  getWebAuthnConfig,
  validateWebAuthnConfig,
  getSupportedAlgorithms,
  getAuthenticatorSelection,
  getSupportedTransports,
};

