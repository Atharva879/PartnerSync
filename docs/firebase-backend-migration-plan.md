# Partner Sync: Firebase Backend Migration Plan

**Status:** Planning only. No production database records, authentication flows, or encryption keys have been changed.

## Executive Recommendation

Partner Sync can move its application data from MySQL/Drizzle to **Cloud Firestore** while retaining the current Expo client, Manus OAuth session, tRPC API, server-side Expo push dispatch, and TweetNaCl end-to-end encryption. This **hybrid database migration** is the recommended first release because it removes MySQL from the application data path without forcing every partner to create a new account or requiring a high-risk rewrite of the encrypted chat and notification stack.

> The previously added `google-services.json` only identifies the Android build to Firebase. It does **not** connect the application to Firestore, migrate data, or replace its existing backend.

| Option | Scope | Benefits | Important trade-offs | Recommendation |
|---|---|---|---|---|
| **A. Firestore behind the existing API** | Replace Drizzle/MySQL repositories with Firestore Admin SDK repositories; retain current OAuth, tRPC, and push service. | Preserves account IDs, partner relationships, E2E key lifecycle, current routes, and rollback capability. | The application server remains in place for authentication and notification dispatch. | **Recommended first migration.** |
| **B. Full Firebase rewrite** | Replace MySQL, tRPC server, Manus OAuth, and push backend with Firestore, Firebase Auth, Security Rules, and Cloud Functions. | The mobile client communicates directly with Firebase services. | Requires new sign-in flows, account mapping, rules testing, server-trigger redesign, and a riskier encrypted-data migration. | Consider only after Option A is stable. |

The Firebase JavaScript SDK supports Firestore, Authentication, Realtime Database, and Storage for Expo apps, while native Firebase modules require a development build rather than Expo Go. [1] Firestore mobile client requests are checked against Security Rules, and authenticated, least-privilege rules are required for production. [2]

## Current-to-Firebase Architecture Map

| Current responsibility | Current implementation | Firebase migration in Option A | Firebase migration in Option B |
|---|---|---|---|
| User identity | Manus OAuth session and `users` table | Keep unchanged; use existing numeric user ID as Firestore document ID. | Firebase Authentication UID replaces session identity; requires an account-linking migration. |
| User profile | MySQL `users` table | `users/{userId}` document. | `users/{firebaseUid}` document with legacy-ID mapping during transition. |
| Partner connection | MySQL `partnerships` table and protected tRPC mutations | `partnerships/{partnershipId}` document; retain current protected route behavior. | Direct client writes or callable function guarded by Firebase Auth and Security Rules. |
| Encrypted messages | MySQL `messages` table | `partnerships/{id}/messages/{messageId}` subcollection containing ciphertext envelopes only. | Same Firestore structure with partner-membership rules. |
| Shared tasks | MySQL `tasks` table | `partnerships/{id}/tasks/{taskId}` subcollection. | Same structure with partner-membership rules. |
| Goals | MySQL `goals` table | `partnerships/{id}/goals/{goalId}` subcollection. | Same structure with partner-membership rules. |
| Device tokens | MySQL `devicePushTokens` table | `users/{userId}/devices/{tokenHash}` documents; retain server dispatch. | Same documents; dispatch via trusted Cloud Function. |
| Notification settings | MySQL `notificationPreferences` table | `users/{userId}/notificationPreferences/default`. | Same document; rules limit access to the owner. |
| Delivery deduplication | MySQL `notificationDeliveries` table | `notificationDeliveries/{deliveryKey}` document written by the trusted server. | Same document written only by a trusted Cloud Function. |

## Recommended Firestore Data Model

The app should retain the existing numeric IDs as Firestore string document IDs during the first migration. This avoids breaking QR codes, connection requests, local retry records, or partner references.

```text
users/{userId}
  openId, name, email, loginMethod, createdAt, updatedAt, lastSignedIn

users/{userId}/devices/{tokenHash}
  expoPushToken, platform, enabled, createdAt, updatedAt

users/{userId}/notificationPreferences/default
  notificationsEnabled, quietHoursEnabled, quietHoursStart, quietHoursEnd, timezone

partnerships/{partnershipId}
  requesterId, recipientId, memberIds, status,
  requesterPublicKey, recipientPublicKey, createdAt, updatedAt

partnerships/{partnershipId}/messages/{clientMessageId}
  senderId, ciphertextForSender, ciphertextForRecipient,
  clientMessageId, deliveredAt, readAt, createdAt

partnerships/{partnershipId}/tasks/{taskId}
  title, priority, completed, createdBy, completedBy, createdAt, updatedAt

partnerships/{partnershipId}/goals/{goalId}
  title, targetValue, completedValue, createdBy, createdAt, updatedAt

notificationDeliveries/{deliveryKey}
  recipientId, type, status, createdAt, updatedAt
```

