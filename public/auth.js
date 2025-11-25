// Google SSO Authentication Module
// Manages user authentication and role-based permissions
// NOTE: clearChatHistory() is called on sign-out and sign-in to ensure
// each new session starts with a fresh, empty chat.

const GOOGLE_CLIENT_ID = '65317156873-o4s0gqor74r2nshde0t93jakod1ktutf.apps.googleusercontent.com';
const AUTH_STORAGE_KEY = 'ai_vip_auth';

// Auth state
let currentUser = null;

// Initialize Google Sign-In
function initGoogleAuth() {
  // Check if Google Identity Services is loaded
  if (typeof google === 'undefined' || !google.accounts) {
    console.log('Waiting for Google Identity Services to load...');
    // Retry after a short delay
    setTimeout(initGoogleAuth, 100);
    return;
  }

  try {
    // Load Google Identity Services
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleSignIn,
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    // Restore session from localStorage
    restoreSession();

    // Update UI based on current auth state
    updateAuthUI();

    console.log('✓ Google Sign-In initialized');
  } catch (error) {
    console.error('Error initializing Google Sign-In:', error);
  }
}

// Handle successful Google Sign-In
function handleGoogleSignIn(response) {
  try {
    // Decode the JWT token
    const payload = parseJwt(response.credential);

    // Extract user info
    const email = payload.email;
    const name = payload.name || email;
    const picture = payload.picture;

    // Determine role based on email domain
    const role = email.endsWith('@nyu.edu') ? 'team' : 'guest';

    // Create user object
    currentUser = {
      email,
      name,
      picture,
      role,
      signedInAt: new Date().toISOString()
    };

    // Save to localStorage
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));

    // Clear chat history for fresh session on new sign-in
    if (window.chatbot && typeof window.chatbot.clearChatHistory === 'function') {
      window.chatbot.clearChatHistory();
    }

    // Update UI
    updateAuthUI();

    // Show welcome message
    if (role === 'team') {
      showNotification(`Welcome, ${name}! You're signed in as a team member.`, 'success');
    } else {
      showNotification(`Welcome, ${name}! Sign in with your NYU email to contribute.`, 'info');
    }

    // Dispatch custom event for other parts of the app
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: currentUser }));

  } catch (error) {
    console.error('Error handling sign-in:', error);
    showNotification('Failed to sign in. Please try again.', 'error');
  }
}

// Parse JWT token
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return null;
  }
}

// Restore session from localStorage
function restoreSession() {
  try {
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedAuth) {
      currentUser = JSON.parse(storedAuth);

      // Check if session is still valid (e.g., within 7 days)
      const signedInAt = new Date(currentUser.signedInAt);
      const daysSinceSignIn = (Date.now() - signedInAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceSignIn > 7) {
        // Session expired
        signOut();
      }
    }
  } catch (error) {
    console.error('Error restoring session:', error);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

// Sign out
function signOut() {
  currentUser = null;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.disableAutoSelect();
  }

  // Clear chat history on sign-out
  if (window.chatbot && typeof window.chatbot.clearChatHistory === 'function') {
    window.chatbot.clearChatHistory();
  }

  updateAuthUI();
  showNotification('You have been signed out.', 'info');
  window.dispatchEvent(new CustomEvent('authStateChanged', { detail: null }));
}

// Update authentication UI
function updateAuthUI() {
  const authContainer = document.getElementById('auth-container');
  if (!authContainer) return;

  if (currentUser) {
    // User is signed in
    authContainer.innerHTML = `
      <div class="user-info">
        <div class="user-avatar-wrapper">
          ${currentUser.picture ? `<img src="${currentUser.picture}" alt="User" class="user-avatar">` : ''}
          ${currentUser.role === 'team' ? '<span class="team-badge">TEAM</span>' : ''}
        </div>
        <button class="sign-out-btn" onclick="signOut()">Sign Out</button>
      </div>
    `;
  } else {
    // User is not signed in
    authContainer.innerHTML = `
      <div id="google-signin-button"></div>
    `;

    // Render Google Sign-In button
    setTimeout(() => {
      if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        try {
          google.accounts.id.renderButton(
            document.getElementById('google-signin-button'),
            {
              theme: 'outline',
              size: 'medium',
              text: 'signin_with',
              shape: 'rectangular',
            }
          );
        } catch (error) {
          console.error('Error rendering Google Sign-In button:', error);
          document.getElementById('google-signin-button').innerHTML =
            '<button class="sign-out-btn" onclick="initGoogleAuth()">Sign In with Google</button>';
        }
      } else {
        console.warn('Google Identity Services not loaded yet');
        document.getElementById('google-signin-button').innerHTML =
          '<button class="sign-out-btn" onclick="initGoogleAuth()">Sign In with Google</button>';
      }
    }, 100);
  }

  // Update contribute button visibility
  updateContributeButton();
}

// Update contribute button based on auth state
function updateContributeButton() {
  const contributeBtn = document.querySelector('.contribute-btn');
  const addPerspectiveBtns = document.querySelectorAll('.add-perspective-btn');

  if (currentUser && currentUser.role === 'team') {
    // Team member - show and enable contribute features
    if (contributeBtn) {
      contributeBtn.style.display = 'block';
      contributeBtn.disabled = false;
      contributeBtn.innerHTML = 'Contribute';
      contributeBtn.title = 'Add new research entry';
    }

    addPerspectiveBtns.forEach(btn => {
      btn.style.display = 'inline-block';
      btn.disabled = false;
    });
  } else {
    // Guest or not signed in - hide or disable
    if (contributeBtn) {
      contributeBtn.style.display = 'block';
      contributeBtn.disabled = true;
      contributeBtn.title = 'Sign in with your NYU email to contribute';
      contributeBtn.innerHTML = '<i class="fas fa-lock"></i> Sign in to Contribute';
    }

    addPerspectiveBtns.forEach(btn => {
      btn.style.display = 'inline-block';
      btn.disabled = true;
      btn.title = 'Sign in with your NYU email to contribute';
      btn.innerHTML = '<i class="fas fa-lock"></i> Sign in to Add Perspective';
    });
  }
}

// Show notification
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  // Add to page
  document.body.appendChild(notification);

  // Trigger animation
  setTimeout(() => notification.classList.add('show'), 10);

  // Remove after 4 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

// Public API
function getCurrentUser() {
  return currentUser;
}

function isTeamMember() {
  return currentUser && currentUser.role === 'team';
}

function isSignedIn() {
  return currentUser !== null;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGoogleAuth);
} else {
  initGoogleAuth();
}

// Export functions for global access
window.auth = {
  getCurrentUser,
  isTeamMember,
  isSignedIn,
  signOut,
  updateContributeButton,
};
