// Common utilities and authentication checks

// Check if user is authenticated
async function checkAuthStatus() {
    try {
        const response = await fetch('/auth/me', {
            credentials: 'include'
        });
        const data = await response.json();

        if (data.authenticated) {
            $('#user-info').html(`Welcome, <strong>${data.user.name || data.user.orcid_id}</strong>`);
            $('#login-btn').hide();
            $('#logout-btn').show();
            $('#submit-link').show();
            return true;
        } else {
            $('#user-info').empty();
            $('#login-btn').show();
            $('#logout-btn').hide();
            $('#submit-link').hide();
            return false;
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        return false;
    }
}

// Login button handler
$(document).on('click', '#login-btn', function() {
    window.location.href = '/auth/login';
});

// Logout button handler
$(document).on('click', '#logout-btn', async function() {
    try {
        await fetch('/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        window.location.href = '/index.html';
    } catch (error) {
        console.error('Logout failed:', error);
    }
});
