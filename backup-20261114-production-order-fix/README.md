# MI CORTEX X INC. Website

The MI CORTEX X INC. corporate website and its local Node.js service for Careers applications and administration.

The public pages describe the company and its proposed sub-company concepts. Proposed companies, products, and services are not represented as separately registered or currently operating businesses.

## Technology

- HTML, CSS, and browser JavaScript
- Node.js 24 or newer
- SQLite through Node's built-in `node:sqlite`
- Neon PostgreSQL for persistent production records, sessions, and rate limits
- Private Vercel Blob for production applicant PDFs
- `bcryptjs` for CEO password hashing and `scrypt` for Careers Admin passwords
- PGlite for isolated PostgreSQL integration tests; `jsdom` for local server tests

## Project structure

- Root-level HTML files: corporate, information, project, contact, and administration pages
- `styles.css`, `careers.css`, `contact.css`, and other page stylesheets: site and page styling
- `script.js`, `careers-*.js`, and `sub-companies-profile.js`: browser interactions
- `careers-server.js`: local HTTP server, Careers APIs, and CEO dashboard authentication
- `serverless/`: PostgreSQL schema, Vercel request handler, validation, and serverless integration tests
- `api/index.mjs`: Vercel Function entry point
- `scripts/`: static-site build, explicit schema setup, and interactive admin provisioning
- `careers-server.test.js` and `serverless/serverless.test.js`: local and isolated serverless integration tests
- `assets/`: public company logo and supplied company/profile images

## Install and test

Install dependencies and run the test suite:

```powershell
npm install
npm test
```

Check JavaScript syntax with Node:

```powershell
Get-ChildItem -File -Filter *.js | ForEach-Object { node --check $_.FullName }
```

## Local server

The service requires `CAREERS_ENCRYPTION_KEY`, a base64-encoded 32-byte key. In PowerShell, generate and assign a key for a new local data store without printing the value:

```powershell
$env:CAREERS_ENCRYPTION_KEY = node .\careers-server.js generate-key
node .\careers-server.js
```

The default port is `4173`; set `PORT` to use another port. The service binds to `127.0.0.1` and rejects non-local connections. It is a local prototype, not a production web server.

The default database directory is `.careers-local`. `CAREERS_DATA_DIR` can point to another private local directory. Keep both the database and its original encryption key backed up securely. Do not generate a replacement key for a database that contains encrypted application data: the replacement key cannot decrypt existing records or documents.

The service also recognizes these optional settings:

- `CAREERS_OPEN_AT`: application opening timestamp; the default is 1 January 2029, Asia/Colombo.
- `CAREERS_RECRUITMENT_APPROVED`: recruitment remains disabled unless explicitly set to `true`.
- `CAREERS_RETENTION_DAYS`: application retention period; defaults to 90 days and is constrained by the server.
- `CAREERS_ADMIN_EMAIL` and `CAREERS_ADMIN_PASSWORD`: required only by the separate Careers administrator initialization command, `node .\careers-server.js admin:create`.

The Careers administration page and its email/password session are separate from the corporate CEO dashboard.

## CEO dashboard authentication

- `/admin` serves the CEO login page.
- `/admin/dashboard` requires a server-validated CEO session.
- Run `node .\careers-server.js site-admin:create` once in an interactive PowerShell terminal to create the initial CEO account. Enter the username, password, and confirmation at the prompts; password input is hidden.
- The CEO password is stored as a bcrypt hash. Never put credentials in source files or commit private data.
- Successful login creates an eight-hour, server-side session using an `HttpOnly`, `Secure`, `SameSite=Strict` cookie. Login attempts are rate-limited, and logout invalidates the session.
- The local session store is in memory and is cleared when the local server restarts. The local service must not be exposed to the public internet.

## Vercel serverless deployment

The public website is built into `dist/`. `admin.html` and `admin-login.html` are deliberately excluded from static output; Vercel includes them only in the server function, which serves `/admin` and `/admin/dashboard` after checking the persistent CEO session. The local-only Careers administration prototype (`careers-admin.html`, `careers-admin.js`, and `careers-admin.css`) is also excluded from public output. The serverless Careers record APIs require the separate Careers Admin session.

Deployment configuration:

