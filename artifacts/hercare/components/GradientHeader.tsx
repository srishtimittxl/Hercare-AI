import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface Props {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
}

export function GradientHeader({ title, subtitle, rightElement }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <LinearGradient
      colors={[colors.lavenderLight, colors.pinkLight, "#FFFFFF"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: topPad + 12 }]}
    >
      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={[styles.title, { color: colors.lavender }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {rightElement}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.5,
    fontFamily: "Inter_700Bold",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: "Inter_400Regular",
  },
});
