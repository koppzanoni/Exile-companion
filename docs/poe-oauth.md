# Path of Exile OAuth (web app)

Relic Lens imports only the character data a player authorizes through the official PoE OAuth API. It requests `account:characters`, which permits listing PoE 2 characters and reading a selected character's equipment/passives. It does not request passwords, cookies, stashes, or game-file access.

## Server configuration

Register a confidential web application with Grinding Gear Games and configure its approved HTTPS callback. Set these variables only on the backend server:

```text
POE_OAUTH_CLIENT_ID=registered-client-id
POE_OAUTH_CLIENT_SECRET=registered-client-secret
POE_OAUTH_REDIRECT_URI=https://your-domain.example/api/poe/oauth/callback
POE_OAUTH_TOKEN_ENCRYPTION_KEY=a-long-random-server-secret
POE_OAUTH_CONTACT=ops@your-domain.example
POE_OAUTH_USER_AGENT=OAuth registered-client-id/1.0 (contact: ops@your-domain.example)
FRONTEND_URL=https://your-domain.example
```

`POE_OAUTH_TOKEN_ENCRYPTION_KEY` encrypts stored OAuth tokens using AES-256-GCM. Do not change it after users connect accounts unless they reconnect. Never put the client secret or encryption key in Vite variables or frontend source.

## Flow

1. The player opens Characters and chooses **Connect Path of Exile account**.
2. The backend creates OAuth `state` and PKCE verifier, then redirects to GGG.
3. GGG redirects to the configured callback after consent.
4. The backend exchanges the code, encrypts tokens, and redirects back to Characters.
5. The player selects a PoE 2 character and imports its currently equipped items into the existing local character record.

The app uses manual synchronization. Failed imports retain existing local equipment and show the provider error. PoE 2 does not expose unequipped inventory through the character endpoint, so the import is deliberately limited to equipment returned by the official character resource.
