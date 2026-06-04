import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "destructive";
  style?: ViewStyle;
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
}: Props) {
  const colors = useColors();

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const bg =
    variant === "destructive"
      ? colors.destructive
      : variant === "secondary"
      ? colors.secondary
      : colors.lavender;

  const fg =
    variant === "secondary" ? colors.lavender : colors.primaryForeground;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: pressed || disabled ? 0.75 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
