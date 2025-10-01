
// This is a Cloudflare Pages Function that acts as the backend for the cave-story-web app.
// It handles the Google OAuth2 flow, including exchanging the authorization code for tokens and refreshing tokens.
// It replaces the functionality of the local `server.js` for the deployed version.

/**
 * Exchanges an authorization code for an access token and refresh token.
 * @param {string} code - The authorization code from Google.
 * @param {string} redirect_uri - The redirect URI that was used to get the code.
 * @param {any} env - The Cloudflare environment variables.
 * @returns {Promise<Response>}
 */
async function exchangeToken(code, redirect_uri, env) {
    if (!code) {
        return new Response(JSON.stringify({ error: 'Authorization code is missing.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    return fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            code: code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirect_uri, // Use the full redirect_uri passed from the frontend
            grant_type: 'authorization_code',
        }),
    });
}

/**
 * Refreshes an access token using a refresh token.
 * @param {string} refreshToken - The refresh token.
 * @param {any} env - The Cloudflare environment variables.
 * @returns {Promise<Response>}
 */
async function refreshToken(refreshToken, env) {
    if (!refreshToken) {
        return new Response(JSON.stringify({ error: 'Refresh token is missing.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    return fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            refresh_token: refreshToken,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            grant_type: 'refresh_token',
        }),
    });
}


/**
 * The main request handler for the Cloudflare Function.
 * It routes requests based on the URL path.
 * @param {any} context - The Cloudflare function context.
 * @returns {Promise<Response>}
 */
export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // Ensure required environment variables are present
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.FRONTEND_ORIGIN) {
        console.error('FATAL ERROR: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and FRONTEND_ORIGIN must be set in Cloudflare environment variables.');
        return new Response('Server configuration error.', { status: 500 });
    }

    // Route: /api/oauth
    // Handles the redirect from Google. Extracts the code and state, then redirects the user
    // back to the frontend application, passing the code and nonce as query parameters.
    if (url.pathname.startsWith('/api/oauth')) {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (!code) {
            return Response.redirect(`${env.FRONTEND_ORIGIN}/?oauthError=Authorization-code-not-found`, 302);
        }

        const frontendUrl = new URL(env.FRONTEND_ORIGIN);
        frontendUrl.searchParams.set('oauthCode', code);

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
        
        return Response.redirect(frontendUrl.toString(), 302);
    }

    // Route: /api/google-login
    // Exchanges the authorization code for tokens.
    if (url.pathname.startsWith('/api/google-login')) {
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
        }
        const code = url.searchParams.get('code');
        // The redirect_uri for the token exchange must EXACTLY match the one used to request the code.
        const redirect_uri = url.searchParams.get('redirect_uri');
        
        const googleResponse = await exchangeToken(code, redirect_uri, env);
        const data = await googleResponse.json();

        return new Response(JSON.stringify(data), {
            status: googleResponse.status,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Route: /api/oauth-refresh
    // Refreshes the access token.
    if (url.pathname.startsWith('/api/oauth-refresh')) {
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
        }
        const refreshTokenValue = url.searchParams.get('refresh_token');
        
        const googleResponse = await refreshToken(refreshTokenValue, env);
        const data = await googleResponse.json();

        return new Response(JSON.stringify(data), {
            status: googleResponse.status,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response('Not Found', { status: 404 });
}
