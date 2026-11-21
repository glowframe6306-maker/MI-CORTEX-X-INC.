# MI CORTEX Global Core

Standalone, local-first synchronization core for MI CORTEX X INC.

## Run

```powershell
npm start
```

Optional bootstrap token:

```powershell
$env:CORTEX_BOOTSTRAP_TOKEN='use-a-local-random-token'
npm start
```

Open `http://localhost:3100`.

## Security model

- Project registration requires `X-Cortex-Bootstrap` when `CORTEX_BOOTSTRAP_TOKEN` is set.
- Project API calls require `Authorization: Bearer <connector-token>`.
- Connector tokens are stored only as SHA-256 hashes.
- Raw Passcodes, API keys, session tokens, private encryption keys, and vault data are never synchronized.
- Scope and project authorization are enforced for data and file access.

## API

- `POST /api/projects`
- `POST /api/events`
- `POST /api/data`
- `GET /api/data?scope=global`
- `POST /api/files`
- `GET /api/files/:entityId?scope=global`
- `DELETE /api/files/:entityId?scope=global`
- `GET /api/events?after=0`
- `POST /api/checkpoints`
- `GET /api/admin/dashboard`

## Persistence

Local JSON state is stored in `.data/core.json`; uploaded files are stored in `.data/files`.

## Not yet integrated

No existing production project is connected. Integration requires a separate audited connector plan for each application.
