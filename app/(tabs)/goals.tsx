import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";

import { AuthRequired } from "@/components/auth-required";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenContainer } from "@/components/screen-container";
import { useFirebaseAuth } from "@/hooks/use-firebase-auth";
import { useFirebasePartnership } from "@/hooks/use-firebase-partnership";
import { useColors } from "@/hooks/use-colors";
import { createFirebaseGoal, deleteFirebaseGoal, subscribeToFirebaseGoals, subscribeToFirebaseTasks } from "@/lib/firebase-repository";
import type { FirebaseGoal, FirebaseTask } from "@/shared/firebase-schema";

export default function GoalsScreen() {
  const { user, loading: authLoading } = useFirebaseAuth();
  const { activePartnership, loading: partnershipLoading } = useFirebasePartnership();
  const colors = useColors();
  const [goals, setGoals] = useState<FirebaseGoal[]>([]);
  const [tasks, setTasks] = useState<FirebaseTask[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [targetRate, setTargetRate] = useState("80");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!activePartnership) {
      setGoals([]);
      setTasks([]);
      return;
    }
    const unsubscribeGoals = subscribeToFirebaseGoals(activePartnership.id, setGoals, (error) => setFormError(error.message));
    const unsubscribeTasks = subscribeToFirebaseTasks(activePartnership.id, setTasks, (error) => setFormError(error.message));
    return () => {
      unsubscribeGoals();
      unsubscribeTasks();
    };
  }, [activePartnership]);

  const completedTaskCount = tasks.filter((task) => task.completed).length;
  const currentRate = tasks.length ? Math.round((completedTaskCount / tasks.length) * 100) : 0;
  const isGoalMet = (goalRate: number) => currentRate >= goalRate;

  const handleAddGoal = async () => {
    if (!goalTitle.trim() || !activePartnership) return;
    const parsedTargetRate = Number(targetRate);
    if (!Number.isInteger(parsedTargetRate) || parsedTargetRate < 0 || parsedTargetRate > 100) {
      setFormError("Choose a whole-number target from 0 to 100.");
      return;
    }

    setLoading(true);
    setFormError(null);
    try {
      await createFirebaseGoal(activePartnership.id, { title: goalTitle.trim(), targetRate: parsedTargetRate, description: null });
      setGoalTitle("");
      setTargetRate("80");
      setShowAddModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to create this goal.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!activePartnership) return;
    setFormError(null);
    try {
      await deleteFirebaseGoal(activePartnership.id, goalId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to delete this goal.");
    }
  };

  if (authLoading) return <ScreenContainer className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;
  if (!user) return <AuthRequired title="Sign in to track goals" />;
  if (partnershipLoading) return <ScreenContainer className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;
  if (!activePartnership) return <ScreenContainer className="flex-1 items-center justify-center p-4"><Text className="text-lg font-semibold text-foreground mb-2">No Partner Connected</Text><Text className="text-sm text-muted text-center">Connect with your partner to track goals together.</Text></ScreenContainer>;

  return (
    <ScreenContainer className="flex-1 px-5 pt-4">
      <GlassSurface style={{ marginBottom: 24, padding: 24 }}>
        <Text className="text-sm text-muted mb-4">Overall Completion Rate</Text>
        <View className="items-center mb-6"><View className="w-32 h-32 rounded-full border-8 items-center justify-center" style={{ borderColor: colors.primary }}><View><Text className="text-4xl font-bold text-foreground text-center">{currentRate}%</Text><Text className="text-xs text-muted text-center mt-1">{completedTaskCount}/{tasks.length}</Text></View></View></View>
        <View className="flex-row gap-4"><View className="flex-1 bg-background rounded-lg p-3"><Text className="text-xs text-muted mb-1">Total Tasks</Text><Text className="text-2xl font-bold text-foreground">{tasks.length}</Text></View><View className="flex-1 bg-background rounded-lg p-3"><Text className="text-xs text-muted mb-1">Completed</Text><Text className="text-2xl font-bold text-success">{completedTaskCount}</Text></View></View>
      </GlassSurface>

      <Text className="text-lg font-bold text-foreground mb-3">Your Goals</Text>
      {formError ? <Text className="mb-3 text-sm text-error">{formError}</Text> : null}
      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const met = isGoalMet(item.targetRate);
          return <View className="bg-surface rounded-lg p-4 mb-3"><View className="flex-row items-start justify-between mb-3"><View className="flex-1"><Text className="text-base font-semibold text-foreground">{item.title}</Text><Text className="text-xs text-muted mt-1">Target: {item.targetRate}%</Text></View><View className={`px-3 py-1 rounded-full ${met ? "bg-success" : "bg-warning"}`}><Text className="text-xs font-bold text-background">{met ? "✓ Met" : "In Progress"}</Text></View></View><View className="bg-border rounded-full h-2 overflow-hidden mb-3"><View className={`h-full ${met ? "bg-success" : "bg-primary"}`} style={{ width: `${Math.min(currentRate, 100)}%` }} /></View><View className="flex-row items-center justify-between"><Text className="text-sm font-medium text-foreground">{currentRate}% / {item.targetRate}%</Text><TouchableOpacity onPress={() => void handleDeleteGoal(item.id)} activeOpacity={0.6}><Text className="text-error font-bold text-lg">×</Text></TouchableOpacity></View></View>;
        }}
        ListEmptyComponent={<View className="items-center py-8"><Text className="text-muted">No goals yet. Create one to get started.</Text></View>}
      />

      <TouchableOpacity onPress={() => { setFormError(null); setShowAddModal(true); }} activeOpacity={0.8} className="bg-primary p-4 rounded-full items-center mt-4"><Text className="text-background font-bold text-lg">+ Add Goal</Text></TouchableOpacity>

      <Modal visible={showAddModal} transparent animationType="slide"><View className="flex-1 bg-black/50 justify-end"><GlassSurface tone="strong" intensity={55} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 24 }}><Text className="text-xl font-bold text-foreground">Create New Goal</Text><TextInput value={goalTitle} onChangeText={setGoalTitle} placeholder="Goal title" placeholderTextColor={colors.muted} className="bg-surface text-foreground px-4 py-3 rounded-lg border border-border" /><View><Text className="text-sm font-medium text-foreground mb-2">Target Completion Rate: {targetRate}%</Text><TextInput value={targetRate} onChangeText={setTargetRate} placeholder="80" placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={3} className="bg-surface text-foreground px-4 py-3 rounded-lg border border-border" /><Text className="text-xs text-muted mt-2">Set a target completion percentage (0–100)</Text>{formError ? <Text className="text-xs text-error mt-2">{formError}</Text> : null}</View><View className="flex-row gap-3 pt-4"><TouchableOpacity onPress={() => setShowAddModal(false)} activeOpacity={0.7} className="flex-1 bg-surface border border-border py-3 rounded-lg"><Text className="text-center font-semibold text-foreground">Cancel</Text></TouchableOpacity><TouchableOpacity onPress={() => void handleAddGoal()} disabled={!goalTitle.trim() || loading} activeOpacity={0.7} className="flex-1 bg-primary py-3 rounded-lg">{loading ? <ActivityIndicator size="small" color={colors.background} /> : <Text className="text-center font-semibold text-background">Create</Text>}</TouchableOpacity></View></GlassSurface></View></Modal>
    </ScreenContainer>
  );
}
