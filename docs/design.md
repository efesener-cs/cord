# Design

This document records the visual direction approved for Cord's frontend. Use it as the reference for new screens and changes to existing ones. Implementation lives in the shared client and UI packages; this document does not imply that backend or native features exist.

## Visual direction

Cord uses a familiar Discord-like application layout with a calmer, more restrained identity. Gruvbox and Everforest inform the warm text, earthy accent colors, and softened contrast. The Matrix films inform subtle terminal details and decorative code patterns.

- Dark mode uses a near-black canvas and neutral charcoal surfaces. Panels should stand out through surface contrast and thin borders rather than a green wash.
- Use muted green for selected states, important actions, presence, and small decorative accents. Keep most backgrounds neutral. Avoid saturated neon, heavy glow, and pervasive green text.
- Light mode uses warm off-white backgrounds, cream panels, dark neutral text, and deeper green accents. Maintain the same hierarchy and interactions in both themes.
- Use warm, readable text, understated secondary labels, modest corner radii, fine borders, and generous but practical spacing. Monospace typography belongs in terminal cues, compact metadata, and the brand; body copy uses the shared system sans-serif stack.
- Keep Matrix decorations quiet and secondary to navigation, conversations, and people. Decorative code is not functional content.

## Identity

The main logo is the lowercase monospace `c` with its small terminal-like dot, on a rounded square. Preserve the approved silhouette and spacing. The letter is outlined as SVG paths and must not depend on an installed font.

- Standalone asset: `packages/ui/src/assets/cord-logo.svg`, exported as `@cord/ui/cord-logo.svg`.
- Shared component: `packages/ui/src/CordLogo.vue`, exported as `@cord/ui/CordLogo.vue`.
- The component supports the themed tile and a transparent `markOnly` variant for decorative placement.
- Reuse these assets for the home button, welcome illustration, and favicon. Keep the `cord_` wordmark where a text signature is appropriate.

## Screens and navigation

The public home page (`/`) introduces Cord using the approved visual language, a community conversation illustration, a concise product explanation, and clear signup/login/dashboard links (which require login). Do not substitute the dashboard for the public landing page. Describe self-hosting and unimplemented communication features as goals, not available services.

Login (`/login`) and registration (`/register`) share a conventional labeled form layout, a restrained terminal-window illustration with the `c.` mark, subtle Matrix code texture, and local connection/status lines, and links between the forms and public home. Reuse the main logo, semantic tokens, and theme/language controls. The form is the primary task; decorative branding gives way on narrow screens. Forms use the account API, show localized pending/error/success states, and return to login after registration. Explain the username/password rules and absence of email verification.

The communication application lives at `/dashboard`. Its default overview is labeled “Genel bakış” in Turkish and “Overview” in English; avoid game-like labels such as “Ana üs” or “Home base”. Use Vue Router and `RouterLink` for navigation between screens. Keep shared routing in `packages/client`, with platform history supplied by application adapters. A Pinia session store shares the authenticated public user across login and dashboard. Web restores it from a server-validated HttpOnly cookie after refresh; Electron restores its native session through the main-process vault before verifying it. Do not briefly present restored identity as authenticated before `/users/me` succeeds. Passwords and form-only values do not belong in global state. When Electron lacks secure system storage, show a native warning in the selected language with **Saklama / Don't save** as default/cancel and **Onayla, şifresiz sakla / Confirm and save unencrypted** as the explicit alternative. Explain the unencrypted session-token exposure and process-only behavior; never save the password. Consent applies only to the current login.

## Servers, conversations, and notifications

The authenticated server rail uses API-backed joined servers, with readable initials and names/tooltips. Its add/join controls open real creation and invitation-code forms. Server creation saves a server, creator membership, and default `genel` channel. The sidebar shows the selected server's actual text channels only in server context. Owner actions include channel creation, invitation creation/revocation, and member removal; members can leave. Server deletion requires explicit confirmation and describes cascading deletion. There is no Inbox page.

Messages remains a navigation button, never an expandable sidebar list. It opens actual DMs in the center; Friends shows accepted relationships and incoming/outgoing requests, with explicit acceptance/decline/cancel/remove actions. Opening the dashboard starts on Overview. Overview lists real joined servers and an empty state when there are none; it no longer presents sample servers as joined communities. The public landing conversation artwork remains illustrative.

`RealChat.vue` presents authorized channel/DM history, previous-page loading, typing indicators, server-backed files, and a message composer. Enter sends, Shift+Enter inserts a newline, and IME composition must not submit. Failed sends preserve drafts/retry identifiers; empty/loading/error/retry states are localized. New messages and history merge by ID; refresh/restart loads persisted data. Do not seed live conversations with demo authors or local reflection replies.

Message input and add/send controls occupy separate columns. Allow attachment-only messages, up to four files at 10 MiB each. Uploads show pending state and can be removed before send; downloads require authentication/current destination access. Raster-image previews are opt-in and use downloaded Blob URLs. Release URLs on unmount. Do not inline active HTML or SVG. Copy explains that messages/files persist on the server rather than promising local-only storage.

