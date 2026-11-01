# Implementation scope and remaining work

The user requested the full roadmap, with local/self-hosting packages and Android first, and explicitly took ownership of tests and verification. Checked implementation entries below mean source/configuration is present; they do not mean compiled, tested, deployed, or release-ready.

- [x] Account/session foundations and explicit no-keyring desktop storage consent.
- [x] Persistent servers, channels, owner/member authorization, and real dashboard controls.
- [x] Expiring/revocable invitation codes, joining/leaving, member list/removal, server deletion.
- [x] Persistent channel/direct messages, paginated history, authorization, and send retry deduplication.
- [x] Socket.IO delivery, reconnect/history recovery, friend presence, and typing.
- [x] Friend requests, acceptance/cancel/decline/removal, persistent notifications and read state.
- [x] Authorized uploads/downloads, attachment claims, private volume, cleanup, and client file UI.
- [x] Persistent account theme/language preferences.
- [x] Native mobile secure session storage and opt-in local notification/optional Android FCM adapters.
- [x] Microphone/camera permissions, LiveKit calls/video, browser/desktop capture, Android MediaProjection screen capture, and media access reconciliation.
- [x] Local/self-hosting Compose, HTTPS configuration, media ICE/TURN UDP, backup/guarded restore scripts.
- [x] Local desktop packaging, Android debug/release build commands, operator signing configuration, and shared native branding.
- [ ] User-run compilation, automated tests, browser/responsive checks, native/device checks, package launch, migration/backup restoration, and real media/network verification: see [verification.md](verification.md).

## Remaining platform/product integrations

These are explicit limits, not disguised previews:

- iOS screen broadcasting requires a separate ReplayKit extension; Android MediaProjection and browser/desktop capture source are present but unverified.
- Optional closed-app Android delivery requires operator Firebase project/configuration and credentials. APNs/iOS background integration remains outside the Android-first package target. Local notifications alone depend on a running app.
- Configurable roles, ownership transfer, account recovery/email verification, moderation, and richer message editing/search are not part of the implemented baseline.
- Public domains, operator secrets, trusted certificates, firewall/NAT configuration, OS signing/notarization, iOS/macOS builds, app-store accounts, and release distribution require operator/platform setup. No public deployment or signed artifact is claimed.
- Restrictive networks allowing only TURN/TLS on 443 need additional TURN domain/certificate/network configuration beyond the included UDP TURN setup.

The baseline is a single API process. Distributed presence/rate limiting/Socket.IO and object-storage scaling are future architecture work, not hidden dependencies of local self-hosting.
