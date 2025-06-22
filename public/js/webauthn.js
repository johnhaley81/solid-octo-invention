// WebAuthn JavaScript functionality

// Check if WebAuthn is supported
function isWebAuthnSupported() {
    return window.PublicKeyCredential && 
           typeof window.PublicKeyCredential === 'function' &&
           typeof navigator.credentials.create === 'function' &&
           typeof navigator.credentials.get === 'function';
}

// Convert base64url to ArrayBuffer
function base64urlToArrayBuffer(base64url) {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    const binary = atob(padded);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return buffer;
}

// Convert ArrayBuffer to base64url
function arrayBufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Convert server options to browser-compatible format
function convertRegistrationOptions(options) {
    return {
        ...options,
        challenge: base64urlToArrayBuffer(options.challenge),
        user: {
            ...options.user,
            id: base64urlToArrayBuffer(options.user.id)
        },
        excludeCredentials: options.excludeCredentials?.map(cred => ({
            ...cred,
            id: base64urlToArrayBuffer(cred.id)
        })) || []
    };
}

function convertAuthenticationOptions(options) {
    return {
        ...options,
        challenge: base64urlToArrayBuffer(options.challenge),
        allowCredentials: options.allowCredentials?.map(cred => ({
            ...cred,
            id: base64urlToArrayBuffer(cred.id)
        })) || []
    };
}

// Convert browser response to server-compatible format
function convertRegistrationResponse(response) {
    return {
        id: response.id,
        rawId: arrayBufferToBase64url(response.rawId),
        response: {
            clientDataJSON: arrayBufferToBase64url(response.response.clientDataJSON),
            attestationObject: arrayBufferToBase64url(response.response.attestationObject),
            transports: response.response.getTransports ? response.response.getTransports() : []
        },
        type: response.type
    };
}

function convertAuthenticationResponse(response) {
    return {
        id: response.id,
        rawId: arrayBufferToBase64url(response.rawId),
        response: {
            clientDataJSON: arrayBufferToBase64url(response.response.clientDataJSON),
            authenticatorData: arrayBufferToBase64url(response.response.authenticatorData),
            signature: arrayBufferToBase64url(response.response.signature),
            userHandle: response.response.userHandle ? arrayBufferToBase64url(response.response.userHandle) : null
        },
        type: response.type
    };
}

