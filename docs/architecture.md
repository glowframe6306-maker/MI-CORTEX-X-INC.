# MI CORTEX Global Core Architecture

## Runtime

- Node.js HTTP server
- Local JSON persistence
- Local file-content storage
- SHA-256 connector credential hashes
- No external database credential required for local operation

## Synchronization

- Event ID
- Project ID
- Origin project ID
- Entity ID and entity type
- Operation
- Version
- Timestamp
- Scope
- Idempotency key

## Delivery

- Origin filtering prevents a project from receiving its own event
- Outbox IDs track pending cross-project delivery
- Checkpoints record local replay progress
- Duplicate event and idempotency keys are deduplicated
- Stale updates and same-version conflicts are retained for review

## Files

- Base64 upload API
- SHA-256 integrity digest
- Stored versioned copies
- Metadata history
- Soft deletion
- Restore operation

## Security boundaries

- Project registration requires an explicit bootstrap token when configured
- Connector APIs require bearer authentication
- Scope permissions are checked on data and file operations
- Admin dashboard endpoints require an admin-role connector
- Passcodes, private keys, session tokens, and secrets are never synchronized

## Not implemented locally

- External queue broker
- External object storage
- External production database
- Real multi-tenant OAuth/WebAuthn identity
- Real production connector integrations
- Live cross-project deployments
