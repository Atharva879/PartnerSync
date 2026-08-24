# Firebase Cloud Messaging Implementation Research

## Official findings

- FCM HTTP v1 sends to specific device registration tokens and requires server-side authorization with Application Default Credentials, a service-account JSON file, or a short-lived OAuth 2.0 token. Credentials must not ship in the mobile client. [Firebase FCM HTTP v1 API](https://firebase.google.com/docs/cloud-messaging/send/v1-api)
- Cloud Firestore document-created triggers can react to writes such as a partnership approval or encrypted-message record, allowing trusted server-side notification dispatch without client changes. Function and Firestore locations should be selected close together to reduce latency. [Cloud Firestore triggers](https://firebase.google.com/docs/functions/firestore-events)
- Firebase Cloud Messaging is a no-cost Firebase product. Cloud Functions requires the Blaze pricing plan, with a no-cost usage quota followed by pay-as-you-go charges. [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)

## Architecture implication

Partner Sync should store native Android FCM registration tokens in the authenticated user profile, and a trusted server-side function or server endpoint should send generic notification payloads after approved partnership or encrypted-message events. Message text, sender identity, cryptographic keys, and ciphertext must not appear in notification payloads.
