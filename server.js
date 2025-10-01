
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const app = express();
const port = 3000;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !FRONTEND_ORIGIN) {
    console.error('FATAL ERROR: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and FRONTEND_ORIGIN must be set in a .env file.');
    process.exit(1);
}

// Handle the redirect from Google OAuth.
// It redirects to here, and we then redirect back to the frontend, passing the code.
app.get('/oauth', (req, res) => {
    const { code, state } = req.query;

    if (!code) {
        console.error('OAuth callback missing code.');
        return res.redirect(`${FRONTEND_ORIGIN}/?oauthError=Authorization-code-not-found`);
    }

    const frontendUrl = new URL(FRONTEND_ORIGIN);
    frontendUrl.searchParams.set('oauthCode', code);

    // The 'state' from Google is the URL we originally passed, which contains our nonce.
    // We extract the nonce and pass it back to the frontend for verification.
    if (state) {
        try {
            const stateUrl = new URL(state);
            const nonce = stateUrl.searchParams.get('nonce');
            if (nonce) {
                frontendUrl.searchParams.set('nonce', nonce);
            }
        } catch (e) {
            console.error("Invalid state received from Google:", state);
        }
    }
    
    res.redirect(frontendUrl.toString());
});

// Endpoint to exchange authorization code for tokens
app.post('/google-login', async (req, res) => {
    const code = req.query.code;
    const redirect_uri = req.query.redirect_uri; // Use redirect_uri from frontend

    if (!code) {
        return res.status(400).json({ error: 'Authorization code is missing.' });
    }
    if (!redirect_uri) {
        return res.status(400).json({ error: 'Redirect URI is missing.' });
    }

    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: code,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: redirect_uri, // Must be the same as the one used in the auth code request
                grant_type: 'authorization_code',
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Google token exchange failed:', data);
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Internal server error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Endpoint to refresh the access token
app.post('/oauth-refresh', async (req, res) => {
    const refreshToken = req.query.refresh_token;

    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is missing.' });
    }

    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                refresh_token: refreshToken,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                grant_type: 'refresh_token',
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Google token refresh failed:', data);
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Internal server error during token refresh:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.listen(port, () => {
    console.log(`Backend server listening on port ${port}`);
    console.log('This server handles the OAuth2 token exchange.');
});
