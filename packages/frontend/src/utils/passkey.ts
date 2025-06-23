/**
 * WebAuthn/Passkey utility functions
 * Handles passkey registration and authentication
 */

/**
 * Check if WebAuthn is supported in the current browser
 */
export function isPasskeySupported(): boolean {
  return !!(
    window.PublicKeyCredential &&
    window.navigator.credentials &&
    window.navigator.credentials.create &&
    window.navigator.credentials.get
  );
}

/**
 * Convert ArrayBuffer to base64url string
 */
function arrayBufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Convert base64url string to ArrayBuffer
 */
function base64urlToArrayBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Register a new passkey
 */
export async function registerPasskey(options: {
  challenge: string;
  user: {
    id: string;
    name: string;
    displayName: string;
  };
  excludeCredentials?: Array<{
    id: string;
    type: string;
    transports?: string[];
  }>;
}): Promise<string> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported in this browser');
  }

  const createOptions: CredentialCreationOptions = {
    publicKey: {
      challenge: base64urlToArrayBuffer(options.challenge),
      rp: {
        name: window.location.hostname,
        id: window.location.hostname,
      },
      user: {
        id: new TextEncoder().encode(options.user.id),
        name: options.user.name,
        displayName: options.user.displayName,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
      excludeCredentials: options.excludeCredentials?.map(cred => ({
        id: base64urlToArrayBuffer(cred.id),
        type: cred.type as PublicKeyCredentialType,
        transports: cred.transports as AuthenticatorTransport[],
      })),
    },
  };

  const credential = await navigator.credentials.create(createOptions) as PublicKeyCredential;
  
  if (!credential) {
    throw new Error('Failed to create passkey');
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  
  const credentialData = {
    id: credential.id,
    rawId: arrayBufferToBase64url(credential.rawId),
    response: {
      clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
      attestationObject: arrayBufferToBase64url(response.attestationObject),
    },
    type: credential.type,
  };

  return JSON.stringify(credentialData);
}

/**
 * Authenticate with an existing passkey
 */
export async function authenticateWithPasskey(options: {
  challenge: string;
  allowCredentials?: Array<{
    id: string;
    type: string;
    transports?: string[];
  }>;
}): Promise<string> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported in this browser');
  }

  const getOptions: CredentialRequestOptions = {
    publicKey: {
      challenge: base64urlToArrayBuffer(options.challenge),
      timeout: 60000,
      userVerification: 'required',
      allowCredentials: options.allowCredentials?.map(cred => ({
        id: base64urlToArrayBuffer(cred.id),
        type: cred.type as PublicKeyCredentialType,
        transports: cred.transports as AuthenticatorTransport[],
      })),
    },
  };

  const credential = await navigator.credentials.get(getOptions) as PublicKeyCredential;
  
  if (!credential) {
    throw new Error('Failed to authenticate with passkey');
  }

  const response = credential.response as AuthenticatorAssertionResponse;
  
  const credentialData = {
    id: credential.id,
    rawId: arrayBufferToBase64url(credential.rawId),
    response: {
      clientDataJSON: arrayBufferToBase64url(response.clientDataJSON),
      authenticatorData: arrayBufferToBase64url(response.authenticatorData),
      signature: arrayBufferToBase64url(response.signature),
      userHandle: response.userHandle ? arrayBufferToBase64url(response.userHandle) : null,
    },
    type: credential.type,
  };

  return JSON.stringify(credentialData);
}

/**
 * Check if user has passkeys available for a given email
 */
export async function hasPasskeysAvailable(email: string): Promise<boolean> {
  if (!isPasskeySupported()) {
    return false;
  }

  try {
    // This is a simple check - in a real implementation, you'd query your backend
    // to see if the user has registered passkeys
    return true; // Placeholder - should be replaced with actual backend check
  } catch (error) {
    return false;
  }
}