The bell opens a nonmodal persistent notification list with unread states, mark-all/read synchronization, and navigation into the matching DM or Friends. Its badge uses a readable numeral and does not change header spacing. Outside-click/Escape dismiss; keyboard focus and short/narrow scroll constraints remain required. System notifications are explicitly opt-in from Settings. Native local delivery is separate from closed-app push; closed-app Android delivery requires the separately configured optional FCM integration.

Calls are started for the active channel/DM. A separate call panel shows participants and microphone, camera, screen-sharing, and leave controls, without replacing conversation scrolling. Keep it constrained on short screens. Media access/permission/connection errors must be visible. Browser/Electron screen sharing uses a real picker; Android uses its explicit MediaProjection consent flow; unsupported platforms report the limitation. Keep calls until explicitly left, logout, or loss of their current server; changing conversations alone need not end a call.

## Layout and scrolling

The dashboard application is a viewport-sized shell, not a vertically scrolling document. Its height and maximum height are `100vh`, with `100dvh` taking precedence on supporting browsers to follow the currently available viewport on mobile.

- Keep the server rail, navigation sidebar, top bar, and status bar within the viewport. The document itself must not scroll.
- Allow the server rail and sidebar content to scroll internally on short screens. Keep the sidebar profile controls outside its scrolling content.
- The desktop overview has a central welcome/recommendations column and a secondary activity column. Reuse the login terminal illustration in the welcome card, without orbital decoration. Below it, show real joined-server cards and creation/join actions, including a clear empty state. Do not mix sample server cards into the authenticated server list. Messages and Friends show their lists in the center without the secondary activity column. Each column scrolls independently when its content exceeds the available height.
- A conversation occupies the space between the application header and status bar. Its message list scrolls independently; the conversation header and message composer stay visible.
- Let flex layout determine the remaining conversation height. Do not subtract assumed header/footer pixel heights from the viewport. Nested flex containers and scrolling children need `min-height: 0` so content can shrink within the shell.
- Contain scrolling within each region. Modal content must also remain reachable through internal scrolling on short screens.
- Scrollbars are thin and use the shared border color. Do not hide scrollbars in regions that need scrolling.

Public and authentication pages use a separate shell with internal vertical page scrolling so the landing page can contain multiple sections. The document itself remains fixed to the viewport. Do not apply the dashboard's fixed chrome or independent-column layout to these public screens.

## Responsive behavior

Preserve the content hierarchy when space is limited. At the current breakpoints, the activity column is hidden at widths of 1050px and below. At 720px and below, the navigation sidebar becomes a toggleable overlay while the server rail remains visible. Compact header controls retain theme, language, and notification access.

Keep the same viewport and independent message-scrolling behavior across widths and heights. Check short laptop windows as well as narrow screens; responsive work must account for height, not only width. Do not make content unreachable merely to remove document overflow.

Native mobile adapters reserve safe-area insets and let the shared shell fill the remaining space. Validate mobile keyboard/inset behavior on a native target; browser responsiveness alone does not verify it.

## Theme and language controls

Theme and language controls sit in the top-right header beside notifications. Both themes are first-class variants of the same design.

Colors belong in semantic CSS custom properties in `packages/ui/src/styles.css`; components consume those tokens through scoped CSS. Cover backgrounds, borders, text, hover/selected states, avatars, and decorations in both themes. Avoid introducing isolated color literals in screen styles.

The temporary manual language switch offers Turkish and English. Translate screen copy, accessible labels, input placeholders, dialog feedback, and demo activity descriptions. Update the document language and title with the selected language. Proper names and user-written messages are not translated.

The public preview starts in Turkish and dark mode. Authenticated dashboard startup restores saved theme/language from account preferences; subsequent changes persist through the API. Automatic locale detection and other account settings remain deferred. Switching theme or language must not clear the current conversation or its messages.

## Interaction and accessibility

Use semantic buttons, inputs, navigation, and headings. Icon-only controls need localized accessible names. Keep keyboard focus visible, trap focus in modal dialogs, return focus on close, support Escape, and honor reduced-motion preferences. Preserve readable contrast in both themes and keep actions accessible when content overflows.

Authenticated people, presence, servers, channels, messages, and notifications use real backend state. The landing artwork and retained isolated demo components are illustrative only. The new implementation still needs user verification; do not claim signed releases, provider-configured push delivery or verified device behavior before actual validation.

## Validation

For this slice the user explicitly owns verification. The commands below are a handoff, not executed results. Run `pnpm typecheck`, `pnpm build`, and `git diff --check` after frontend changes. When browser preview is available, inspect both themes and languages, landing, authentication, dashboard, and conversation screens, narrow widths, and short heights. Confirm that the document does not scroll, overflowing content remains reachable, and long conversations scroll without moving the composer or application chrome. Report when browser verification is unavailable.