// WebAuthn Registration
async function handleWebAuthnRegister(event) {
    event.preventDefault();
    
    if (!isWebAuthnSupported()) {
        showMessage('WebAuthn is not supported in this browser. Please use a modern browser with biometric authentication support.', 'error');
        return;
    }
    
    const email = document.getElementById('webauthnRegisterEmail').value;
    
    try {
        showLoading();
        
        // Begin registration
        const beginResponse = await apiCall('/api/auth/webauthn/register/begin', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        
        if (!beginResponse.success) {
            throw new Error('Failed to begin WebAuthn registration');
        }
        
        const { user, options } = beginResponse;
        
        // Convert options for browser
        const browserOptions = convertRegistrationOptions(options);
        
        showMessage('Please use your biometric authentication (Touch ID, Face ID, Windows Hello, etc.)', 'info');
        hideLoading();
        
        // Create credential
        const credential = await navigator.credentials.create({
            publicKey: browserOptions
        });
        
        if (!credential) {
            throw new Error('Failed to create WebAuthn credential');
        }
        
        showLoading();
        
        // Convert response for server
        const registrationResponse = convertRegistrationResponse(credential);
        
        // Complete registration
        const completeResponse = await apiCall('/api/auth/webauthn/register/complete', {
            method: 'POST',
            body: JSON.stringify({
                userId: user.id,
                registrationResponse
            })
        });
        
        hideLoading();
        
        if (completeResponse.success) {
            showMessage('WebAuthn registration successful! You are now logged in.', 'success');
            await checkAuthStatus();
            hideAllForms();
        }
        
    } catch (error) {
        hideLoading();
        console.error('WebAuthn registration error:', error);
        
        if (error.name === 'NotAllowedError') {
            showMessage('WebAuthn registration was cancelled or not allowed.', 'error');
        } else if (error.name === 'NotSupportedError') {
            showMessage('This device does not support the required authentication method.', 'error');
        } else if (error.name === 'SecurityError') {
            showMessage('WebAuthn registration failed due to security restrictions.', 'error');
        } else {
            showMessage('WebAuthn registration failed: ' + error.message, 'error');
        }
    }
}

// WebAuthn Authentication
async function handleWebAuthnLogin(event) {
    event.preventDefault();
    
    if (!isWebAuthnSupported()) {
        showMessage('WebAuthn is not supported in this browser. Please use a modern browser with biometric authentication support.', 'error');
        return;
    }
    
    const email = document.getElementById('webauthnLoginEmail').value;
    
    try {
        showLoading();
        
        // Begin authentication
        const beginResponse = await apiCall('/api/auth/webauthn/authenticate/begin', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        
        if (!beginResponse.success) {
            throw new Error('Failed to begin WebAuthn authentication');
        }
        
        const { user, options } = beginResponse;
        
        // Convert options for browser
        const browserOptions = convertAuthenticationOptions(options);
        
        showMessage('Please authenticate using your biometric authentication', 'info');
        hideLoading();
        
        // Get credential
        const credential = await navigator.credentials.get({
            publicKey: browserOptions
        });
        
        if (!credential) {
            throw new Error('Failed to get WebAuthn credential');
        }
        
        showLoading();
        
        // Convert response for server
        const authenticationResponse = convertAuthenticationResponse(credential);
        
        // Complete authentication
        const completeResponse = await apiCall('/api/auth/webauthn/authenticate/complete', {
            method: 'POST',
            body: JSON.stringify({
                userId: user.id,
                authenticationResponse
            })
        });
        
        hideLoading();
        
        if (completeResponse.success) {
            showMessage('WebAuthn authentication successful!', 'success');
            await checkAuthStatus();
            hideAllForms();
        }
        
    } catch (error) {
        hideLoading();
        console.error('WebAuthn authentication error:', error);
        
        if (error.name === 'NotAllowedError') {
            showMessage('WebAuthn authentication was cancelled or not allowed.', 'error');
        } else if (error.name === 'NotSupportedError') {
            showMessage('This device does not support the required authentication method.', 'error');
        } else if (error.name === 'SecurityError') {
            showMessage('WebAuthn authentication failed due to security restrictions.', 'error');
        } else {
            showMessage('WebAuthn authentication failed: ' + error.message, 'error');
        }
    }
}

// Add additional WebAuthn credential (for existing WebAuthn users)
async function addWebAuthnCredential() {
    if (!isWebAuthnSupported()) {
        showMessage('WebAuthn is not supported in this browser.', 'error');
        return;
    }
    
    try {
        showLoading();
        
        // Begin adding credential
        const beginResponse = await apiCall('/api/user/webauthn/add-credential/begin', {
            method: 'POST'
        });
        
        if (!beginResponse.success) {
            throw new Error('Failed to begin adding WebAuthn credential');
        }
        
        const { options } = beginResponse;
        
        // Convert options for browser
        const browserOptions = convertRegistrationOptions(options);
        
        showMessage('Please use your biometric authentication to add a new credential', 'info');
        hideLoading();
        
        // Create credential
        const credential = await navigator.credentials.create({
            publicKey: browserOptions
        });
        
        if (!credential) {
            throw new Error('Failed to create WebAuthn credential');
        }
        
        showLoading();
        
        // Convert response for server
        const registrationResponse = convertRegistrationResponse(credential);
        
        // Complete adding credential
        const completeResponse = await apiCall('/api/user/webauthn/add-credential/complete', {
            method: 'POST',
            body: JSON.stringify({ registrationResponse })
        });
        
        hideLoading();
        
        if (completeResponse.success) {
            showMessage('Additional WebAuthn credential added successfully!', 'success');
            // Refresh profile if it's currently shown
            if (document.getElementById('profile-view').style.display !== 'none') {
                loadProfile();
            }
        }
        
    } catch (error) {
        hideLoading();
        console.error('Add WebAuthn credential error:', error);
        
        if (error.name === 'NotAllowedError') {
            showMessage('Adding WebAuthn credential was cancelled.', 'error');
        } else {
            showMessage('Failed to add WebAuthn credential: ' + error.message, 'error');
        }
    }
}

// Delete WebAuthn credential
async function deleteWebAuthnCredential(credentialId) {
    if (!confirm('Are you sure you want to delete this WebAuthn credential?')) {
        return;
    }
    
    try {
        showLoading();
        
        const response = await apiCall(`/api/user/webauthn/credentials/${credentialId}`, {
            method: 'DELETE'
        });
        
        hideLoading();
        
        if (response.success) {
            showMessage('WebAuthn credential deleted successfully!', 'success');
            // Refresh profile if it's currently shown
            if (document.getElementById('profile-view').style.display !== 'none') {
                loadProfile();
            }
        }
        
    } catch (error) {
        hideLoading();
        showMessage('Failed to delete WebAuthn credential: ' + error.message, 'error');
    }
}

// Check WebAuthn support on page load
document.addEventListener('DOMContentLoaded', function() {
    // WebAuthn register form
    const webauthnRegisterForm = document.getElementById('webauthnRegisterForm');
    if (webauthnRegisterForm) {
        webauthnRegisterForm.addEventListener('submit', handleWebAuthnRegister);
    }
    
    // WebAuthn login form
    const webauthnLoginForm = document.getElementById('webauthnLoginForm');
    if (webauthnLoginForm) {
        webauthnLoginForm.addEventListener('submit', handleWebAuthnLogin);
    }
    
    // Show warning if WebAuthn is not supported
    if (!isWebAuthnSupported()) {
        console.warn('WebAuthn is not supported in this browser');
        
        // Optionally disable WebAuthn buttons
        const webauthnButtons = document.querySelectorAll('button[onclick*="WebAuthn"]');
        webauthnButtons.forEach(button => {
            button.disabled = true;
            button.title = 'WebAuthn is not supported in this browser';
        });
    }
});

