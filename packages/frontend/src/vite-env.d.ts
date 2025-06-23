/// <reference types="vite/client" />

// WebAuthn types for passkey functionality
declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    PublicKeyCredential?: PublicKeyCredential;
  }
}

export {};
