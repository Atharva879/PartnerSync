import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";

import { AuthRequired } from "@/components/auth-required";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenContainer } from "@/components/screen-container";
import { useFirebaseAuth } from "@/hooks/use-firebase-auth";
import { useFirebasePartnership } from "@/hooks/use-firebase-partnership";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  DEFAULT_FIREBASE_NOTIFICATION_PREFERENCES,
  createFirebasePartnershipRequest,
  saveFirebaseNotificationPreferences,
  subscribeToFirebaseNotificationPreferences,
  updateFirebasePartnershipStatus,
} from "@/lib/firebase-repository";
import { useThemeContext } from "@/lib/theme-provider";

export default function SettingsScreen() {
  const { user, loading: authLoading, logout } = useFirebaseAuth();
  const { activePartnership, incomingRequest, latestPartnership, loading: partnershipLoading, outgoingRequest } = useFirebasePartnership();
  const colors = useColors();
  const colorScheme = useColorScheme();
  const { setColorScheme } = useThemeContext();
  const [isDarkMode, setIsDarkMode] = useState(colorScheme === "dark");
  const [notifications, setNotifications] = useState(DEFAULT_FIREBASE_NOTIFICATION_PREFERENCES.notificationsEnabled);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(DEFAULT_FIREBASE_NOTIFICATION_PREFERENCES.quietHoursEnabled);
  const [quietHoursStart, setQuietHoursStart] = useState(DEFAULT_FIREBASE_NOTIFICATION_PREFERENCES.quietHoursStart);
  const [quietHoursEnd, setQuietHoursEnd] = useState(DEFAULT_FIREBASE_NOTIFICATION_PREFERENCES.quietHoursEnd);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [partnerActionError, setPartnerActionError] = useState<string | null>(null);
  const [preferenceSaving, setPreferenceSaving] = useState(false);
  const [partnerActionLoading, setPartnerActionLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const timezone = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
  })();
  const partnership = activePartnership ?? incomingRequest ?? outgoingRequest ?? latestPartnership;
  const partnerId = partnership && user ? (partnership.requesterId === user.uid ? partnership.recipientId : partnership.requesterId) : null;
  const receivedRequest = Boolean(incomingRequest && incomingRequest.id === partnership?.id);

  useEffect(() => {
    if (!user) return;
    return subscribeToFirebaseNotificationPreferences(user.uid, (preferences) => {
      setNotifications(preferences.notificationsEnabled);
      setQuietHoursEnabled(preferences.quietHoursEnabled);
      setQuietHoursStart(preferences.quietHoursStart);
      setQuietHoursEnd(preferences.quietHoursEnd);
      setNotificationError(null);
    });
  }, [user]);

  const saveNotificationPreferences = async (next: { notificationsEnabled: boolean; quietHoursEnabled: boolean; quietHoursStart: number; quietHoursEnd: number }) => {
    if (!user) return;
    setNotificationError(null);
    setNotifications(next.notificationsEnabled);
    setQuietHoursEnabled(next.quietHoursEnabled);
    setQuietHoursStart(next.quietHoursStart);
    setQuietHoursEnd(next.quietHoursEnd);
    setPreferenceSaving(true);
    try {
      await saveFirebaseNotificationPreferences(user.uid, { ...next, timezone });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      setNotificationError("Unable to save notification preferences. Please try again.");
    } finally {
      setPreferenceSaving(false);
    }
  };

  const changeQuietHour = (field: "start" | "end", change: number) => {
    const current = field === "start" ? quietHoursStart : quietHoursEnd;
    const nextHour = (current + change + 24) % 24;
    void saveNotificationPreferences({ notificationsEnabled: notifications, quietHoursEnabled, quietHoursStart: field === "start" ? nextHour : quietHoursStart, quietHoursEnd: field === "end" ? nextHour : quietHoursEnd });
  };
  const formatHour = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

  const updateConnection = async (operation: () => Promise<unknown>, fallbackError: string) => {
    setPartnerActionError(null);
    setPartnerActionLoading(true);
    try {
      await operation();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setPartnerActionError(error instanceof Error ? error.message : fallbackError);
    } finally {
      setPartnerActionLoading(false);
    }
  };
  const handleDisconnect = () => {
    if (!activePartnership) return;
    Alert.alert("Disconnect partner?", "Shared chat, tasks, and goals will be hidden until a new request is approved. Your encrypted history will remain stored.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: () => void updateConnection(() => updateFirebasePartnershipStatus(activePartnership.id, "disconnected"), "Unable to disconnect partner.") },
    ]);
  };
  const handleReconnect = () => {
    if (!user || !partnerId) return;
    void updateConnection(() => createFirebasePartnershipRequest(user.uid, partnerId), "Unable to send reconnect request.");
  };
  const handleRequestResponse = (status: "active" | "disconnected") => {
    if (!incomingRequest) return;
    void updateConnection(() => updateFirebasePartnershipStatus(incomingRequest.id, status), "Unable to respond to this connection request.");
  };
  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setLogoutLoading(false);
    }
  };

  if (authLoading) return <ScreenContainer className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;
  if (!user) return <AuthRequired title="Sign in to manage settings" />;

  const connectionTitle = activePartnership ? "✓ Connected" : receivedRequest ? "Connection request received" : outgoingRequest ? "Request sent" : "○ Disconnected";
  const connectionDescription = activePartnership ? "Your shared space is available on both devices." : receivedRequest ? "Allow this request to start a private shared space, or decline it to keep your account disconnected." : outgoingRequest ? "Waiting for your partner to allow the connection request." : "Send a new request to ask your partner to reconnect.";

  return <ScreenContainer className="flex-1"><ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: 18 }} showsVerticalScrollIndicator={false}>
    <View className="mb-6"><Text className="text-lg font-bold text-foreground mb-4">Profile</Text><GlassSurface style={{ gap: 12, padding: 16 }}><View><Text className="text-xs text-muted mb-1">Name</Text><Text className="text-base font-medium text-foreground">{user.displayName || user.email?.split("@")[0] || "Partner"}</Text></View><View><Text className="text-xs text-muted mb-1">Email</Text><Text className="text-base font-medium text-foreground">{user.email || "Not provided"}</Text></View><View><Text className="text-xs text-muted mb-1">User ID</Text><Text className="text-xs font-mono text-muted">{user.uid}</Text></View></GlassSurface></View>
    {partnershipLoading ? <View className="mb-6"><ActivityIndicator size="small" color={colors.primary} /></View> : partnership ? <View className="mb-6"><Text className="text-lg font-bold text-foreground mb-4">Partner Connection</Text><View className={activePartnership ? "bg-success/10 border border-success rounded-lg p-4" : "bg-warning/10 border border-warning rounded-lg p-4"}><Text className={activePartnership ? "text-sm font-bold text-success mb-2" : "text-sm font-bold text-warning mb-2"}>{connectionTitle}</Text><Text className="text-xs text-muted">Partner ID: {partnerId}</Text><Text className="text-xs text-muted mt-1">{connectionDescription}</Text>{partnerActionError ? <Text className="text-xs text-error mt-3">{partnerActionError}</Text> : null}{activePartnership ? <TouchableOpacity onPress={handleDisconnect} disabled={partnerActionLoading} activeOpacity={0.7} className="mt-4 bg-error/10 border border-error rounded-lg p-3" style={{ opacity: partnerActionLoading ? 0.65 : 1 }}>{partnerActionLoading ? <ActivityIndicator size="small" color={colors.error} /> : <Text className="text-center font-semibold text-error">Disconnect Partner</Text>}</TouchableOpacity> : receivedRequest ? <View className="mt-4 flex-row gap-3"><TouchableOpacity onPress={() => handleRequestResponse("disconnected")} disabled={partnerActionLoading} activeOpacity={0.7} className="flex-1 bg-surface border border-border rounded-lg p-3" style={{ opacity: partnerActionLoading ? 0.65 : 1 }}><Text className="text-center font-semibold text-foreground">Decline</Text></TouchableOpacity><TouchableOpacity onPress={() => handleRequestResponse("active")} disabled={partnerActionLoading} activeOpacity={0.7} className="flex-1 bg-primary rounded-lg p-3" style={{ opacity: partnerActionLoading ? 0.65 : 1 }}>{partnerActionLoading ? <ActivityIndicator size="small" color={colors.background} /> : <Text className="text-center font-semibold text-background">Allow</Text>}</TouchableOpacity></View> : outgoingRequest ? null : <TouchableOpacity onPress={handleReconnect} disabled={partnerActionLoading} activeOpacity={0.7} className="mt-4 bg-primary rounded-lg p-3" style={{ opacity: partnerActionLoading ? 0.65 : 1 }}>{partnerActionLoading ? <ActivityIndicator size="small" color={colors.background} /> : <Text className="text-center font-semibold text-background">Send Reconnect Request</Text>}</TouchableOpacity>}</View></View> : <View className="mb-6"><Text className="text-lg font-bold text-foreground mb-4">Partner Connection</Text><View className="bg-warning/10 border border-warning rounded-lg p-4"><Text className="text-sm font-medium text-foreground mb-2">No Partner Connected</Text><Text className="text-xs text-muted">Connect with a partner from Home to use the shared features.</Text></View></View>}
    <View className="mb-6"><Text className="text-lg font-bold text-foreground mb-4">Preferences</Text><View className="bg-surface rounded-lg overflow-hidden"><View className="flex-row items-center justify-between p-4 border-b border-border"><Text className="text-base font-medium text-foreground">Dark Mode</Text><Switch value={isDarkMode} onValueChange={(value) => { setIsDarkMode(value); setColorScheme(value ? "dark" : "light"); }} trackColor={{ false: colors.border, true: colors.primary }} /></View><View className="p-4 border-b border-border"><View className="flex-row items-center justify-between"><View className="flex-1 pr-4"><Text className="text-base font-medium text-foreground">Notifications</Text><Text className="text-xs text-muted mt-1">Connection approvals and new-message alerts never include message text.</Text></View><Switch value={notifications} onValueChange={(enabled) => void saveNotificationPreferences({ notificationsEnabled: enabled, quietHoursEnabled, quietHoursStart, quietHoursEnd })} disabled={preferenceSaving} trackColor={{ false: colors.border, true: colors.primary }} /></View>{notificationError ? <Text className="text-xs text-error mt-3">{notificationError}</Text> : null}</View><View className="p-4"><View className="flex-row items-center justify-between"><View className="flex-1 pr-4"><Text className="text-base font-medium text-foreground">Quiet Hours</Text><Text className="text-xs text-muted mt-1">Mute push alerts on this account during your chosen local times.</Text></View><Switch value={quietHoursEnabled} onValueChange={(enabled) => void saveNotificationPreferences({ notificationsEnabled: notifications, quietHoursEnabled: enabled, quietHoursStart, quietHoursEnd })} disabled={!notifications || preferenceSaving} trackColor={{ false: colors.border, true: colors.primary }} /></View>{quietHoursEnabled && notifications ? <View className="mt-4 gap-3"><Text className="text-xs text-muted">Times are saved in your device timezone ({timezone}).</Text><View className="flex-row items-center justify-between rounded-lg bg-background/40 px-3 py-2"><Text className="text-sm font-medium text-foreground">Start</Text><View className="flex-row items-center gap-2"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Make quiet hours start one hour earlier" onPress={() => changeQuietHour("start", -1)} disabled={preferenceSaving} className="h-9 w-9 items-center justify-center rounded-full bg-surface border border-border"><Text className="text-xl text-foreground">−</Text></TouchableOpacity><Text className="w-12 text-center text-base font-semibold text-foreground">{formatHour(quietHoursStart)}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Make quiet hours start one hour later" onPress={() => changeQuietHour("start", 1)} disabled={preferenceSaving} className="h-9 w-9 items-center justify-center rounded-full bg-surface border border-border"><Text className="text-xl text-foreground">+</Text></TouchableOpacity></View></View><View className="flex-row items-center justify-between rounded-lg bg-background/40 px-3 py-2"><Text className="text-sm font-medium text-foreground">End</Text><View className="flex-row items-center gap-2"><TouchableOpacity accessibilityRole="button" accessibilityLabel="Make quiet hours end one hour earlier" onPress={() => changeQuietHour("end", -1)} disabled={preferenceSaving} className="h-9 w-9 items-center justify-center rounded-full bg-surface border border-border"><Text className="text-xl text-foreground">−</Text></TouchableOpacity><Text className="w-12 text-center text-base font-semibold text-foreground">{formatHour(quietHoursEnd)}</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel="Make quiet hours end one hour later" onPress={() => changeQuietHour("end", 1)} disabled={preferenceSaving} className="h-9 w-9 items-center justify-center rounded-full bg-surface border border-border"><Text className="text-xl text-foreground">+</Text></TouchableOpacity></View></View></View> : null}</View></View></View>
    <View className="mb-6"><Text className="text-lg font-bold text-foreground mb-4">About</Text><View className="bg-surface rounded-lg p-4 gap-3"><View className="flex-row items-center justify-between"><Text className="text-sm text-muted">App Version</Text><Text className="text-sm font-medium text-foreground">1.0.0</Text></View><View className="flex-row items-center justify-between"><Text className="text-sm text-muted">Build</Text><Text className="text-sm font-medium text-foreground">1</Text></View><View className="pt-2 border-t border-border"><Text className="text-xs text-muted leading-relaxed">Partner Sync is a secure communication and task management app for couples and partners.</Text></View></View></View>
    <View className="mb-6"><Text className="text-lg font-bold text-foreground mb-4">Security</Text><View className="bg-surface rounded-lg p-4"><View className="flex-row items-start gap-3"><View className="flex-1"><Text className="text-sm font-medium text-foreground mb-1">End-to-End Encryption</Text><Text className="text-xs text-muted">All messages are encrypted with TweetNaCl.js</Text></View><View className="bg-success/20 px-2 py-1 rounded"><Text className="text-xs font-bold text-success">Active</Text></View></View></View></View>
    <TouchableOpacity onPress={() => void handleLogout()} disabled={logoutLoading} activeOpacity={0.7} className="bg-error/10 border border-error rounded-lg p-4 mb-6">{logoutLoading ? <ActivityIndicator size="small" color={colors.error} /> : <Text className="text-center font-semibold text-error">Logout</Text>}</TouchableOpacity><View className="items-center py-4 border-t border-border"><Text className="text-xs text-muted">Made with care for partners</Text></View>
  </ScrollView></ScreenContainer>;
}
