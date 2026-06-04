import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import type { FlowLevel } from "@/context/AppContext";

const FLOW_LEVELS: FlowLevel[] = ["Light", "Medium", "Heavy"];
const FLOW_COLORS: Record<FlowLevel, string> = {
  Light: "#F4A8C4",
  Medium: "#E8689A",
  Heavy: "#C4356A",
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CycleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { cycleLogs, addCycleLog, updateCycleLog, currentCycleDay, currentPhase, predictedNextPeriod, averageCycleLength } = useApp();
  const [selectedFlow, setSelectedFlow] = useState<FlowLevel>("Medium");
  const [loading, setLoading] = useState(false);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const activeCycle = cycleLogs.find((c) => !c.endDate);

  const handleStartPeriod = () => {
    if (activeCycle) {
      Alert.alert("Period already active", "End your current period first.");
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addCycleLog({
      startDate: todayStr(),
      endDate: null,
      flowLevel: selectedFlow,
    });
    setLoading(false);
  };

  const handleEndPeriod = () => {
    if (!activeCycle) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateCycleLog(activeCycle.id, { endDate: todayStr() });
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.screenTitle, { color: colors.lavender }]}>
          Cycle Tracker
        </Text>
        <Text style={[styles.screenSub, { color: colors.mutedForeground }]}>
          Track your menstrual cycle
        </Text>
      </View>

      <View style={styles.body}>
        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            {
              label: "Cycle Day",
              value: currentCycleDay != null ? String(currentCycleDay) : "—",
              icon: "calendar" as const,
              color: colors.pink,
            },
            {
              label: "Avg Length",
              value: `${averageCycleLength}d`,
              icon: "rotate-cw" as const,
              color: colors.lavender,
            },
            {
              label: "Phase",
              value: currentPhase,
              icon: "sun" as const,
              color: "#5BAD7F",
            },
          ].map((s) => (
            <View
              key={s.label}
              style={[
                styles.statCard,
                { backgroundColor: s.color + "14", borderColor: s.color + "33" },
              ]}
            >
              <Feather name={s.icon} size={16} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Active period */}
        {activeCycle ? (
          <View
            style={[
              styles.activeBanner,
              { backgroundColor: colors.pinkLight, borderColor: colors.pink + "44" },
            ]}
          >
            <View style={styles.activeBannerRow}>
              <View
                style={[styles.activeDot, { backgroundColor: colors.pink }]}
              />
              <Text style={[styles.activeBannerTitle, { color: colors.pink }]}>
                Period Active
              </Text>
            </View>
            <Text style={[styles.activeBannerSub, { color: colors.mutedForeground }]}>
              Started {formatDate(activeCycle.startDate)} · Flow: {activeCycle.flowLevel}
            </Text>
            <PrimaryButton
              label="End Period"
              onPress={handleEndPeriod}
              variant="secondary"
              style={{ marginTop: 12 }}
            />
          </View>
        ) : (
          <>
            {/* Flow selector */}
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                Flow Level
              </Text>
              <View style={styles.flowRow}>
                {FLOW_LEVELS.map((f) => (
                  <Pressable
                    key={f}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedFlow(f);
                    }}
                    style={({ pressed }) => [
                      styles.flowChip,
                      {
                        backgroundColor:
                          selectedFlow === f
                            ? FLOW_COLORS[f] + "22"
                            : colors.muted,
                        borderColor:
                          selectedFlow === f ? FLOW_COLORS[f] : colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.flowDot,
                        {
                          backgroundColor:
                            selectedFlow === f
                              ? FLOW_COLORS[f]
                              : colors.mutedForeground,
                          width: f === "Light" ? 8 : f === "Medium" ? 11 : 14,
                          height: f === "Light" ? 8 : f === "Medium" ? 11 : 14,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.flowLabel,
                        {
                          color:
                            selectedFlow === f
                              ? FLOW_COLORS[f]
                              : colors.mutedForeground,
                        },
                      ]}
                    >
                      {f}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <PrimaryButton
                label="Start Period Today"
                onPress={handleStartPeriod}
                loading={loading}
                style={{ marginTop: 8 }}
              />
            </View>
          </>
        )}

        {/* Next period */}
        {predictedNextPeriod && (
          <View
            style={[
              styles.predictCard,
              { backgroundColor: colors.lavenderLight + "66", borderColor: colors.border },
            ]}
          >
            <Feather name="calendar" size={16} color={colors.lavender} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.predictLabel, { color: colors.mutedForeground }]}>
                Predicted Next Period
              </Text>
              <Text style={[styles.predictDate, { color: colors.lavender }]}>
                {formatDate(predictedNextPeriod)}
              </Text>
            </View>
          </View>
        )}

        {/* History */}
        {cycleLogs.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              History
            </Text>
            {cycleLogs.slice(0, 6).map((log) => (
              <View
                key={log.id}
                style={[
                  styles.historyRow,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.flowDot,
                    {
                      backgroundColor: FLOW_COLORS[log.flowLevel],
                      width: 10,
                      height: 10,
                    },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyDate, { color: colors.foreground }]}>
                    {formatDate(log.startDate)}
                    {log.endDate ? ` → ${formatDate(log.endDate)}` : " (ongoing)"}
                  </Text>
                  <Text style={[styles.historyFlow, { color: colors.mutedForeground }]}>
                    {log.flowLevel} flow
                    {log.endDate
                      ? ` · ${Math.ceil((new Date(log.endDate).getTime() - new Date(log.startDate).getTime()) / 86400000)} days`
                      : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  screenSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  body: {
    paddingHorizontal: 16,
    gap: 14,
    marginTop: 16,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  activeBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  activeBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeBannerTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  activeBannerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  flowRow: {
    flexDirection: "row",
    gap: 10,
  },
  flowChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  flowDot: {
    borderRadius: 99,
  },
  flowLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  predictCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  predictLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  predictDate: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  historyDate: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  historyFlow: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
