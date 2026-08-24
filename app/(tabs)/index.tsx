import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Camera, CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import QRCode from "qrcode";

import { AuthRequired } from "@/components/auth-required";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenContainer } from "@/components/screen-container";
import { useFirebaseAuth } from "@/hooks/use-firebase-auth";
import { useFirebasePartnership } from "@/hooks/use-firebase-partnership";
import { useColors } from "@/hooks/use-colors";
import {
  createFirebasePartnershipRequest,
  resolveFirebaseConnectionCode,
  subscribeToFirebaseMessages,
  subscribeToFirebaseTasks,
  updateFirebasePartnershipStatus,
} from "@/lib/firebase-repository";
import { createFirebaseConnectionCode, type FirebaseEncryptedMessage, type FirebaseTask } from "@/shared/firebase-schema";

export default function HomeScreen() {
  const { user, loading: authLoading } = useFirebaseAuth();
  const { activePartnership, error: partnershipError, incomingRequest, loading: partnershipLoading, outgoingRequest } = useFirebasePartnership();
  const colors = useColors();
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showMyQrModal, setShowMyQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [partnerCode, setPartnerCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [qrDataUri, setQrDataUri] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [isImportingQr, setIsImportingQr] = useState(false);
  const [messages, setMessages] = useState<FirebaseEncryptedMessage[]>([]);
  const [tasks, setTasks] = useState<FirebaseTask[]>([]);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    if (!activePartnership) {
      setMessages([]);
      setTasks([]);
      return;
    }

    const unsubscribeMessages = subscribeToFirebaseMessages(activePartnership.id, setMessages);
    const unsubscribeTasks = subscribeToFirebaseTasks(activePartnership.id, setTasks);
    return () => {
      unsubscribeMessages();
      unsubscribeTasks();
    };
  }, [activePartnership]);

  const completedTaskCount = tasks.filter((task) => task.completed).length;
  const completionRate = tasks.length ? Math.round((completedTaskCount / tasks.length) * 100) : 0;
  const connectionCode = user ? createFirebaseConnectionCode(user.uid) : "";

  const sendConnectionRequest = async (rawCode: string) => {
    if (!user) return;
    const normalizedCode = rawCode.trim();
    if (!normalizedCode) {
      setConnectionError("Enter your partner's connection code or scan their QR.");
      return;
    }

    setLoading(true);
    setConnectionError(null);
    try {
      const recipientId = await resolveFirebaseConnectionCode(normalizedCode);
      await createFirebasePartnershipRequest(user.uid, recipientId);
      setPartnerCode("");
      setShowPartnerModal(false);
      setShowScannerModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Unable to send that connection request.");
    } finally {
      setLoading(false);
    }
  };

  const respondToRequest = async (approved: boolean) => {
    if (!incomingRequest) return;
    setLoading(true);
    setConnectionError(null);
    try {
      await updateFirebasePartnershipStatus(incomingRequest.id, approved ? "active" : "disconnected");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Unable to update the connection request.");
    } finally {
      setLoading(false);
    }
  };

  const handleQrScanned = ({ data }: BarcodeScanningResult) => {
    if (hasScanned || loading) return;
    setHasScanned(true);
    void sendConnectionRequest(data);
  };

  const openScanner = () => {
    setConnectionError(null);
    setHasScanned(false);
    setShowScannerModal(true);
  };

  const importQrFromGallery = async () => {
    setConnectionError(null);
    setIsImportingQr(true);
    try {
      const selection = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      if (selection.canceled || !selection.assets[0]?.uri) return;
      const codes = await Camera.scanFromURLAsync(selection.assets[0].uri, ["qr"]);
      if (!codes[0]?.data) {
        setConnectionError("No Partner Sync connection QR code was found in that image.");
        return;
      }
      await sendConnectionRequest(codes[0].data);
    } catch (error) {
      console.error("Unable to read QR code from gallery image:", error);
      setConnectionError("We could not read that image. Choose a clear QR image or enter the connection code instead.");
    } finally {
      setIsImportingQr(false);
    }
  };

  const openMyQr = () => {
    if (!connectionCode) return;
    setQrDataUri(null);
    setQrError(null);
    setShowMyQrModal(true);
    void QRCode.toDataURL(connectionCode, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 720,
      color: { dark: "#11181C", light: "#FFFFFF" },
    })
      .then(setQrDataUri)
      .catch(() => setQrError("Unable to create your QR code. Please share the connection code instead."));
  };

  if (authLoading) {
    return <ScreenContainer className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;
  }

  if (!user) return <AuthRequired title="Welcome to Partner Sync" description="Sign in to create your private shared space." />;

  return (
    <ScreenContainer className="flex-1">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <GlassSurface tone="strong" intensity={30} style={styles.homeHeader}>
          <View className="flex-row items-center gap-3">
            <Image source={require("../../assets/images/icon.png")} style={styles.headerMark} accessibilityLabel="Partner Sync" />
            <View className="flex-1">
              <Text className="text-3xl font-bold text-foreground mb-1">Welcome, {user.displayName?.split(" ")[0] || user.email?.split("@")[0] || "Partner"}!</Text>
              <Text className="text-base text-muted">Stay connected and organized together</Text>
            </View>
          </View>
        </GlassSurface>

        {partnershipLoading ? (
          <View className="bg-surface rounded-2xl p-6 mb-6 items-center"><ActivityIndicator size="small" color={colors.primary} /></View>
        ) : activePartnership ? (
          <View className="bg-success/10 border-2 border-success rounded-2xl p-6 mb-6">
            <View className="flex-row items-center gap-3 mb-3"><Text className="text-3xl">✓</Text><Text className="text-lg font-bold text-success">Partner Connected</Text></View>
            <Text className="text-sm text-foreground">Your private shared space is ready for encrypted chat, tasks, and goals.</Text>
          </View>
        ) : incomingRequest ? (
          <View className="bg-primary/10 border-2 border-primary rounded-2xl p-6 mb-6">
            <Text className="text-lg font-bold text-foreground mb-2">Partner Request</Text>
            <Text className="text-sm text-foreground mb-4">A Partner Sync user wants to create a private shared space with you.</Text>
            {connectionError ? <Text className="mb-3 text-sm text-error">{connectionError}</Text> : null}
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => void respondToRequest(false)} disabled={loading} activeOpacity={0.75} className="flex-1 bg-surface border border-border py-3 rounded-lg"><Text className="text-center font-semibold text-foreground">Decline</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => void respondToRequest(true)} disabled={loading} activeOpacity={0.75} className="flex-1 bg-primary py-3 rounded-lg">{loading ? <ActivityIndicator size="small" color={colors.background} /> : <Text className="text-center font-semibold text-background">Allow</Text>}</TouchableOpacity>
            </View>
          </View>
        ) : outgoingRequest ? (
          <View className="bg-warning/10 border-2 border-warning rounded-2xl p-6 mb-6"><Text className="text-lg font-bold text-warning mb-2">Request Sent</Text><Text className="text-sm text-foreground">Waiting for your partner to allow the connection. This screen updates automatically.</Text></View>
        ) : (
          <View className="bg-warning/10 border-2 border-warning rounded-2xl p-6 mb-6">
            <View className="flex-row items-center gap-3 mb-3"><Text className="text-3xl">!</Text><Text className="text-lg font-bold text-warning">No Partner Connected</Text></View>
            <Text className="text-sm text-foreground mb-4">Connect with your partner to unlock all features.</Text>
            {partnershipError ? <Text className="mb-3 text-sm text-error">{partnershipError}</Text> : null}
            <View className="gap-3">
              <TouchableOpacity onPress={() => setShowPartnerModal(true)} activeOpacity={0.8} className="bg-primary p-3 rounded-lg"><Text className="text-center font-semibold text-background">Connect by Code or QR</Text></TouchableOpacity>
              <TouchableOpacity onPress={openMyQr} activeOpacity={0.75} className="border border-primary p-3 rounded-lg"><Text className="text-center font-semibold text-primary">Show My Connection QR</Text></TouchableOpacity>
            </View>
          </View>
        )}

        <View className="mb-6">
          <Text className="text-lg font-bold text-foreground mb-4">Features</Text>
          <View className="gap-3">
            <View className="bg-surface rounded-xl p-4 flex-row gap-3"><View className="w-12 h-12 bg-primary rounded-lg items-center justify-center"><Text className="text-xl">💬</Text></View><View className="flex-1"><Text className="font-semibold text-foreground mb-1">End-to-End Encrypted Chat</Text><Text className="text-xs text-muted">Private conversations protected on each device</Text></View></View>
            <View className="bg-surface rounded-xl p-4 flex-row gap-3"><View className="w-12 h-12 bg-primary rounded-lg items-center justify-center"><Text className="text-xl">✓</Text></View><View className="flex-1"><Text className="font-semibold text-foreground mb-1">Shared To-Do Lists</Text><Text className="text-xs text-muted">Create and manage tasks together with priorities</Text></View></View>
            <View className="bg-surface rounded-xl p-4 flex-row gap-3"><View className="w-12 h-12 bg-primary rounded-lg items-center justify-center"><Text className="text-xl">📊</Text></View><View className="flex-1"><Text className="font-semibold text-foreground mb-1">Goal Completion Tracker</Text><Text className="text-xs text-muted">Monitor your shared completion rate and celebrate wins</Text></View></View>
          </View>
        </View>

        {activePartnership ? <View className="mb-6"><Text className="text-lg font-bold text-foreground mb-4">Quick Stats</Text><View className="flex-row gap-3"><View className="flex-1 bg-surface rounded-lg p-4"><Text className="text-2xl font-bold text-primary mb-1">{messages.length}</Text><Text className="text-xs text-muted">Messages</Text></View><View className="flex-1 bg-surface rounded-lg p-4"><Text className="text-2xl font-bold text-primary mb-1">{tasks.length}</Text><Text className="text-xs text-muted">Tasks</Text></View><View className="flex-1 bg-surface rounded-lg p-4"><Text className="text-2xl font-bold text-primary mb-1">{completionRate}%</Text><Text className="text-xs text-muted">Completion</Text></View></View></View> : null}
        <View className="bg-surface rounded-lg p-4 mb-8"><Text className="font-semibold text-foreground mb-2">Connection tip</Text><Text className="text-sm text-muted leading-relaxed">Share your connection code or QR with your partner. The person who receives the request chooses whether to allow it.</Text></View>
      </ScrollView>

      <Modal visible={showPartnerModal} transparent animationType="slide"><View className="flex-1 bg-black/50 justify-end"><View className="bg-background rounded-t-3xl p-6 gap-4"><Text className="text-xl font-bold text-foreground">Connect Partner</Text><View><Text className="text-sm font-medium text-foreground mb-2">Partner connection code</Text><TextInput value={partnerCode} onChangeText={setPartnerCode} autoCapitalize="characters" placeholder="PSF1:..." placeholderTextColor={colors.muted} className="bg-surface text-foreground px-4 py-3 rounded-lg border border-border" /><Text className="text-xs text-muted mt-2">Your partner will receive a request and can allow or decline it.</Text>{connectionError ? <Text className="mt-2 text-sm text-error">{connectionError}</Text> : null}</View><TouchableOpacity onPress={openScanner} activeOpacity={0.75} className="border border-primary py-3 rounded-lg"><Text className="text-center font-semibold text-primary">Scan Partner QR Instead</Text></TouchableOpacity><TouchableOpacity onPress={() => void importQrFromGallery()} disabled={isImportingQr} activeOpacity={0.75} className="border border-border py-3 rounded-lg">{isImportingQr ? <ActivityIndicator size="small" color={colors.primary} /> : <Text className="text-center font-semibold text-foreground">Choose QR Image From Gallery</Text>}</TouchableOpacity><TouchableOpacity onPress={openMyQr} activeOpacity={0.75} className="py-2"><Text className="text-center font-semibold text-muted">Show My QR Code</Text></TouchableOpacity><View className="flex-row gap-3 pt-4"><TouchableOpacity onPress={() => { setConnectionError(null); setShowPartnerModal(false); }} activeOpacity={0.75} className="flex-1 bg-surface border border-border py-3 rounded-lg"><Text className="text-center font-semibold text-foreground">Cancel</Text></TouchableOpacity><TouchableOpacity onPress={() => void sendConnectionRequest(partnerCode)} disabled={!partnerCode.trim() || loading} activeOpacity={0.75} className="flex-1 bg-primary py-3 rounded-lg">{loading ? <ActivityIndicator size="small" color={colors.background} /> : <Text className="text-center font-semibold text-background">Send Request</Text>}</TouchableOpacity></View></View></View></Modal>

      <Modal visible={showMyQrModal} transparent animationType="fade" onRequestClose={() => setShowMyQrModal(false)}><View className="flex-1 bg-black/50 items-center justify-center p-6"><View className="w-full max-w-sm bg-background rounded-3xl p-6 items-center"><Text className="text-xl font-bold text-foreground">My Connection QR</Text><Text className="mt-2 text-center text-sm text-muted">Ask your partner to scan this code. You will still choose whether to allow their request.</Text>{qrDataUri ? <Image source={{ uri: qrDataUri }} style={styles.qrCode} accessibilityLabel="Your Partner Sync connection QR code" /> : qrError ? <Text className="mt-8 text-center text-sm text-error">{qrError}</Text> : <ActivityIndicator size="large" color={colors.primary} style={styles.qrLoading} />}<Text selectable className="mt-4 text-xs font-mono text-muted">{connectionCode}</Text><TouchableOpacity onPress={() => setShowMyQrModal(false)} activeOpacity={0.75} className="mt-6 w-full bg-primary py-3 rounded-lg"><Text className="text-center font-semibold text-background">Done</Text></TouchableOpacity></View></View></Modal>

      <Modal visible={showScannerModal} animationType="slide" onRequestClose={() => setShowScannerModal(false)}><View className="flex-1 bg-background"><View className="flex-row items-center justify-between px-5 pt-6 pb-4"><View><Text className="text-xl font-bold text-foreground">Scan Partner QR</Text><Text className="mt-1 text-sm text-muted">Point the camera at your partner’s Partner Sync QR code.</Text></View><TouchableOpacity onPress={() => setShowScannerModal(false)} activeOpacity={0.7} className="p-2"><Text className="font-semibold text-primary">Close</Text></TouchableOpacity></View>{!cameraPermission ? <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></View> : !cameraPermission.granted ? <View className="flex-1 items-center justify-center px-8"><Text className="text-center text-base text-foreground">Camera access is needed to scan a connection QR code.</Text><TouchableOpacity onPress={() => void requestCameraPermission()} activeOpacity={0.75} className="mt-5 bg-primary px-5 py-3 rounded-lg"><Text className="font-semibold text-background">Allow Camera</Text></TouchableOpacity><TouchableOpacity onPress={() => void importQrFromGallery()} disabled={isImportingQr} activeOpacity={0.75} className="mt-3 border border-primary px-5 py-3 rounded-lg">{isImportingQr ? <ActivityIndicator size="small" color={colors.primary} /> : <Text className="font-semibold text-primary">Choose QR Image From Gallery</Text>}</TouchableOpacity></View> : <View className="flex-1 p-5"><CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={hasScanned ? undefined : handleQrScanned} /><Text className="mt-4 text-center text-sm text-muted">Only Partner Sync connection QR codes are accepted.</Text><TouchableOpacity onPress={() => void importQrFromGallery()} disabled={isImportingQr} activeOpacity={0.75} className="mt-4 border border-primary py-3 rounded-lg">{isImportingQr ? <ActivityIndicator size="small" color={colors.primary} /> : <Text className="text-center font-semibold text-primary">Choose QR Image From Gallery</Text>}</TouchableOpacity>{connectionError ? <View className="mt-4 rounded-lg bg-error/10 p-3"><Text className="text-center text-sm text-error">{connectionError}</Text><TouchableOpacity onPress={() => { setConnectionError(null); setHasScanned(false); }} activeOpacity={0.75} className="mt-3 border border-error rounded-lg py-2"><Text className="text-center font-semibold text-error">Scan Again</Text></TouchableOpacity></View> : null}</View>}</View></Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1, borderRadius: 24, overflow: "hidden" },
  headerMark: { borderRadius: 18, height: 56, width: 56 },
  homeHeader: { marginBottom: 32, padding: 16 },
  qrCode: { height: 240, marginTop: 24, width: 240 },
  qrLoading: { height: 240, marginTop: 24 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18 },
});
