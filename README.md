# MI CORTEX X INC. Website

The MI CORTEX X INC. corporate website and its local Node.js service for Careers applications and administration.

The public pages describe the company and its proposed sub-company concepts. Proposed companies, products, and services are not represented as separately registered or currently operating businesses.

## Technology

- HTML, CSS, and browser JavaScript
- Node.js 24 or newer
- SQLite through Node's built-in `node:sqlite`
- `bcryptjs` for CEO dashboard password hashing
- `jsdom` for server integration tests

## Project structure

- Root-level HTML files: corporate, information, project, contact, and administration pages
- `styles.css`, `careers.css`, `contact.css`, and other page stylesheets: site and page styling
- `script.js`, `careers-*.js`, and `sub-companies-profile.js`: browser interactions
- `careers-server.js`: local HTTP server, Careers APIs, and CEO dashboard authentication
- `careers-server.test.js`: catalogue, application, and authentication integration tests
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
- The current session store is in memory and is cleared when the server restarts. The local service must not be exposed to the public internet.

The current static hosting configuration does not provide an authenticated production backend. A production deployment must route `/admin`, `/admin/dashboard`, and `/api/site-admin/*` through a server-side authentication service over HTTPS, and protect all administrative APIs there. This checkout does not contain or verify that production routing configuration.

## Careers system

The Careers catalogue and pages are public, but application submission is gated by both the configured opening date and explicit recruitment approval. The server validates applications and documents, stores applicant information and documents encrypted, and requires the separate Careers administrator session to access records. Do not enable recruitment or handle real applicant data with the loopback-only prototype.

## Security and private data

- `.careers-local/`, databases, environment files, private uploads, dependencies, backups, logs, and local agent configuration are excluded by `.gitignore`.
- Do not commit CEO account data, password hashes, encryption keys, session data, applicant records, or uploaded documents.
- Keep secrets in the process environment or an approved secret manager; this project does not load `.env` files.
- The local Careers/CEO authentication service is not configured for production hosting.
