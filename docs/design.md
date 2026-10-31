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

The public home page (`/`) introduces Cord using the approved visual language, a community conversation illustration, a concise product explanation, and clear signup/login/dashboard-preview links. Do not substitute the dashboard for the public landing page. Describe self-hosting and unimplemented communication features as goals, not available services.

Login (`/login`) and registration (`/register`) share a conventional labeled form layout, a restrained terminal-window illustration with the `c.` mark, subtle Matrix code texture, and local connection/status lines, and links between the forms and public home. Reuse the main logo, semantic tokens, and theme/language controls. The form is the primary task; decorative branding gives way on narrow screens. The registration alert and permissive login are temporary UI preview behaviors documented in `development.md`.

The communication application lives at `/dashboard`. Its default overview is labeled “Genel bakış” in Turkish and “Overview” in English; avoid game-like labels such as “Ana üs” or “Home base”. Use Vue Router and `RouterLink` for navigation between screens. Keep shared routing in `packages/client`, with platform history supplied by application adapters. A small Pinia session store shares the display name across login and dashboard; passwords and form-only values do not belong in global state.

## Local chat, rooms, and notifications

The server rail opens the Forest, Terminal, and Night Owls room lists. Each server has distinct local text rooms. Show rooms in the sidebar only while a server is active. There is no Inbox entry or page. Messages is a navigation button, never an expandable section: it must not reveal people or DM shortcuts below it. Leave the sidebar below navigation empty on personal screens. Clicking Messages shows the people/conversation list exclusively in the center; selecting a person opens their conversation there. Opening the dashboard starts on Overview with no conversation selected. Switching rooms or DMs preserves separate session histories.

DMs and rooms share a conversation component. Enter sends; Shift+Enter inserts a new line; IME composition must not accidentally submit. A visibly labeled local echo makes a typed `test` message immediately testable without the API. Initial conversation content and notification items are sample data, not remote messages.

Place the message field, attachment/add control, and send control in separate layout columns so buttons never cover text. The add control opens an upward attachment menu for files/images. Selected files appear as removable pending attachments; sent files show names/sizes and a download link, with safe raster-image previews. Allow attachment-only messages. The preview limit is four files per message and 10 MiB per file. Blob URLs are session-local, pending URLs are released when discarded, and sent URLs are released when the demo session is reset. Do not render attached HTML or SVG as inline active content. No upload to the server occurs.

The notification bell opens a nonmodal popover containing received-message previews and unread state; it does not navigate directly to the inbox page. Clicking a notice opens its sender's DM and marks that conversation read. Support outside-click and Escape dismissal, keyboard focus, and constrained scrolling on short screens. The bell badge counts unread notices; the initial preview has three. Unread notices and corresponding central conversation rows use an accent background, edge, and explicit unread label. Opening a conversation marks its notices read and updates the badges. Opening the popover alone does not clear unread state. A clearly labeled action can simulate an incoming message for testing.

## Layout and scrolling

The dashboard application is a viewport-sized shell, not a vertically scrolling document. Its height and maximum height are `100vh`, with `100dvh` taking precedence on supporting browsers to follow the currently available viewport on mobile.

- Keep the server rail, navigation sidebar, top bar, and status bar within the viewport. The document itself must not scroll.
- Allow the server rail and sidebar content to scroll internally on short screens. Keep the sidebar profile controls outside its scrolling content.
- The desktop overview has a central welcome/recommendations column and a secondary activity column. Reuse the login terminal illustration in the welcome card, without orbital decoration. Below it, show local community discovery cards and conversation continuation suggestions instead of a friends list. Community cards open existing sample server rooms; they do not claim to join a remote server. Messages and Friends show their lists in the center without the secondary activity column. Each column scrolls independently when its content exceeds the available height.
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

The current preview starts in Turkish and dark mode. Preferences are session-only and reset on reload. Automatic user-locale detection, persisted preferences, and account settings are deferred. Switching theme or language must not clear the current conversation or its messages.

## Interaction and accessibility

Use semantic buttons, inputs, navigation, and headings. Icon-only controls need localized accessible names. Keep keyboard focus visible, trap focus in modal dialogs, return focus on close, support Escape, and honor reduced-motion preferences. Preserve readable contrast in both themes and keep actions accessible when content overflows.

People, presence, listening activity, and voice-channel content are demo fixtures. Local message entry and navigation are interactive previews. Do not present unimplemented calls, server creation, or backend operations as working features; explain their preview status when invoked.

## Validation

Run `pnpm typecheck`, `pnpm build`, and `git diff --check` after frontend changes. When browser preview is available, inspect both themes and languages, landing, authentication, dashboard, and conversation screens, narrow widths, and short heights. Confirm that the document does not scroll, overflowing content remains reachable, and long conversations scroll without moving the composer or application chrome. Report when browser verification is unavailable.
