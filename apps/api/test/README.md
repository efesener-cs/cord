# API tests

`auth.integration.test.ts` exercises the real HTTP stack, Prisma services, and a dedicated PostgreSQL database. See `docs/api.md` for migration and `TEST_DATABASE_URL` setup. The suite is skipped when that variable is missing; a skip is not database test coverage.

The test creates a random account and deletes only that account afterwards. Never use a production database. Additional foundation, authorization, and feature tests can be added as those behaviors are implemented.
