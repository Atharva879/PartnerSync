import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, type ViewProps } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";

type GlassTone = "default" | "strong";

export type GlassSurfaceProps = ViewProps & {
  tone?: GlassTone;
  intensity?: number;
};

/**
 * A contrast-safe frosted surface that gracefully falls back to translucency
 * where native blur is not available or appropriate.
 */
export function GlassSurface({ children, intensity = 38, style, tone = "default", ...props }: GlassSurfaceProps) {
  const colors = useColors();
  const { colorScheme } = useThemeContext();
  const fill = tone === "strong" ? colors.glassStrong : colors.glass;

  return (
    <BlurView
      intensity={intensity}
      tint={colorScheme === "dark" ? "dark" : "light"}
      experimentalBlurMethod={Platform.OS === "android" ? "dimezisBlurView" : undefined}
      style={[styles.surface, { backgroundColor: fill, borderColor: colors.glassBorder }, style]}
      {...props}
    >
      <View style={styles.content}>{children}</View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  surface: { borderRadius: 24, borderWidth: 1, overflow: "hidden" },
  content: { flexGrow: 1 },
});
