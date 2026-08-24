# Firebase Console State

**Last reviewed:** 19 August 2026

| Item | Verified state |
| --- | --- |
| Firebase project | `partnersync-24c94` (PartnerSync) |
| Firestore database | `(default)` in `asia-south1` (Mumbai) |
| Authentication | Email/password provider enabled |
| Firestore rules | Partner-scoped policy staged in the Console after explicit user approval. The current Console interface has not exposed a publish control, so publication confirmation remains pending. |

The staged policy requires Firebase Authentication, restricts direct user-profile access to the owner, supports non-enumerable direct connection-code lookup, and limits collaboration documents to the two participants in a partnership. It is maintained locally in `firestore.rules`. The Console's **Develop and Test** control opens an unrelated tutorial, not a publication flow; no rule deployment was confirmed as of this review.
