# API tests

`auth.integration.test.ts` and `guilds.integration.test.ts` exercise the real HTTP stack, Prisma services, and a dedicated PostgreSQL database. See `docs/api.md` for migration and `TEST_DATABASE_URL` setup. The suite is skipped when that variable is missing; a skip is not database test coverage.

The suites create randomly identified accounts and delete only their own fixture accounts and cascading server/channel data afterwards. Never use a production database. Additional foundation, authorization, and feature tests can be added as those behaviors are implemented.
