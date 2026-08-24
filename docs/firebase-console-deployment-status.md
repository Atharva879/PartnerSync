# Firebase Console Deployment Status

**Recorded:** 19 August 2026

The Firebase account in console slot `u/3`—displayed as `atharvashandilya487@gmail.com`—can open the PartnerSync (`partnersync-24c94`) Firestore Rules editor at `https://console.firebase.google.com/u/3/project/partnersync-24c94/firestore/databases/-default-/security/rules`. The editor initially contained the default deny-all policy.

The reviewed partner-scoped policy from `firestore.rules` has been staged in that editor. The current console interface exposes a **Develop and Test** tutorial control rather than a visible **Publish** button, so it has not yet provided a verifiable publication result.

An earlier Firebase CLI attempt through Cloud Shell used a different Google account (`atharvashandilya16@gmail.com`) and failed with HTTP 403 because that account lacks `serviceusage.services.use` on `partnersync-24c94`. The project IAM page for that account also reported that it lacks access to view or modify project IAM.

A subsequent Cloud Shell session was provisioned under the Firebase-console account slot, but its Firebase CLI authentication flow was not completed with the project-owning Google account. The command reached `firebase deploy --only firestore:rules`, confirming that the local policy and Firebase CLI configuration are valid; the only observed failure is the missing Google Cloud project authorization.

No successful security-rule deployment has been observed yet. The local `firestore.rules` file remains the source of truth for the staged policy. To complete deployment, the Firebase project owner must either publish that policy in the Firestore Rules editor or sign in to Firebase CLI with the owner account and ensure it has `serviceusage.services.use` through the **Service Usage Consumer** role (or equivalent custom permission).
