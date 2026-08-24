import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";

import { AuthRequired } from "@/components/auth-required";
import { GlassSurface } from "@/components/glass-surface";
import { ScreenContainer } from "@/components/screen-container";
import { useFirebaseAuth } from "@/hooks/use-firebase-auth";
import { useFirebasePartnership } from "@/hooks/use-firebase-partnership";
import { useColors } from "@/hooks/use-colors";
import { createFirebaseTask, deleteFirebaseTask, subscribeToFirebaseTasks, updateFirebaseTask } from "@/lib/firebase-repository";
import type { FirebaseTask } from "@/shared/firebase-schema";

export default function TasksScreen() {
  const { user, loading: authLoading } = useFirebaseAuth();
  const { activePartnership, loading: partnershipLoading } = useFirebasePartnership();
  const colors = useColors();
  const [tasks, setTasks] = useState<FirebaseTask[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<FirebaseTask["priority"]>("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  useEffect(() => {
    if (!activePartnership) {
      setTasks([]);
      return;
    }
    return subscribeToFirebaseTasks(activePartnership.id, setTasks, (nextError) => setError(nextError.message));
  }, [activePartnership]);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (filter === "active") return !task.completed;
    if (filter === "completed") return task.completed;
    return true;
  }), [filter, tasks]);
  const completedCount = tasks.filter((task) => task.completed).length;
  const completionRate = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  const handleAddTask = async () => {
    if (!taskTitle.trim() || !activePartnership || !user) return;
    setLoading(true);
    setError(null);
    try {
      await createFirebaseTask(activePartnership.id, user.uid, taskTitle, taskPriority);
      setTaskTitle("");
      setTaskPriority("medium");
      setShowAddModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to add the task.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTask = async (task: FirebaseTask) => {
    if (!activePartnership || !user) return;
    setError(null);
    try {
      await updateFirebaseTask(activePartnership.id, task.id, {
        completed: !task.completed,
        completedBy: task.completed ? null : user.uid,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update the task.");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!activePartnership) return;
    setError(null);
    try {
      await deleteFirebaseTask(activePartnership.id, taskId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete the task.");
    }
  };

  if (authLoading) return <ScreenContainer className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;
  if (!user) return <AuthRequired title="Sign in to share tasks" />;
  if (partnershipLoading) return <ScreenContainer className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={colors.primary} /></ScreenContainer>;
  if (!activePartnership) return <ScreenContainer className="flex-1 items-center justify-center p-4"><Text className="text-lg font-semibold text-foreground mb-2">No Partner Connected</Text><Text className="text-sm text-muted text-center">Connect with your partner to manage tasks together.</Text></ScreenContainer>;

  return (
    <ScreenContainer className="flex-1 px-5 pt-4">
      <GlassSurface style={{ marginBottom: 16, padding: 16 }}>
        <Text className="text-sm text-muted mb-2">Completion Rate</Text>
        <View className="flex-row items-center gap-3"><View className="flex-1 bg-border rounded-full h-2 overflow-hidden"><View className="bg-success h-full" style={{ width: `${completionRate}%` }} /></View><Text className="text-lg font-bold text-foreground">{completionRate}%</Text></View>
        <Text className="text-xs text-muted mt-2">{completedCount} of {tasks.length} tasks completed</Text>
      </GlassSurface>

      <View className="flex-row gap-2 mb-4">{(["all", "active", "completed"] as const).map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })} className={`px-4 py-2 rounded-full ${filter === item ? "bg-primary" : "bg-surface border border-border"}`}><Text className={`text-sm font-medium capitalize ${filter === item ? "text-background" : "text-foreground"}`}>{item}</Text></Pressable>)}</View>
      {error ? <Text className="mb-3 text-sm text-error">{error}</Text> : null}

      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="bg-surface rounded-lg p-4 mb-3 flex-row items-center gap-3">
            <Pressable onPress={() => void handleToggleTask(item)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })} className={`w-6 h-6 rounded-full border-2 items-center justify-center ${item.completed ? "bg-success border-success" : "border-border"}`}>{item.completed ? <Text className="text-background text-sm font-bold">✓</Text> : null}</Pressable>
            <View className="flex-1"><Text className={`font-medium ${item.completed ? "text-muted line-through" : "text-foreground"}`}>{item.title}</Text><View className="flex-row gap-2 mt-1"><View className={`px-2 py-1 rounded ${item.priority === "high" ? "bg-error" : item.priority === "medium" ? "bg-warning" : "bg-border"}`}><Text className={item.priority === "high" || item.priority === "medium" ? "text-background text-xs" : "text-foreground text-xs"}>{item.priority}</Text></View></View></View>
            <Pressable onPress={() => void handleDeleteTask(item.id)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}><Text className="text-error font-bold text-lg">×</Text></Pressable>
          </View>
        )}
        ListEmptyComponent={<View className="flex-1 items-center justify-center py-8"><Text className="text-muted">No tasks yet. Create one to get started.</Text></View>}
      />

      <Pressable onPress={() => setShowAddModal(true)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })} className="bg-primary p-4 rounded-full items-center mt-4"><Text className="text-background font-bold text-lg">+ Add Task</Text></Pressable>

      <Modal visible={showAddModal} transparent animationType="slide"><View className="flex-1 bg-black/50 justify-end"><GlassSurface tone="strong" intensity={55} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 24 }}><Text className="text-xl font-bold text-foreground">Add New Task</Text><TextInput value={taskTitle} onChangeText={setTaskTitle} placeholder="Task title" placeholderTextColor={colors.muted} className="bg-surface text-foreground px-4 py-3 rounded-lg border border-border" /><View><Text className="text-sm font-medium text-foreground mb-2">Priority</Text><View className="flex-row gap-2">{(["low", "medium", "high"] as const).map((priority) => <Pressable key={priority} onPress={() => setTaskPriority(priority)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })} className={`flex-1 py-2 rounded-lg ${taskPriority === priority ? "bg-primary" : "bg-surface border border-border"}`}><Text className={`text-center capitalize font-medium ${taskPriority === priority ? "text-background" : "text-foreground"}`}>{priority}</Text></Pressable>)}</View></View><View className="flex-row gap-3 pt-4"><Pressable onPress={() => setShowAddModal(false)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })} className="flex-1 bg-surface border border-border py-3 rounded-lg"><Text className="text-center font-semibold text-foreground">Cancel</Text></Pressable><Pressable onPress={() => void handleAddTask()} disabled={!taskTitle.trim() || loading} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })} className="flex-1 bg-primary py-3 rounded-lg">{loading ? <ActivityIndicator size="small" color={colors.background} /> : <Text className="text-center font-semibold text-background">Add</Text>}</Pressable></View></GlassSurface></View></Modal>
    </ScreenContainer>
  );
}