- Root Directory: repository root
- Framework Preset: Other
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install` (or Vercel's default install command)
- Runtime: Node.js 24

The serverless APIs use Neon PostgreSQL. Session tokens are random, held in `HttpOnly`, `Secure`, `SameSite=Strict` cookies, and stored as keyed hashes in PostgreSQL. Login rate limits are also stored in PostgreSQL and shared across function instances. Applicant fields and document metadata are encrypted with AES-256-GCM. Applicant PDFs use direct client-to-Blob uploads, are validated server-side, and are served only after server-side Careers Admin authorization. The Blob store must be created with **Private** access; public Blob stores are not supported for applicant documents.

Required Vercel Environment Variable names:

- `DATABASE_URL`
- `CAREERS_ENCRYPTION_KEY`
- `SESSION_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `BLOB_STORE_ID` (provided when the private store is connected)
- `VERCEL_OIDC_TOKEN` (provided by Vercel for private Blob reads and deletes)
- `CRON_SECRET`
- `TELEGRAM_BOT_TOKEN` (required for order notifications)
- `TELEGRAM_CHAT_ID` (required for order notifications)
- `CAREERS_OPEN_AT` (optional; defaults to 1 January 2029, Asia/Colombo)
- `CAREERS_RECRUITMENT_APPROVED` (optional; must be exactly `true` to enable recruitment after the opening date)
- `CAREERS_RETENTION_DAYS` (optional; defaults to 90 and is limited to 30–365)

Connect the private Blob store to the Vercel project so Vercel provides `BLOB_STORE_ID` and the OIDC token through the function request context. Do not configure a static `VERCEL_OIDC_TOKEN`; the Blob SDK reads the runtime-issued token and may fall back to that environment variable. `BLOB_READ_WRITE_TOKEN` is also required by the server-side `handleUpload` route to issue browser upload tokens; add it through the Blob connection's read-write-token option. Never copy token values into source or commit them. Vercel's scheduled cleanup function also requires `CRON_SECRET`. Each cleanup invocation processes at most five application batches of 100 and five staged-document batches of 500; if a run times out or storage deletion fails, remaining records are eligible for the next scheduled run.

Provisioning is intentionally manual and is not run by the build or deployment:

1. Create a Neon database and a private Vercel Blob store in the approved environment; do not point setup commands at production without separate approval.
2. Set `DATABASE_URL` and run `npm run careers:serverless:migrate` to create the schema only. This command does not import the local SQLite database. The schema includes persistent product/service order and idempotency tables; applying it to an existing production database is a migration and requires separate approval.
3. Set `CAREERS_ENCRYPTION_KEY` and `SESSION_SECRET` to independently generated base64-encoded 32-byte keys; retain secure backups because existing encrypted applicant records cannot be decrypted without the original key. In PowerShell, assign independent generated values without displaying them:
   ```powershell
   $env:CAREERS_ENCRYPTION_KEY = node -p "require('node:crypto').randomBytes(32).toString('base64')"
   $env:SESSION_SECRET = node -p "require('node:crypto').randomBytes(32).toString('base64')"
   ```
4. With the approved database selected, run `npm run careers:serverless:provision` in an interactive PowerShell terminal. Choose `CEO` or `Careers`, then enter and confirm the password at the hidden prompts. Each role has a one-account-only constraint; provisioning will not overwrite an existing account.
5. Connect the private Blob store to the Vercel project and set the Environment Variables above. Keep recruitment disabled until the company separately authorizes an opening date and approval.
6. Review the build and deploy through the organization's approved Vercel process. This work does not create resources, change project settings, or deploy.

### Existing local-data migration

No SQLite records or applicant PDFs are copied by this project. Any future data migration requires separate written approval, a reviewed field/document mapping, confirmation of the correct encryption keys and retention/deletion obligations, private transport and storage, a verified backup and rollback plan, and a dry run against an isolated database. Do not run an applicant-data migration until that process is explicitly approved. The local `.careers-local` directory remains untouched.

## Careers system

The Careers catalogue and pages are public, but application submission is gated by both the configured opening date and explicit recruitment approval. Both local and serverless services validate applications. The local service encrypts records and documents in SQLite; the serverless service encrypts applicant fields and metadata in PostgreSQL and uses private Blob storage for PDFs. Careers Admin authentication remains separate from CEO dashboard authentication. Do not enable recruitment until all database, private-storage, secret, and account provisioning requirements have been completed and approved.

## Security and private data

- `.careers-local/`, databases, environment files, private uploads, dependencies, backups, logs, and local agent configuration are excluded by `.gitignore`.
- Do not commit CEO account data, password hashes, encryption keys, session data, applicant records, or uploaded documents.
- Keep secrets in the process environment or an approved secret manager; this project does not load `.env` files.
- The local Careers/CEO authentication service is not configured for production hosting.
