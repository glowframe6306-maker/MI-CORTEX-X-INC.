# Temporary Database Diagnostic Setup

This guide is for the temporary, CEO-allowlisted, read-only Neon diagnostic. It does not configure or provision Google, Upstash, Vercel, or Neon resources.

## Google Identity Services

1. In Google Cloud Console, select an approved project or create one under the organization's account.
2. Configure the OAuth consent screen for the intended internal audience and add the operator account as required by the selected audience type.
3. Create an OAuth client ID with application type **Web application**.
4. Add this authorized JavaScript origin:
   - `https://mi-cortex-x-inc.vercel.app`
5. For local manual testing on the local server, also add:
   - `http://localhost:4173`
6. Configure `GOOGLE_CLIENT_ID` with the OAuth **Client ID** (not a client secret).
7. Configure `DIAGNOSTIC_OPERATOR_EMAIL` to the exact verified Google account email for the authorized operator. Do not copy the value into source code.

The browser receives the public Client ID to initialize Google Identity Services. The server verifies the returned ID token using `google-auth-library`, including its signature, issuer, audience, expiry, nonce, verified-email claim, and exact operator email. No Google token is stored or logged.

## Upstash Redis

Create or select an organization-approved Upstash Redis database, then configure these names in the approved runtime environment:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The REST token is server-only. Never put it in browser code, source, URLs, logs, or responses. Redis stores only a SHA-256 nonce hash and short-lived rate-limit counters. The nonce is consumed with a Lua compare-and-delete script, so concurrent uses cannot both pass. Redis errors fail closed.

## Required Runtime Configuration

- `GOOGLE_CLIENT_ID`
- `DIAGNOSTIC_OPERATOR_EMAIL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

No values are included in this repository. Do not share credentials with the coding agent. Do not add these to Production without separate approval. This implementation does not reuse `SESSION_SECRET`.

## Protection and Deployment Status

The temporary diagnostic has Redis-backed shared limits for challenge issuance, verification attempts, and successful operator probes. These are service-level limits, not a substitute for verified Vercel Production access protection. Team Firewall configuration and Production protection/bypass coverage remain subject to separate verification. Do not deploy until the Production security gates are reviewed and explicitly approved.