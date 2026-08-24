# Partner Sync - Project TODO

## Core Features

### Authentication & Partner Connection
- [x] User authentication (email/password + OAuth)
- [x] Secure token storage in device keychain
- [x] Partner connection flow (invite/accept)
- [x] Unique partner code generation
- [x] Connection status management

### End-to-End Encrypted Chat
- [x] Message encryption/decryption with TweetNaCl.js dual envelopes
- [x] Per-device Curve25519 key generation and public-key publication
- [x] Chat screen UI with message list
- [ ] Real-time message delivery
- [x] Message status indicators (sent, delivered, read)
- [x] Typing indicators
- [x] Message timestamps
- [ ] Message search functionality

### Shared To-Do Tasks
- [x] Task creation form
- [x] Task list display with FlatList
- [x] Task completion toggle
- [ ] Task editing functionality
- [x] Task deletion with confirmation
- [x] Priority levels (Low, Medium, High)
- [ ] Due date assignment
- [x] Task filtering (All, Active, Completed)
- [ ] Real-time task sync between partners
- [x] Completion count display

### Goal Completion Rate Calculator
- [x] Goal creation form
- [x] Completion rate calculation logic
- [x] Visual progress indicators (percentage bars)
- [x] Statistics display (total, completed, rate)
- [ ] Historical trend tracking
- [x] Goal management (edit, delete)
- [x] Analytics screen

### UI & Navigation
- [x] Tab bar setup (Chat, Tasks, Goals, Settings)
- [x] Tab icons mapping in icon-symbol.tsx
- [x] Home screen layout
- [x] Partner connection screen
- [x] Chat screen layout
- [x] Tasks screen layout
- [x] Goals screen layout
- [x] Settings screen layout
- [x] Dark/light theme support

### Settings & User Management
- [x] User profile display
- [x] Partner information display
- [x] Theme toggle (light/dark)
- [x] Notification preferences
- [x] Logout functionality
- [x] About section

### Branding & Polish
- [x] Generate custom app logo
- [x] Update app.config.ts with branding
- [x] Color scheme customization
- [x] App name and slug configuration
- [x] Splash screen setup

### Testing & Deployment
- [ ] End-to-end flow testing
- [x] Encryption/decryption verification
- [ ] Real-time sync testing
- [x] Error handling and authentication fallback states
- [ ] Performance optimization
- [x] Final checkpoint before publish
- [x] Publish device-held public keys to the partnership safely
- [x] Encrypt each message for both partners and preserve decryptable copies
- [x] Repair message loading, authentication fallbacks, and error states
- [x] Add deterministic tests for encrypted-message round trips
- [x] Verify the release build and create a deployment checkpoint

---

## Implementation Notes

- Using TweetNaCl.js for E2E encryption with keys stored in the native device keychain/keystore
- Session storage only for browser-preview compatibility; native private keys never leave the device
- WebSocket real-time messaging remains a planned enhancement
- Expo Router for navigation
- NativeWind for styling
- TanStack Query for server data
- Database: MySQL with Drizzle ORM
- tRPC API for backend communication

## Typing Indicators
- [x] Persist partner typing state with an expiry to avoid stale indicators
- [x] Show a local typing state while composing and a partner-visible indicator in Chat
- [x] Add deterministic tests for typing-state expiry and cleanup
- [x] Validate the updated chat flow and create a release checkpoint


## Partner Connection Repair
- [x] Verify whether users 1 and 180001 exist and can form a partnership
- [x] Fix partner ID validation or connection persistence if needed
- [x] Validate the connection flow and create a release checkpoint


## Partner Management Controls
- [x] Add a confirmed disconnect action in Settings
- [x] Add reconnect guidance and refresh the partnership state after changes
- [x] Test disconnect/reconnect error handling and create a release checkpoint

## Release Debug Pass
- [x] Inspect release logs, runtime configuration, and active database schema
- [x] Repair release-blocking application, API, and authentication defects
- [x] Validate the core authenticated and unauthenticated flows
- [x] Create a publishable release checkpoint

## Message Delivery Receipts
- [x] Define member-safe sent, delivered, and read status transitions
- [x] Persist receipt timestamps and expose protected status mutations
- [x] Render accessible receipt indicators on outgoing chat messages
- [x] Add deterministic receipt-transition tests and release validation

## Failed Message Recovery
- [x] Preserve encrypted outgoing envelopes when a send fails
- [x] Render failed-message feedback and an accessible retry action
- [x] Verify retries do not duplicate successful messages
- [x] Add deterministic failure/retry tests and release validation

## Collaboration Reliability Repair
- [x] Diagnose and repair encryption-key publication so both partners can reach chat readiness without reopening the app
- [x] Refresh shared tasks automatically after remote task changes and local mutations
- [x] Replace mutual-ID connection setup with a recipient-approved partnership request flow
- [x] Add recipient approve and decline controls, with disconnect remaining available after approval
- [x] Add regression tests and validate the repaired partner collaboration flows

## Dual Connection Methods
- [x] Preserve manual partner-ID entry for sending a consent-based connection request
- [x] Generate a scannable QR connection code for the signed-in user
- [x] Add camera-based QR scanning that validates the code and sends the same request
- [x] Test both connection paths and save a publishable checkpoint

## Gallery QR Import
- [x] Add gallery-image selection as a camera-free QR connection method
- [x] Decode and validate a selected QR image before sending a consent-based request
- [x] Handle unavailable, cancelled, and invalid gallery selections clearly
- [x] Test the gallery QR parsing flow and save a publishable checkpoint

