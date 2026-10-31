# API tests

Vitest is available through the existing Vite+ toolchain; a second test runner dependency is not needed. Add tests as `test/**/*.test.ts` and import APIs from `vite-plus/test`.

Run `pnpm api:test` from the repository root or `pnpm test` from this package. No test cases are included yet: the user is working on testing. The command intentionally reports no test files until cases are added; do not mistake that for a passing suite.

`createApp()` in `src/app.ts` creates the Express application without listening, and `readConfig()` accepts an explicit environment object. They can be exercised independently. To test HTTP behavior with Node's built-in `fetch`, start the app on an ephemeral loopback port in test setup and close its server in teardown. No production server should be required.

Suggested first cases: health response and content type; JSON 404 for unknown/versioned routes; malformed JSON; request body limit; server-generated request IDs; configuration rejection; error redaction. Authentication/authorization and broader security tests follow when those features exist.
