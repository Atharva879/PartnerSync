import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { firebaseDb } from "@/lib/firebase";
import {
  createFirebaseConnectionCode,
  createPartnershipId,
  type FirebaseEncryptedMessage,
  type FirebaseGoal,
  type FirebasePartnership,
  type FirebaseNotificationPreferences,
  type FirebaseTask,
  type FirebaseUserProfile,
} from "@/shared/firebase-schema";

export const FIREBASE_COLLECTIONS = {
  users: "users",
  connectionCodes: "connectionCodes",
  partnerships: "partnerships",
  messages: "messages",
  tasks: "tasks",
  goals: "goals",
  notificationPreferences: "notificationPreferences",
  devices: "devices",
} as const;

export const DEFAULT_FIREBASE_NOTIFICATION_PREFERENCES: FirebaseNotificationPreferences = {
  notificationsEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: 22,
  quietHoursEnd: 8,
  timezone: "UTC",
};

/** Creates an identity document once, preserving profile data on subsequent sign-ins. */
export async function ensureFirebaseUserProfile(user: User): Promise<FirebaseUserProfile> {
  const profileRef = doc(firebaseDb, FIREBASE_COLLECTIONS.users, user.uid);
  const existing = await getDoc(profileRef);
  if (existing.exists()) {
    const profile = existing.data() as FirebaseUserProfile;
    await setDoc(
      doc(firebaseDb, FIREBASE_COLLECTIONS.connectionCodes, profile.connectionCode),
      { uid: user.uid, createdAt: serverTimestamp() },
      { merge: true },
    );
    return profile;
  }

  const profile: FirebaseUserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName ?? user.email?.split("@")[0] ?? "Partner",
    connectionCode: createFirebaseConnectionCode(user.uid),
  };

  await setDoc(profileRef, {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(firebaseDb, FIREBASE_COLLECTIONS.connectionCodes, profile.connectionCode), {
    uid: user.uid,
    createdAt: serverTimestamp(),
  });
  return profile;
}

/** Loads the authenticated user’s profile without ever exposing a third-party profile to arbitrary clients. */
export async function getFirebaseUserProfile(uid: string) {
  const profile = await getDoc(doc(firebaseDb, FIREBASE_COLLECTIONS.users, uid));
  return profile.exists() ? (profile.data() as FirebaseUserProfile) : null;
}

/** Resolves a QR/manual code without exposing user profiles to collection searches. */
export async function resolveFirebaseConnectionCode(connectionCode: string): Promise<string> {
  const candidate = connectionCode.trim();
  if (!candidate.startsWith("PSF1:")) {
    throw new Error("This is not a valid Partner Sync connection code.");
  }
  const lookup = await getDoc(doc(firebaseDb, FIREBASE_COLLECTIONS.connectionCodes, candidate));
  const uid = lookup.exists() ? (lookup.data().uid as string | undefined) : undefined;
  if (!uid) throw new Error("This Partner Sync connection code was not found.");
  return uid;
}

export function subscribeToFirebaseProfile(
  uid: string,
  onChange: (profile: FirebaseUserProfile | null) => void,
): Unsubscribe {
  return onSnapshot(doc(firebaseDb, FIREBASE_COLLECTIONS.users, uid), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data() as FirebaseUserProfile) : null);
  });
}

export function subscribeToMyPartnerships(
  uid: string,
  onChange: (partnerships: FirebasePartnership[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(firebaseDb, FIREBASE_COLLECTIONS.partnerships), where("participantIds", "array-contains", uid)),
    (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<FirebasePartnership, "id">) }))),
    (error) => onError?.(error),
  );
}