## Brand, Glass-Morphism, and Quality Pass
- [x] Replace application icon, splash, favicon, and in-app brand artwork with the supplied Partner Sync logo
- [x] Create a reusable, cross-platform, accessible glass surface and glass modal system
- [x] Redesign authenticated, Home, Chat, Tasks, Goals, and Settings screens with the glass visual language
- [x] Validate and repair functional, responsive, and visual issues across collaboration flows
- [x] Complete release checks and create a publishable checkpoint

## Checkpoint-Safe Brand Assets
- [x] Replace oversized logo artwork with the supplied compressed image and regenerate all launcher assets
- [x] Remove generated export artifacts from the checkpoint set
- [x] Revalidate and save the glass-morphism release checkpoint

## Encrypted Chat Reliability Repair
- [x] Reproduce the current chat failure using active partner and key state
- [x] Trace the SecureStore, key publication, and message API contracts end to end
- [x] Repair the actual initialization or delivery blocker without weakening encryption
- [x] Add regression coverage for the reproduced chat failure
- [ ] Validate both partners can initialize and exchange encrypted messages

## Encryption Diagnostics and Push Notifications
- [x] Add exact in-app encryption setup stages and context-specific recovery actions
- [x] Add privacy-preserving device push registration and persisted notification preferences
- [x] Notify the requester of approved connections and the recipient of new encrypted messages
- [x] Add recipient targeting, permission, idempotency, and diagnostic regression tests
- [x] Validate native bundling and complete release checks

## Push Notification Quiet Hours
- [x] Persist user quiet-hours preferences and safe recipient time-zone handling
- [x] Suppress recipient notification delivery during configured quiet hours
- [x] Add server-backed Settings controls for notification and quiet-hours preferences
- [x] Validate the quiet-hours release and create a publishable checkpoint

## Post-Restart Service Verification
- [x] Run the automated test suite after restarting development services
- [x] Inspect and report current service and health endpoint status

## Release Quality Audit
- [x] Audit client, API, database, notification, and Android bundle paths for reproducible defects
- [x] Repair Expo SDK dependency mismatches and revalidate TypeScript, tests, lint, server build, Android export, and service health
- [x] Verify Android registration details and create a release checkpoint
- [ ] Review upstream Expo tooling advisories reported by `pnpm audit` when the next compatible SDK update is available

## Firebase Android Configuration
- [x] Validate the supplied `google-services.json` against the Android package identifier
- [x] Configure the Expo Android build to include the supplied Firebase configuration
- [x] Validate the Android configuration and save a release checkpoint

## Firebase Backend Migration Assessment
- [x] Map the current MySQL/Drizzle, tRPC, authentication, and notification dependencies to Firebase services
- [x] Design Firestore collections, security rules, and a staged data migration with no destructive source changes
- [x] Obtain approval before implementing any Firebase backend replacement

## Firebase Full Backend Rewrite
- [ ] Provision the permanent Cloud Firestore database in `asia-south1` (Mumbai) with production-safe access controls
- [ ] Verify Firestore, Firebase Authentication, and Firebase web-client configuration prerequisites
- [ ] Initialize Firebase Authentication and enable the approved Email/Password provider
- [ ] Register the Firebase web client and add its public configuration through project-managed environment variables
- [ ] Link Firebase Authentication user IDs to Firestore profile and partnership records through enforced Security Rules
- [ ] Add Firebase Authentication and Firestore client foundations with secure environment configuration
- [ ] Replace Manus OAuth and MySQL/tRPC collaboration reads and writes with Firebase Auth and Firestore flows
- [ ] Add partner-scoped Firestore Security Rules, indexes, data migration tooling, and trusted push dispatch
- [ ] Validate encrypted chat, tasks, goals, connection approval, quiet hours, and Android production export
- [ ] Complete controlled cutover and save a rollback-ready checkpoint

## Firebase Full Backend Rewrite Execution
- [ ] Publish and verify partner-scoped Firestore rules and composite indexes in the Firebase project
- [x] Migrate the authenticated home and partner-connection experience to Firebase Auth and Firestore
- [x] Migrate encrypted chat, delivery receipts, and typing indicators to Firestore real-time listeners
- [x] Migrate shared task and goal collaboration to Firestore real-time listeners
- [x] Migrate notification preferences and partner controls in Settings to Firestore
- [x] Remove legacy authentication usage from the application root and validate the Firebase-only client flow
- [x] Run TypeScript, unit, lint, and Android-export validation before saving the Firebase cutover checkpoint
- [ ] Grant Firebase CLI deployment access to the owner account or publish the reviewed Firestore rules in the Firebase Console

## Preview and Packaging Handoff
- [x] Verify the latest Firebase migration checkpoint in the live web preview
- [x] Provide the managed Android packaging handoff and preview link
- [x] Repair the Metro `tslib.default` Firebase runtime compatibility error and re-verify the live preview
- [x] Constrain Metro bundling resources so the Firebase-enabled preview does not exit with code 137

## Firebase Cloud Messaging on Spark
- [ ] Add a protected backend FCM HTTP v1 relay using a securely stored Firebase service-account credential
- [ ] Register native Android FCM tokens instead of Expo push tokens and retain route-only notification payloads
- [ ] Notify recipients for approved partner requests and new encrypted messages through the protected relay
- [ ] Preserve quiet-hours suppression, delivery idempotency, and encrypted-message privacy in FCM dispatch
- [ ] Validate FCM configuration, Android bundle compatibility, and protected relay behavior

## GitHub Handoff
- [ ] Push the current Firebase, preview-stability, and FCM-preparation work to the PartnerSync repository without any credentials
