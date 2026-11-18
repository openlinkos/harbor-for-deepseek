# apps/server

Reserved for milestone M2. Not implemented.

M2 is a self-hosted backend the operator runs for themselves and people they invite: Docker Compose, PostgreSQL, a first-run admin wizard, an admin-held key pool, invite accounts, quotas, and incremental sync. There is no public Harbor chat backend. The static site does not point at one.

The browser storage in `packages/storage` already keeps `rev`, `updatedAt`, and tombstones so that backend can sync later without a second local schema. See `mergeSnapshot`.
