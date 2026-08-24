import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FirebaseAuthNative from "@firebase/auth";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const requiredConfig = ["apiKey", "authDomain", "projectId", "appId"] as const;
const missingConfig = requiredConfig.filter((key) => !firebaseConfig[key]);

if (missingConfig.length > 0) {
  throw new Error(`Firebase configuration is incomplete: ${missingConfig.join(", ")}`);
}

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createFirebaseAuth(): Auth {
  if (Platform.OS === "web") {
    return getAuth(firebaseApp);
  }

  // Metro resolves @firebase/auth to its React Native entrypoint. Its public
  // firebase/auth wrapper does not expose this helper to TypeScript in v11.
  const getReactNativePersistence = (
    FirebaseAuthNative as unknown as {
      getReactNativePersistence: (storage: typeof AsyncStorage) => unknown;
    }
  ).getReactNativePersistence;

  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage) as never,
    });
  } catch {
    // Fast Refresh or a duplicate import can initialize the singleton first.
    return getAuth(firebaseApp);
  }
}

export const firebaseAuth = createFirebaseAuth();
export const firebaseDb = getFirestore(firebaseApp);

export const firebaseProjectId = firebaseConfig.projectId;