Encrypted message bodies remain **dual-envelope ciphertext**. Neither Firestore, Firebase Auth, nor any migration worker receives partner plaintext or private TweetNaCl keys.

## Security Model

### Option A: Trusted API Access

The recommended first version uses the Firebase Admin SDK only in the existing authenticated server. Firestore Security Rules should deny mobile/web client access because the client continues to use the existing tRPC API:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

The server uses Firebase service credentials and enforces the existing authorization checks. Firebase documents that server client libraries bypass Firestore Security Rules, so service credentials must remain server-only and receive narrowly scoped IAM permissions. [2]

### Option B: Direct Client Access

Only after Firebase Authentication is live should the app permit direct Firestore access. Rules must require authentication, verify that the requester is one of the two partnership members, prohibit writes to immutable author and member fields, and validate timestamps, status changes, and receipt transitions. Firebase Rules can implement access control and field validation for mobile/web requests. [2]

## Transactions, Idempotency, and Indexes

Firestore transactions should protect partnership approval, member validation, and monotonic read/delivery receipt changes. Firestore transactions atomically commit a set of document operations and retry under concurrent modification; transaction callbacks must therefore be side-effect-free. [3]

Message idempotency should use the existing `clientMessageId` as the Firestore message document ID. Retrying the same send then resolves to the same document rather than creating a duplicate. Send the generic Expo push alert **only after** the message write commits, and preserve the existing delivery-key deduplication document.

Create Firestore composite indexes before cutover for the routes that currently rely on relational filtering and ordering:

| Query | Required index concept |
|---|---|
| A user’s active/pending partnerships | `memberIds` array membership with `updatedAt` descending, or a denormalized `userPartnerships` index collection. |
| Partnership messages | Parent partnership subcollection with `createdAt` ascending/descending. |
| Open tasks by priority | Parent partnership subcollection with `completed` and `priority`, ordered by `createdAt`. |
| Goals by recent activity | Parent partnership subcollection ordered by `updatedAt`. |

## Safe Migration Sequence

| Stage | Work | Safety gate |
|---|---|---|
| 1. Prepare Firebase | Create a Firestore database in Native mode, select the location deliberately, and add a Firebase service-account credential only to server secrets. | No application reads or writes change. |
| 2. Add repository abstraction | Define interfaces for users, partnerships, messages, tasks, goals, push tokens, preferences, and delivery records; keep the MySQL implementation active. | Type-check and regression tests stay green. |
| 3. Add Firestore implementation | Implement server-side Firestore repositories and retain MySQL as the primary source. | Firestore rules deny all direct clients. |
| 4. Backfill safely | Run an idempotent read-only MySQL export and batched Firestore import; preserve IDs and convert dates to Firestore timestamps. | Compare per-collection counts and deterministic record checksums. |
| 5. Shadow verification | For a limited period, write Firestore in parallel and compare read results without changing the user-facing source of truth. | Do not duplicate push alerts; Firestore shadow writes must not trigger notifications. |
| 6. Controlled cutover | Change the repository feature flag to Firestore, retaining a MySQL rollback window and snapshot. | Verify encrypted chat, task sync, goals, connection approval, and quiet-hours suppression with two test users. |
| 7. Decommission | Retain an encrypted export for the agreed period, then disable MySQL writes and remove the MySQL implementation. | User acceptance and rollback window complete. |

## Authentication Decision

For Option A, no user login change is needed. The existing Manus OAuth identity remains the user identity sent to the server, and the server is the only process allowed to access Firestore.

For Option B, the app must adopt Firebase Authentication and map each existing account to a Firebase UID. This is a separate migration because Firestore Security Rules rely on Firebase Authentication for authenticated client access. [2] Firebase Auth supports email/password, phone, federated, custom, and anonymous sign-in patterns. [4]

## Required Inputs Before Implementation

Before code changes, confirm the following choices:

1. Choose **Option A** (recommended: Firestore database only, existing sign-in/server retained) or **Option B** (full Firebase rewrite).
2. Confirm the Firebase project’s Firestore database location after creating it; Firestore location selection should be treated as durable infrastructure choice.
3. For Option A, provide a service-account credential through the project’s secure configuration flow. It must never be committed to the repository or bundled in the mobile app.
4. Confirm whether existing MySQL data should be backfilled now or whether the Firebase database should start empty for new partner accounts.

## References

[1] [Expo — Using Firebase](https://docs.expo.dev/guides/using-firebase/)

[2] [Firebase — Get started with Cloud Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

[3] [Firebase — Transactions and batched writes](https://firebase.google.com/docs/firestore/manage-data/transactions)

[4] [Firebase — Authentication](https://firebase.google.com/docs/auth)
