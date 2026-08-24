import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export class DeviceKeyStorageError extends Error {
  constructor(message = "Secure device storage is unavailable.") {
    super(message);
    this.name = "DeviceKeyStorageError";
  }
}

async function ensureSecureStoreAvailable(): Promise<void> {
  try {
    if (!(await SecureStore.isAvailableAsync())) {
      throw new DeviceKeyStorageError();
    }
  } catch (error) {
    if (error instanceof DeviceKeyStorageError) throw error;
    throw new DeviceKeyStorageError();
  }
}

/**
 * Stores private chat keys on the device. Native builds use the platform
 * keychain/keystore; the web preview uses session storage solely for preview
 * compatibility and must not be treated as a secure messaging client.
 */
export const secureKeyStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") {
      return typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(key);
    }
    await ensureSecureStoreAvailable();
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      throw new DeviceKeyStorageError();
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(key, value);
      return;
    }
    await ensureSecureStoreAvailable();
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      throw new DeviceKeyStorageError();
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key);
      return;
    }
    await ensureSecureStoreAvailable();
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      throw new DeviceKeyStorageError();
    }
  },
};
