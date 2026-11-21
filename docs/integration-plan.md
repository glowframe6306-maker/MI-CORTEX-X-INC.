# Integration Plan

## Discovery Result

Public repositories discovered on the authorized GitHub account:

- 3A-MISSION
- MI-AI
- canva-pro-cortex-x
- sihinayata-kotiyak
- MI-CORTEX-X-INC.
- TBJZC-Website
- A repository named `-`

No existing project application is modified by this standalone scaffold.

## Compatibility Status

- 3A-MISSION: Not ready for production integration until owner enrollment is resolved.
- MI-AI: Needs source audit and a project-specific connector plan.
- canva-pro-cortex-x: Needs source audit and data-scope mapping.
- sihinayata-kotiyak: Needs source audit.
- MI-CORTEX-X-INC.: Potential organization hub; needs architecture and credential audit.
- TBJZC-Website: Needs source audit and API availability review.
- Repository `-`: Unrelated/ambiguous until explicit approval.

## Required Connector Contract

Every project receives a unique project ID and a single-use-readable connector token at registration. Tokens are stored as hashes only. Projects publish idempotent events and subscribe within explicitly authorized scopes.

## Not Synchronized

Passcodes, raw passwords, API keys, session cookies, private encryption keys, and unauthorized private customer records.
