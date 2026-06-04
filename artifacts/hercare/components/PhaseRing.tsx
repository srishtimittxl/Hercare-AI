import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

interface Props {
  day: number | null;
  cycleLength: number;
  phase: string;
}

const PHASE_COLORS: Record<string, string[]> = {
  Menstrual: ["#E8689A", "#F4A8C4"],
  Follicular: ["#9B6B9E", "#C4A8D4"],
  Ovulation: ["#5BAD7F", "#A8D4BC"],
  Luteal: ["#E8A44A", "#F4CCA0"],
  Unknown: ["#C4A8D4", "#E8DEFF"],
};

export function PhaseRing({ day, cycleLength, phase }: Props) {
  const colors = useColors();
  const SIZE = 160;
  const STROKE = 12;
  const R = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const progress = day != null ? Math.min(day / cycleLength, 1) : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  const [color1, color2] = PHASE_COLORS[phase] ?? PHASE_COLORS["Unknown"];

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={colors.lavenderLight}
          strokeWidth={STROKE}
          fill="none"
        />
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={color1}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        {day != null ? (
          <>
            <Text style={[styles.dayNum, { color: color1 }]}>{day}</Text>
            <Text style={[styles.dayLabel, { color: colors.mutedForeground }]}>
              Day
            </Text>
          </>
        ) : (
          <Text style={[styles.noData, { color: colors.mutedForeground }]}>
            No data
          </Text>
        )}
      </View>
      <View style={[styles.phaseBadge, { backgroundColor: color1 + "22" }]}>
        <Text style={[styles.phaseText, { color: color1 }]}>{phase}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  dayNum: {
    fontSize: 40,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    lineHeight: 44,
  },
  dayLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  noData: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    paddingHorizontal: 16,
  },
  phaseBadge: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 20,
  },
  phaseText: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
