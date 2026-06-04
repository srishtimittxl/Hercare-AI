import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  value: string;
  subtitle?: string;
  accentColor?: string;
}

export function InsightCard({ icon, title, value, subtitle, accentColor }: Props) {
  const colors = useColors();
  const accent = accentColor ?? colors.lavender;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: accent + "18" }]}>
        <Feather name={icon} size={18} color={accent} />
      </View>
      <Text style={[styles.title, { color: colors.mutedForeground }]}>
        {title}
      </Text>
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 4,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
