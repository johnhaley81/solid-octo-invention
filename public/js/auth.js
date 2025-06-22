// Authentication JavaScript functionality

let currentUser = null;
let requiresOTP = false;

// API helper functions
async function apiCall(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for session
    };

    const response = await fetch(endpoint, { ...defaultOptions, ...options });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}

// UI helper functions
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showMessage(message, type = 'info') {
    const messagesContainer = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    messagesContainer.appendChild(messageDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 5000);
}

function hideAllForms() {
    const forms = [
        'login-form', 'register-form', 'webauthn-login', 
        'webauthn-register', 'password-reset', 'profile-view', 'auth-switch'
    ];
    forms.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.style.display = 'none';
    });
}

function showLogin() {
    hideAllForms();
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('loginEmail').focus();
}

function showRegister() {
    hideAllForms();
    document.getElementById('register-form').style.display = 'block';
    document.getElementById('registerEmail').focus();
}

function showWebAuthnLogin() {
    hideAllForms();
    document.getElementById('webauthn-login').style.display = 'block';
    document.getElementById('webauthnLoginEmail').focus();
}

function showWebAuthnRegister() {
    hideAllForms();
    document.getElementById('webauthn-register').style.display = 'block';
    document.getElementById('webauthnRegisterEmail').focus();
}

function showPasswordReset() {
    hideAllForms();
    document.getElementById('password-reset').style.display = 'block';
    document.getElementById('resetEmail').focus();
}

function showProfile() {
    hideAllForms();
    loadProfile();
    document.getElementById('profile-view').style.display = 'block';
}

function hideProfile() {
    document.getElementById('profile-view').style.display = 'none';
}

function showAuthMethodSwitch() {
    hideAllForms();
    loadAuthSwitchOptions();
    document.getElementById('auth-switch').style.display = 'block';
}

// Authentication functions
async function checkAuthStatus() {
    try {
        const response = await apiCall('/api/auth/me');
        if (response.success) {
            currentUser = response.data;
            showUserView();
        } else {
            showGuestView();
        }
    } catch (error) {
        showGuestView();
    }
}

function showGuestView() {
    document.getElementById('guest-view').style.display = 'block';
    document.getElementById('user-view').style.display = 'none';
    hideAllForms();
}

function showUserView() {
    document.getElementById('guest-view').style.display = 'none';
    document.getElementById('user-view').style.display = 'block';
    hideAllForms();
    updateUserInfo();
}

function updateUserInfo() {
    if (!currentUser) return;
    
    const userDetails = document.getElementById('user-details');
    const authMethodBadge = currentUser.user.authMethod === 'webauthn' ? 
        '<span class="badge info">🚀 Passkeys</span>' : 
        '<span class="badge success">🔑 Email/Password</span>';
    
    userDetails.innerHTML = `
        <div class="profile-detail">
            <strong>Email:</strong>
            <span class="value">${currentUser.user.email}</span>
        </div>
        <div class="profile-detail">
            <strong>Authentication Method:</strong>
            ${authMethodBadge}
        </div>
        <div class="profile-detail">
            <strong>Login Time:</strong>
            <span class="value">${new Date(currentUser.session.loginTime).toLocaleString()}</span>
        </div>
    `;
}

async function loadProfile() {
    try {
        showLoading();
        const response = await apiCall('/api/user/profile');
        hideLoading();
        
        if (response.success) {
            displayProfile(response.data);
        }
    } catch (error) {
        hideLoading();
        showMessage('Failed to load profile: ' + error.message, 'error');
    }
}

function displayProfile(profileData) {
    const profileDetails = document.getElementById('profile-details');
    let html = `
        <div class="profile-detail">
            <strong>User ID:</strong>
            <span class="value">${profileData.user.id}</span>
        </div>
        <div class="profile-detail">
            <strong>Email:</strong>
            <span class="value">${profileData.user.email}</span>
        </div>
        <div class="profile-detail">
            <strong>Authentication Method:</strong>
            <span class="badge ${profileData.user.authMethod === 'webauthn' ? 'info' : 'success'}">
                ${profileData.user.authMethod === 'webauthn' ? '🚀 WebAuthn Passkeys' : '🔑 Email/Password'}
            </span>
        </div>
        <div class="profile-detail">
            <strong>Account Created:</strong>
            <span class="value">${new Date(profileData.user.createdAt).toLocaleString()}</span>
        </div>
    `;

    if (profileData.passwordAuth) {
        html += `
            <div class="profile-detail">
                <strong>Email Verified:</strong>
                <span class="badge ${profileData.passwordAuth.emailVerified ? 'success' : 'warning'}">
                    ${profileData.passwordAuth.emailVerified ? '✅ Verified' : '⚠️ Not Verified'}
                </span>
            </div>
        `;
        if (profileData.passwordAuth.failedAttempts > 0) {
            html += `
                <div class="profile-detail">
                    <strong>Failed Login Attempts:</strong>
                    <span class="value">${profileData.passwordAuth.failedAttempts}</span>
                </div>
            `;
        }
    }

    if (profileData.webauthnAuth) {
        html += `
            <div class="profile-detail">
                <strong>Registered Passkeys:</strong>
                <span class="value">${profileData.webauthnAuth.credentialCount}</span>
            </div>
        `;
        
        if (profileData.webauthnAuth.credentials.length > 0) {
            html += '<h4 style="margin-top: 1rem; margin-bottom: 0.5rem;">Passkey Devices:</h4>';
            profileData.webauthnAuth.credentials.forEach(cred => {
                html += `
                    <div class="credential-item">
                        <div class="credential-info">
                            <h4>${cred.deviceType || 'Unknown Device'}</h4>
                            <p>Created: ${new Date(cred.createdAt).toLocaleDateString()}</p>
                            ${cred.lastUsed ? `<p>Last used: ${new Date(cred.lastUsed).toLocaleDateString()}</p>` : ''}
                        </div>
                    </div>
                `;
            });
        }
    }

    profileDetails.innerHTML = html;
}

