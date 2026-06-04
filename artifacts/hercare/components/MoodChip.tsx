import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { MoodType } from "@/context/AppContext";

const MOOD_META: Record<
  MoodType,
  { icon: keyof typeof Feather.glyphMap; color: string }
> = {
  Happy: { icon: "sun", color: "#E8A44A" },
  Calm: { icon: "wind", color: "#5BAD7F" },
  Motivated: { icon: "zap", color: "#9B6B9E" },
  Sad: { icon: "cloud-rain", color: "#5B8EC4" },
  Irritated: { icon: "alert-circle", color: "#E05C5C" },
  Anxious: { icon: "activity", color: "#E8689A" },
  Tired: { icon: "moon", color: "#7B7BA8" },
  Stressed: { icon: "thermometer", color: "#E87B4A" },
};

interface Props {
  mood: MoodType;
  selected: boolean;
  onPress: () => void;
}

export function MoodChip({ mood, selected, onPress }: Props) {
  const colors = useColors();
  const meta = MOOD_META[mood];

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? meta.color + "22" : colors.card,
          borderColor: selected ? meta.color : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Feather name={meta.icon} size={18} color={selected ? meta.color : colors.mutedForeground} />
      <Text
        style={[
          styles.label,
          { color: selected ? meta.color : colors.mutedForeground },
        ]}
      >
        {mood}
      </Text>
    </Pressable>
  );
}

export { MOOD_META };

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