export async function createFirebasePartnershipRequest(requesterId: string, recipientId: string) {
  if (!recipientId || requesterId === recipientId) {
    throw new Error("Choose a different Partner Sync connection code.");
  }
  const partnershipId = createPartnershipId(requesterId, recipientId);
  const partnershipRef = doc(firebaseDb, FIREBASE_COLLECTIONS.partnerships, partnershipId);
  await runTransaction(firebaseDb, async (transaction) => {
    const existing = await transaction.get(partnershipRef);
    if (existing.exists()) {
      const current = existing.data() as FirebasePartnership;
      if (current.status === "active") throw new Error("You are already connected with this partner.");
      if (current.status === "pending") throw new Error("A connection request is already waiting for approval.");
    }
    transaction.set(partnershipRef, {
      participantIds: [requesterId, recipientId].sort(),
      requesterId,
      recipientId,
      status: "pending",
      requesterPublicKey: null,
      recipientPublicKey: null,
      requesterTypingUntil: null,
      recipientTypingUntil: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
  return partnershipId;
}

export async function updateFirebasePartnershipStatus(partnershipId: string, status: FirebasePartnership["status"]) {
  await updateDoc(doc(firebaseDb, FIREBASE_COLLECTIONS.partnerships, partnershipId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function updateFirebasePartnership(
  partnershipId: string,
  changes: Partial<Pick<FirebasePartnership, "requesterPublicKey" | "recipientPublicKey" | "requesterTypingUntil" | "recipientTypingUntil">>,
) {
  await updateDoc(doc(firebaseDb, FIREBASE_COLLECTIONS.partnerships, partnershipId), {
    ...changes,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToFirebaseTasks(
  partnershipId: string,
  onChange: (tasks: FirebaseTask[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(firebaseDb, FIREBASE_COLLECTIONS.partnerships, partnershipId, FIREBASE_COLLECTIONS.tasks), orderBy("createdAt", "desc")),
    (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<FirebaseTask, "id">) }))),
    (error) => onError?.(error),
  );
}

export async function createFirebaseTask(partnershipId: string, userId: string, title: string, priority: FirebaseTask["priority"]) {
  await addDoc(collection(firebaseDb, FIREBASE_COLLECTIONS.partnerships, partnershipId, FIREBASE_COLLECTIONS.tasks), {
    createdBy: userId,
    title: title.trim(),
    priority,
    completed: false,
    completedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateFirebaseTask(partnershipId: string, taskId: string, changes: Partial<Pick<FirebaseTask, "completed" | "title" | "priority" | "completedBy">>) {
  await updateDoc(doc(firebaseDb, FIREBASE_COLLECTIONS.partnerships, partnershipId, FIREBASE_COLLECTIONS.tasks, taskId), {
    ...changes,
    completedAt: changes.completed ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFirebaseTask(partnershipId: string, taskId: string) {
  await deleteDoc(doc(firebaseDb, FIREBASE_COLLECTIONS.partnerships, partnershipId, FIREBASE_COLLECTIONS.tasks, taskId));
}

export function subscribeToFirebaseGoals(
  partnershipId: string,
  onChange: (goals: FirebaseGoal[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(firebaseDb, FIREBASE_COLLECTIONS.partnerships, partnershipId, FIREBASE_COLLECTIONS.goals), orderBy("createdAt", "desc")),
    (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<FirebaseGoal, "id">) }))),
    (error) => onError?.(error),
  );
}

export async function createFirebaseGoal(partnershipId: string, goal: Pick<FirebaseGoal, "title" | "targetRate" | "description">) {
  await addDoc(collection(firebaseDb, FIREBASE_COLLECTIONS.partnerships, partnershipId, FIREBASE_COLLECTIONS.goals), {
    ...goal,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateFirebaseGoal(
  partnershipId: string,
  goalId: string,
  changes: Partial<Pick<FirebaseGoal, "title" | "targetRate" | "description">>,
) {
  await updateDoc(doc(firebaseDb, FIREBASE_COLLECTIONS.partnerships, partnershipId, FIREBASE_COLLECTIONS.goals, goalId), {
    ...changes,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteFirebaseGoal(partnershipId: string, goalId: string) {
  await deleteDoc(doc(firebaseDb, FIREBASE_COLLECTIONS.partnerships, partnershipId, FIREBASE_COLLECTIONS.goals, goalId));
}

export function subscribeToFirebaseMessages(
  partnershipId: string,
  onChange: (messages: FirebaseEncryptedMessage[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(firebaseDb, FIREBASE_COLLECTIONS.partnerships, partnershipId, FIREBASE_COLLECTIONS.messages), orderBy("createdAt", "asc")),
    (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<FirebaseEncryptedMessage, "id">) }))),
    (error) => onError?.(error),
  );
}

export async function createFirebaseEncryptedMessage(
  partnershipId: string,
  message: Omit<FirebaseEncryptedMessage, "id" | "createdAt">,
) {
  await setDoc(doc(firebaseDb, FIREBASE_COLLECTIONS.partnerships, partnershipId, FIREBASE_COLLECTIONS.messages, message.clientMessageId), {
    ...message,
    createdAt: serverTimestamp(),
  });
}

export async function updateFirebaseMessageReceipt(
  partnershipId: string,
  messageId: string,
  status: Extract<FirebaseEncryptedMessage["status"], "delivered" | "read">,
) {
  await updateDoc(doc(firebaseDb, FIREBASE_COLLECTIONS.partnerships, partnershipId, FIREBASE_COLLECTIONS.messages, messageId), {
    status,
    ...(status === "read" ? { readAt: serverTimestamp() } : { deliveredAt: serverTimestamp() }),
  });
}

export function subscribeToFirebaseNotificationPreferences(
  uid: string,
  onChange: (preferences: FirebaseNotificationPreferences) => void,
): Unsubscribe {
  return onSnapshot(doc(firebaseDb, FIREBASE_COLLECTIONS.users, uid, "notificationPreferences", "default"), (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data() as FirebaseNotificationPreferences) : DEFAULT_FIREBASE_NOTIFICATION_PREFERENCES);
  });
}

export async function saveFirebaseNotificationPreferences(uid: string, preferences: FirebaseNotificationPreferences) {
  await setDoc(
    doc(firebaseDb, FIREBASE_COLLECTIONS.users, uid, "notificationPreferences", "default"),
    { ...preferences, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/** Stores a device token only beneath its authenticated Firebase owner. */
export async function saveFirebaseDeviceRegistration(
  uid: string,
  token: string,
  platform: "ios" | "android",
) {
  await setDoc(
    doc(firebaseDb, FIREBASE_COLLECTIONS.users, uid, "devices", token),
    { token, platform, enabled: true, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
