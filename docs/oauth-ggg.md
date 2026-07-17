# Registering Path of Exile OAuth

The application already implements an OAuth 2.1 authorization-code flow with PKCE. A real connection still requires an application approved by Grinding Gear Games.

1. Register an OAuth application through the official Path of Exile developer process.
2. Use the exact callback URL `https://YOUR_DOMAIN/api/poe/oauth/callback`.
3. Request only the scopes required by the current integration: account profile and characters.
4. Configure the issued client id and, for a confidential client, client secret only in the backend environment.
5. Generate a separate strong token-encryption key. Never reuse the session secret.
6. Configure the public frontend origin and trusted proxy hop count for the production topology.
7. Test connect, callback, manual synchronization, expiry, refresh, revocation and disconnect in staging before enabling authentication requirements.

GGG does not treat a Steam login as a separate character API. The player authenticates through the Path of Exile account linked to Steam. Tokens remain encrypted in backend storage and are never returned to the browser.

Local development must use mocks when the registered client type does not permit a localhost callback. Do not weaken callback, state or PKCE validation to bypass that restriction.

