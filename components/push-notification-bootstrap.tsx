import { useFirebaseAuth } from "@/hooks/use-firebase-auth";
import { saveFirebaseDeviceRegistration } from "@/lib/firebase-repository";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Registers only real iOS/Android devices. Message contents are never part of the token registration. */
export function PushNotificationBootstrap() {
  const { user } = useFirebaseAuth();
  const userId = user?.uid;

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route;
      if (typeof route === "string" && route.startsWith("/")) router.push(route as never);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!userId || Platform.OS === "web" || !Device.isDevice) return;
    let cancelled = false;
    const register = async () => {
      const existing = await Notifications.getPermissionsAsync();
      const permission = existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();
      if (permission.status !== "granted" || cancelled) return;
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      if (!token || cancelled) return;
      await saveFirebaseDeviceRegistration(userId, token, Platform.OS === "ios" ? "ios" : "android");
    };
    void register().catch((error) => console.warn("[Push] Registration unavailable", error));
    return () => { cancelled = true; };
  }, [userId]);

  return null;
}
