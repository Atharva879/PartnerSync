import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";

import { GlassSurface } from "@/components/glass-surface";
import { ScreenContainer } from "@/components/screen-container";
import { useFirebaseAuth } from "@/hooks/use-firebase-auth";
import { useFirebasePartnership } from "@/hooks/use-firebase-partnership";
import { useColors } from "@/hooks/use-colors";
import { createSafetyNumber, decryptMessage, encryptMessageForParticipants, generateKeyPair, isValidKeyPair, type KeyPair } from "@/lib/encryption";
import {
  createFirebaseEncryptedMessage,
  subscribeToFirebaseMessages,
  updateFirebaseMessageReceipt,
  updateFirebasePartnership,
} from "@/lib/firebase-repository";
import { DeviceKeyStorageError, secureKeyStorage } from "@/lib/secure-key-storage";
import { deriveEncryptionDiagnostic } from "@/shared/encryption-diagnostics";
import { receiptGlyph, receiptLabel } from "@/shared/message-receipts";
import { createClientMessageId, type EncryptedMessagePayload } from "@/shared/message-retry";
import type { FirebaseEncryptedMessage } from "@/shared/firebase-schema";

interface DisplayMessage extends Omit<FirebaseEncryptedMessage, "createdAt"> {
  createdAt: Date;
  plaintext: string;
}

interface FailedMessage {
  id: string;
  clientMessageId: string;
  senderId: string;
  plaintext: string;
  createdAt: Date;
  status: "failed";
  payload: EncryptedMessagePayload;
  errorMessage: string;
}

type ChatMessage = DisplayMessage | FailedMessage;

function isFailedMessage(message: ChatMessage): message is FailedMessage {
  return message.status === "failed";
}

function keyName(userId: string, part: "public" | "secret") {
  return `partner-sync.chat-key.${userId}.${part}`;
}

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate() as Date;
  }
  return new Date();
}

