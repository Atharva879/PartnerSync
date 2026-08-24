# Firebase Migration Research Notes

## Expo Integration

Expo documents two Firebase integration paths. The Firebase JavaScript SDK supports Authentication, Firestore, Realtime Database, and Storage in Expo Go and universal Android, iOS, and web apps. Expo recommends `firebase@12.0.0` or later for Expo SDK compatibility. React Native Firebase instead requires custom native code and a development build; it is appropriate when native-only products such as Analytics or Crashlytics are required.

Source: [Expo — Using Firebase](https://docs.expo.dev/guides/using-firebase/)

## Firestore Security

Cloud Firestore evaluates every mobile/web client request against Security Rules. Rules can require Firebase Authentication and validate document access and shape. Server Admin SDK clients bypass these rules, so server-side access must be protected with Google IAM. Production rules must avoid an unrestricted `allow read, write: if true` rule.

Source: [Firebase — Get started with Cloud Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

## Atomic Workflows

Firestore transactions atomically commit multi-document reads and writes, retry when concurrent edits occur, and can fail offline. They are suitable for partnership acceptance, idempotent message creation, and delivery/receipt transitions when client-side direct writes are selected.

Source: [Firebase — Transactions and batched writes](https://firebase.google.com/docs/firestore/manage-data/transactions)

## Authentication Boundary

Firebase Authentication can authenticate users with email/password, phone, federated providers, custom authentication, and anonymous accounts. It integrates with Firestore Security Rules, while a custom backend can verify Firebase ID tokens. The current app instead uses Manus OAuth and a custom JWT session, so the migration must either replace sign-in with Firebase Auth or retain a temporary trusted server bridge.

Source: [Firebase — Authentication](https://firebase.google.com/docs/auth)

## Confirmed Firebase Console State — 18 August 2026

- Firebase project **PartnerSync** (`partnersync-24c94`) is available in the authenticated Firebase Console.
- The Android registration matches Partner Sync’s package identifier: `com.app.partnerapp`.
- Firebase Authentication is active, with **Email/Password** enabled as the first supported sign-in method.
- Cloud Firestore is not yet provisioned. Its database location is selected during creation and cannot be changed afterward, so it requires an explicit user choice before the database is created. Production Security Rules must be applied before application data is migrated.
- The user approved the `asia-south1` (Mumbai) region. The Firebase creation wizard is using the Standard edition and the default Firestore database ID; the location selection is in progress.
- Firebase Console URL: `https://console.firebase.google.com/u/3/project/partnersync-24c94/firestore`. The location selector lists `asia-south1 (Mumbai)` and `asia-south2 (Delhi)`; neither has been committed yet.
- The Firestore creation wizard remains open. No database has been created and no permanent location has been committed.
- Firebase Authentication is initialized for PartnerSync and the Email/Password provider is enabled. The full rewrite can use Firebase Auth user IDs as the basis for Firestore Security Rules.
- The production Cloud Firestore default database is provisioned and ready in `asia-south1` (Mumbai). It currently has no application collections, so no existing Firebase data needs to be migrated before the Partner Sync schema is created.
- Firebase project settings confirm project ID `partnersync-24c94` and project number `237776814044`. The project currently has only the Android app (`com.app.partnerapp`), so an Expo-compatible Firebase web client must be registered to obtain the JavaScript SDK configuration for Firebase Auth and Firestore.
