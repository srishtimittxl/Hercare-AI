import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { Severity, SymptomType } from "@/context/AppContext";

export const SYMPTOM_ICONS: Record<
  SymptomType,
  keyof typeof Feather.glyphMap
> = {
  Cramps: "activity",
  Bloating: "circle",
  Headache: "alert-circle",
  Acne: "droplet",
  Fatigue: "battery",
  "Back Pain": "meh",
  "Breast Tenderness": "heart",
};

const SEVERITY_COLORS: Record<Severity, string> = {
  Mild: "#5BAD7F",
  Moderate: "#E8A44A",
  Severe: "#E05C5C",
};

interface SymptomChipProps {
  symptom: SymptomType;
  selected: boolean;
  onPress: () => void;
}

interface SeverityChipProps {
  severity: Severity;
  selected: boolean;
  onPress: () => void;
}

export function SymptomChip({ symptom, selected, onPress }: SymptomChipProps) {
  const colors = useColors();
  const icon = SYMPTOM_ICONS[symptom];
  const accent = colors.pink;

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
          backgroundColor: selected ? accent + "18" : colors.card,
          borderColor: selected ? accent : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Feather
        name={icon}
        size={16}
        color={selected ? accent : colors.mutedForeground}
      />
      <Text
        style={[
          styles.label,
          { color: selected ? accent : colors.mutedForeground },
        ]}
      >
        {symptom}
      </Text>
    </Pressable>
  );
}

export function SeverityChip({ severity, selected, onPress }: SeverityChipProps) {
  const colors = useColors();
  const accent = SEVERITY_COLORS[severity];

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
          backgroundColor: selected ? accent + "22" : colors.card,
          borderColor: selected ? accent : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: selected ? accent : colors.mutedForeground },
        ]}
      >
        {severity}
      </Text>
    </Pressable>
  );
}

export { SEVERITY_COLORS };

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