async function loadAuthSwitchOptions() {
    const switchOptions = document.getElementById('switch-options');
    
    if (!currentUser) return;
    
    if (currentUser.user.authMethod === 'password') {
        switchOptions.innerHTML = `
            <div class="webauthn-info">
                <p>🚀 Switch to modern WebAuthn Passkeys for enhanced security and convenience!</p>
            </div>
            <p>Switching to WebAuthn will:</p>
            <ul style="margin: 1rem 0; padding-left: 2rem;">
                <li>Enable biometric authentication (Touch ID, Face ID, Windows Hello)</li>
                <li>Disable your current password authentication</li>
                <li>Provide stronger security against phishing attacks</li>
            </ul>
            <div class="button-group">
                <button onclick="switchToWebAuthn()" class="btn btn-primary">🚀 Switch to Passkeys</button>
                <button onclick="hideAllForms()" class="btn btn-secondary">Cancel</button>
            </div>
        `;
    } else {
        switchOptions.innerHTML = `
            <div class="form-container">
                <p>Switch back to traditional email/password authentication:</p>
                <form id="switchToPasswordForm">
                    <div class="form-group">
                        <label for="newPassword">New Password:</label>
                        <input type="password" id="newPassword" required>
                        <small>Must contain uppercase, lowercase, number, and special character</small>
                    </div>
                    <div class="button-group">
                        <button type="submit" class="btn btn-primary">🔑 Switch to Password</button>
                        <button type="button" onclick="hideAllForms()" class="btn btn-secondary">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        
        document.getElementById('switchToPasswordForm').addEventListener('submit', handleSwitchToPassword);
    }
}

async function logout() {
    try {
        showLoading();
        await apiCall('/api/auth/logout', { method: 'POST' });
        hideLoading();
        currentUser = null;
        showMessage('Logged out successfully', 'success');
        showGuestView();
    } catch (error) {
        hideLoading();
        showMessage('Logout failed: ' + error.message, 'error');
    }
}

// Form handlers
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const otp = document.getElementById('loginOtp').value;
    
    try {
        showLoading();
        const response = await apiCall('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, otp: otp || undefined })
        });
        hideLoading();
        
        if (response.requiresOTP) {
            requiresOTP = true;
            document.getElementById('otp-section').style.display = 'block';
            document.getElementById('loginOtp').focus();
            showMessage(response.message, 'info');
        } else {
            showMessage('Login successful!', 'success');
            await checkAuthStatus();
        }
    } catch (error) {
        hideLoading();
        showMessage('Login failed: ' + error.message, 'error');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
        showLoading();
        const response = await apiCall('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        hideLoading();
        
        showMessage('Registration successful! Please check your email for verification.', 'success');
        hideAllForms();
    } catch (error) {
        hideLoading();
        showMessage('Registration failed: ' + error.message, 'error');
    }
}

async function handlePasswordReset(event) {
    event.preventDefault();
    
    const email = document.getElementById('resetEmail').value;
    
    try {
        showLoading();
        const response = await apiCall('/api/auth/password-reset/request', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        hideLoading();
        
        showMessage(response.message, 'success');
        hideAllForms();
    } catch (error) {
        hideLoading();
        showMessage('Password reset failed: ' + error.message, 'error');
    }
}

async function switchToWebAuthn() {
    try {
        showLoading();
        const response = await apiCall('/api/user/switch-to-webauthn', {
            method: 'POST'
        });
        hideLoading();
        
        showMessage('Successfully switched to WebAuthn authentication!', 'success');
        await checkAuthStatus();
        hideAllForms();
    } catch (error) {
        hideLoading();
        showMessage('Failed to switch to WebAuthn: ' + error.message, 'error');
    }
}

async function handleSwitchToPassword(event) {
    event.preventDefault();
    
    const password = document.getElementById('newPassword').value;
    
    try {
        showLoading();
        const response = await apiCall('/api/user/switch-to-password', {
            method: 'POST',
            body: JSON.stringify({ password })
        });
        hideLoading();
        
        showMessage('Successfully switched to password authentication! Please check your email for verification.', 'success');
        await checkAuthStatus();
        hideAllForms();
    } catch (error) {
        hideLoading();
        showMessage('Failed to switch to password: ' + error.message, 'error');
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Password reset form
    const passwordResetForm = document.getElementById('passwordResetForm');
    if (passwordResetForm) {
        passwordResetForm.addEventListener('submit', handlePasswordReset);
    }
    
    // WebAuthn forms will be handled in webauthn.js
});

// Handle URL parameters (for email verification, password reset, etc.)
function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const action = urlParams.get('action');
    
    if (token && action === 'verify-email') {
        verifyEmailToken(token);
    } else if (token && action === 'reset-password') {
        showPasswordResetForm(token);
    }
}

async function verifyEmailToken(token) {
    try {
        showLoading();
        const response = await apiCall('/api/auth/verify-email', {
            method: 'POST',
            body: JSON.stringify({ token })
        });
        hideLoading();
        
        showMessage('Email verified successfully! You can now log in.', 'success');
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
        hideLoading();
        showMessage('Email verification failed: ' + error.message, 'error');
    }
}

// Initialize URL parameter handling
document.addEventListener('DOMContentLoaded', handleUrlParameters);