export default function ChatScreen() {
  const { user, loading: authLoading } = useFirebaseAuth();
  const { activePartnership, error: partnershipError, loading: partnershipLoading } = useFirebasePartnership();
  const colors = useColors();
  const router = useRouter();
  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const [keyPair, setKeyPair] = useState<KeyPair | null>(null);
  const [keysLoading, setKeysLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [transportError, setTransportError] = useState<string | null>(null);
  const [failedMessages, setFailedMessages] = useState<FailedMessage[]>([]);
  const [fetchedMessages, setFetchedMessages] = useState<FirebaseEncryptedMessage[]>([]);
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [clock, setClock] = useState(Date.now());
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readReceiptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localTypingRef = useRef(false);

  const ownPublishedKey = useMemo(() => {
    if (!activePartnership || !user) return null;
    return activePartnership.requesterId === user.uid ? activePartnership.requesterPublicKey ?? null : activePartnership.recipientPublicKey ?? null;
  }, [activePartnership, user]);
  const partnerPublicKey = useMemo(() => {
    if (!activePartnership || !user) return null;
    return activePartnership.requesterId === user.uid ? activePartnership.recipientPublicKey ?? null : activePartnership.requesterPublicKey ?? null;
  }, [activePartnership, user]);
  const partnerTypingUntil = useMemo(() => {
    if (!activePartnership || !user) return null;
    return activePartnership.requesterId === user.uid ? activePartnership.recipientTypingUntil : activePartnership.requesterTypingUntil;
  }, [activePartnership, user]);
  const partnerIsTyping = typeof partnerTypingUntil === "number" && partnerTypingUntil > clock;

  const loadKeys = useCallback(async () => {
    if (!user?.uid) {
      setKeyPair(null);
      setKeysLoading(false);
      return;
    }
    try {
      setKeysLoading(true);
      setKeyError(null);
      const [storedPublicKey, storedSecretKey] = await Promise.all([
        secureKeyStorage.getItem(keyName(user.uid, "public")),
        secureKeyStorage.getItem(keyName(user.uid, "secret")),
      ]);
      const storedKeyPair = storedPublicKey && storedSecretKey ? { publicKey: storedPublicKey, secretKey: storedSecretKey } : null;
      const canReuseStoredKeys = isValidKeyPair(storedKeyPair);
      const nextKeyPair = canReuseStoredKeys ? storedKeyPair : generateKeyPair();
      if (!canReuseStoredKeys) {
        await Promise.all([secureKeyStorage.removeItem(keyName(user.uid, "public")), secureKeyStorage.removeItem(keyName(user.uid, "secret"))]);
        await Promise.all([secureKeyStorage.setItem(keyName(user.uid, "public"), nextKeyPair.publicKey), secureKeyStorage.setItem(keyName(user.uid, "secret"), nextKeyPair.secretKey)]);
      }
      setKeyPair(nextKeyPair);
    } catch (error) {
      console.error("Partner Sync encryption key setup failed", error);
      if (error instanceof DeviceKeyStorageError) setKeyError("Secure device storage is unavailable. Unlock your device, then try again.");
      else if (error instanceof Error && error.message.includes("no PRNG")) setKeyError("Secure randomness is unavailable. Update the app, then try again.");
      else setKeyError("Encryption key setup failed. Try again, or reconnect your partner from Home.");
    } finally {
      setKeysLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => { void loadKeys(); }, [loadKeys]);
  useEffect(() => {
    if (!activePartnership) {
      setFetchedMessages([]);
      return;
    }
    return subscribeToFirebaseMessages(activePartnership.id, setFetchedMessages, (error) => setTransportError(error.message));
  }, [activePartnership]);
  useEffect(() => {
    if (!activePartnership) return;
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activePartnership]);

  useEffect(() => {
    if (!activePartnership || !user || !keyPair) return;
    if (ownPublishedKey && ownPublishedKey !== keyPair.publicKey) {
      setKeyError("This device has a new encryption key. Reconnect from Home and have your partner approve the request.");
      return;
    }
    if (ownPublishedKey === keyPair.publicKey) return;
    const field = activePartnership.requesterId === user.uid ? "requesterPublicKey" : "recipientPublicKey";
    void updateFirebasePartnership(activePartnership.id, { [field]: keyPair.publicKey })
      .catch((error) => setKeyError(error instanceof Error ? error.message : "Unable to publish this device's encryption key."));
  }, [activePartnership, keyPair, ownPublishedKey, user]);

  useEffect(() => {
    if (!keyPair || !user) {
      setDisplayMessages([]);
      return;
    }
    const decrypted = fetchedMessages.map((message): DisplayMessage | null => {
      try {
        const isSender = message.senderId === user.uid;
        const envelope = isSender
          ? { ciphertext: message.senderEncryptedContent ?? message.encryptedContent, nonce: message.senderNonce ?? message.nonce }
          : { ciphertext: message.encryptedContent, nonce: message.nonce };
        const senderPublicKey = isSender ? keyPair.publicKey : message.senderPublicKey ?? partnerPublicKey;
        if (!senderPublicKey) return null;
        return { ...message, createdAt: asDate(message.createdAt), plaintext: decryptMessage(envelope, senderPublicKey, keyPair.secretKey) };
      } catch {
        return null;
      }
    }).filter((message): message is DisplayMessage => message !== null);
    setDisplayMessages(decrypted);

    if (!activePartnership) return;
    const unreadFromPartner = fetchedMessages.filter((message) => message.senderId !== user.uid && message.status !== "read");
    if (unreadFromPartner.length) {
      if (readReceiptTimerRef.current) clearTimeout(readReceiptTimerRef.current);
      readReceiptTimerRef.current = setTimeout(() => {
        void Promise.all(unreadFromPartner.map((message) => updateFirebaseMessageReceipt(activePartnership.id, message.id, "read"))).catch((error) => console.warn("Unable to update message receipts", error));
      }, 400);
    }
  }, [activePartnership, fetchedMessages, keyPair, partnerPublicKey, user]);

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (typingHeartbeatRef.current) clearInterval(typingHeartbeatRef.current);
    typingTimerRef.current = null;
    typingHeartbeatRef.current = null;
    if (!localTypingRef.current || !activePartnership || !user) return;
    localTypingRef.current = false;
    const field = activePartnership.requesterId === user.uid ? "requesterTypingUntil" : "recipientTypingUntil";
    void updateFirebasePartnership(activePartnership.id, { [field]: null }).catch(() => undefined);
  }, [activePartnership, user]);

  const setTyping = useCallback(() => {
    if (!activePartnership || !user) return;
    const field = activePartnership.requesterId === user.uid ? "requesterTypingUntil" : "recipientTypingUntil";
    void updateFirebasePartnership(activePartnership.id, { [field]: Date.now() + 4000 }).catch(() => undefined);
  }, [activePartnership, user]);

  const handleTextChange = (nextText: string) => {
    setMessageText(nextText);
    if (!nextText.trim()) {
      stopTyping();
      return;
    }
    if (!localTypingRef.current) {
      localTypingRef.current = true;
      setTyping();
      typingHeartbeatRef.current = setInterval(setTyping, 2500);
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(stopTyping, 1500);
  };

  useEffect(() => () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (typingHeartbeatRef.current) clearInterval(typingHeartbeatRef.current);
    if (readReceiptTimerRef.current) clearTimeout(readReceiptTimerRef.current);
  }, []);

  const encryptionDiagnostic = useMemo(() => deriveEncryptionDiagnostic({
    hasActivePartnership: Boolean(activePartnership),
    isLoadingKey: keysLoading,
    hasLocalKey: Boolean(keyPair),
    localPublicKey: keyPair?.publicKey ?? null,
    publishedOwnKey: ownPublishedKey,
    publishedPartnerKey: partnerPublicKey,
    keyError,
  }), [activePartnership, keyError, keyPair, keysLoading, ownPublishedKey, partnerPublicKey]);
  const keysReady = encryptionDiagnostic.stage === "ready";
  const safetyNumber = keyPair && partnerPublicKey ? createSafetyNumber(keyPair.publicKey, partnerPublicKey) : null;
  const chatMessages = useMemo<ChatMessage[]>(() => [...displayMessages, ...failedMessages].sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime()), [displayMessages, failedMessages]);

  const sendPayload = async (payload: EncryptedMessagePayload) => {
    if (!activePartnership || !user) throw new Error("Your partner connection is no longer available.");
    await createFirebaseEncryptedMessage(activePartnership.id, { senderId: user.uid, status: "sent", ...payload });
  };
  const retryFailedMessage = async (failedMessage: FailedMessage) => {
    if (!activePartnership || !keysReady || sending) return;
    try {
      setSending(true);
      await sendPayload(failedMessage.payload);
      setFailedMessages((current) => current.filter((message) => message.clientMessageId !== failedMessage.clientMessageId));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Check your connection and try again.";
      setFailedMessages((current) => current.map((message) => message.clientMessageId === failedMessage.clientMessageId ? { ...message, errorMessage } : message));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSending(false);
    }
  };
  const handleSend = async () => {
    if (!messageText.trim() || !activePartnership || !user || !keyPair || !partnerPublicKey || !keysReady) return;
    const plaintext = messageText.trim();
    stopTyping();
    const encrypted = encryptMessageForParticipants(plaintext, partnerPublicKey, keyPair);
    const payload: EncryptedMessagePayload = { clientMessageId: createClientMessageId(), encryptedContent: encrypted.recipient.ciphertext, nonce: encrypted.recipient.nonce, senderEncryptedContent: encrypted.sender.ciphertext, senderNonce: encrypted.sender.nonce, senderPublicKey: encrypted.senderPublicKey };
    setMessageText("");
    try {
      setSending(true);
      await sendPayload(payload);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Check your connection and try again.";
      setFailedMessages((current) => [...current.filter((message) => message.clientMessageId !== payload.clientMessageId), { id: `failed-${payload.clientMessageId}`, clientMessageId: payload.clientMessageId, senderId: user.uid, plaintext, createdAt: new Date(), status: "failed", payload, errorMessage }]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSending(false);
    }
  };

  if (authLoading || keysLoading || partnershipLoading) return <ScreenContainer className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;
  if (!user) return <ScreenContainer className="flex-1 items-center justify-center p-6"><Text className="text-lg font-semibold text-foreground">Sign in to use private chat</Text><Text className="mt-2 text-center text-muted">Open Home to sign in and connect your partner.</Text></ScreenContainer>;
  if (partnershipError || !activePartnership) return <ScreenContainer className="flex-1 items-center justify-center p-6"><Text className="text-lg font-semibold text-foreground">No partner connected</Text><Text className="mt-2 text-center text-muted">Connect your partner from Home before starting an encrypted chat.</Text></ScreenContainer>;

  return <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : "height"}><ScreenContainer className="flex-1"><GlassSurface tone="strong" intensity={32} style={styles.securityPanel}><View className="flex-row items-center justify-between"><View className="flex-1 pr-2"><Text className="font-semibold text-foreground">{encryptionDiagnostic.title}</Text><Text className="mt-1 text-xs text-muted">{keysReady && safetyNumber ? `Safety number: ${safetyNumber}` : `Step ${encryptionDiagnostic.step} of 3 · ${encryptionDiagnostic.detail}`}</Text></View>{encryptionDiagnostic.action !== "none" ? <Pressable onPress={() => { if (encryptionDiagnostic.action === "open-home") { router.navigate("/"); return; } void loadKeys(); }} style={({ pressed }) => [styles.resetKeysButton, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}><Text style={[styles.resetKeysText, { color: colors.primary }]}>{encryptionDiagnostic.actionLabel}</Text></Pressable> : null}</View></GlassSurface>{partnerIsTyping ? <View className="px-4 pb-2"><Text className="text-xs font-medium text-muted">Your partner is typing…</Text></View> : null}{transportError ? <Text className="px-4 pb-2 text-xs text-error">{transportError}</Text> : null}<FlatList ref={flatListRef} data={chatMessages} keyExtractor={(item) => item.id} contentContainerStyle={styles.messages} renderItem={({ item }) => { const failed = isFailedMessage(item); const sent = failed || item.senderId === user.uid; return <View className={`mb-3 ${sent ? "items-end" : "items-start"}`}><View className={`max-w-xs rounded-2xl px-4 py-3 ${failed ? "bg-error" : sent ? "bg-primary" : "bg-surface"}`}><Text className={sent ? "text-background" : "text-foreground"}>{item.plaintext}</Text></View><View className="mt-1 flex-row items-center gap-1"><Text className="text-xs text-muted">{item.createdAt.toLocaleTimeString()}</Text>{failed ? <Pressable accessibilityLabel="Retry failed message" disabled={sending} onPress={() => void retryFailedMessage(item)} style={({ pressed }) => [styles.retryButton, { borderColor: colors.error, opacity: sending ? 0.45 : pressed ? 0.72 : 1 }]}><Text style={[styles.retryText, { color: colors.error }]}>! Retry</Text></Pressable> : sent ? <Text accessibilityLabel={`Message ${receiptLabel(item.status)}`} style={[styles.receipt, { color: item.status === "read" ? colors.primary : colors.muted }]}>{receiptGlyph(item.status)} {receiptLabel(item.status)}</Text> : null}</View></View>; }} ListEmptyComponent={<View className="flex-1 items-center justify-center"><Text className="text-muted">Messages will appear here.</Text></View>} /><GlassSurface tone="strong" intensity={32} style={styles.composer}><View className="flex-row items-center gap-2"><TextInput value={messageText} onChangeText={handleTextChange} placeholder={keysReady ? "Type a message…" : "Encryption setup is in progress"} placeholderTextColor={colors.muted} editable={keysReady && !sending} className="flex-1 rounded-full bg-surface px-4 py-3 text-foreground" /><Pressable onPress={() => void handleSend()} disabled={!keysReady || !messageText.trim() || sending} style={({ pressed }) => [styles.sendButton, { backgroundColor: colors.primary, opacity: !keysReady || !messageText.trim() || sending ? 0.45 : pressed ? 0.78 : 1 }]}>{sending ? <ActivityIndicator color={colors.background} /> : <Text style={{ color: colors.background, fontWeight: "700" }}>Send</Text>}</Pressable></View></GlassSurface></ScreenContainer></KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  composer: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 12 },
  messages: { flexGrow: 1, paddingHorizontal: 16, paddingVertical: 16 },
  receipt: { fontSize: 12, fontWeight: "600" },
  resetKeysButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
  resetKeysText: { fontSize: 11, fontWeight: "700" },
  retryButton: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  retryText: { fontSize: 12, fontWeight: "700" },
  sendButton: { alignItems: "center", borderRadius: 999, justifyContent: "center", minHeight: 48, minWidth: 60, paddingHorizontal: 14 },
  securityPanel: { borderTopLeftRadius: 0, borderTopRightRadius: 0, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 12 },
});
