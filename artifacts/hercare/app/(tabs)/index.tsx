import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InsightCard } from "@/components/InsightCard";
import { PhaseRing } from "@/components/PhaseRing";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { MOOD_META } from "@/components/MoodChip";
import type { MoodType, SymptomType } from "@/context/AppContext";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getMostCommonMood(moodLogs: { mood: MoodType }[]): MoodType | null {
  if (moodLogs.length === 0) return null;
  const counts: Partial<Record<MoodType, number>> = {};
  moodLogs.forEach((l) => {
    counts[l.mood] = (counts[l.mood] ?? 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as MoodType;
}

function getMostCommonSymptom(symptomLogs: { symptom: SymptomType }[]): SymptomType | null {
  if (symptomLogs.length === 0) return null;
  const counts: Partial<Record<SymptomType, number>> = {};
  symptomLogs.forEach((l) => {
    counts[l.symptom] = (counts[l.symptom] ?? 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] as SymptomType;
}

function generateInsights(
  cycleDay: number | null,
  avgLen: number,
  phase: string,
  moodLogs: { mood: MoodType; date: string }[],
  symptomLogs: { symptom: SymptomType; date: string }[]
): string[] {
  const insights: string[] = [];
  if (avgLen > 0) {
    insights.push(`Your average cycle length is ${avgLen} days.`);
  }
  if (phase === "Luteal" && symptomLogs.some((s) => s.symptom === "Fatigue")) {
    insights.push("You often report fatigue before your period.");
  }
  if (phase === "Menstrual") {
    insights.push("Stay hydrated and rest — your body is working hard.");
  }
  if (phase === "Ovulation") {
    insights.push("Energy levels are typically highest around ovulation.");
  }
  const commonMood = getMostCommonMood(moodLogs);
  if (commonMood === "Anxious" || commonMood === "Stressed") {
    insights.push("Stress management can help regulate your cycle.");
  }
  if (insights.length === 0) {
    insights.push("Log your cycle to get personalized insights.");
  }
  return insights.slice(0, 2);
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    profile,
    cycleLogs,
    moodLogs,
    symptomLogs,
    currentCycleDay,
    daysUntilNextPeriod,
    currentPhase,
    predictedNextPeriod,
    averageCycleLength,
  } = useApp();

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const commonMood = getMostCommonMood(moodLogs);
  const commonSymptom = getMostCommonSymptom(symptomLogs);
  const insights = generateInsights(
    currentCycleDay,
    averageCycleLength,
    currentPhase,
    moodLogs,
    symptomLogs
  );

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <LinearGradient
        colors={[colors.lavenderLight, colors.pinkLight, colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
              {greeting()},
            </Text>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {profile.name} ✨
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/(tabs)/profile")}
            style={({ pressed }) => [
              styles.avatarBtn,
              {
                backgroundColor: colors.lavender,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={styles.avatarText}>
              {profile.name.charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        </View>
      </LinearGradient>

      <View style={styles.body}>
        {/* Phase Ring */}
        <View
          style={[
            styles.ringCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <PhaseRing
            day={currentCycleDay}
            cycleLength={averageCycleLength}
            phase={currentPhase}
          />
          <View style={styles.ringMeta}>
            <Text style={[styles.ringLabel, { color: colors.mutedForeground }]}>
              Next period
            </Text>
            <Text style={[styles.ringValue, { color: colors.foreground }]}>
              {predictedNextPeriod
                ? daysUntilNextPeriod != null && daysUntilNextPeriod >= 0
                  ? `in ${daysUntilNextPeriod} days`
                  : formatDate(predictedNextPeriod)
                : "Log your cycle"}
            </Text>
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <InsightCard
            icon="heart"
            title="Mood"
            value={commonMood ?? "No data"}
            accentColor={colors.pink}
          />
          <InsightCard
            icon="activity"
            title="Top Symptom"
            value={commonSymptom ?? "No data"}
            accentColor={colors.lavender}
          />
        </View>

        {/* Quick Insights */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Quick Insights
          </Text>
          {insights.map((insight, i) => (
            <View
              key={i}
              style={[
                styles.insightRow,
                { backgroundColor: colors.lavenderLight + "66", borderColor: colors.border },
              ]}
            >
              <Feather name="zap" size={14} color={colors.lavender} />
              <Text style={[styles.insightText, { color: colors.foreground }]}>
                {insight}
              </Text>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Track Today
          </Text>
          <View style={styles.quickActions}>
            {[
              { label: "Cycle", icon: "circle" as const, route: "/(tabs)/cycle" as const, color: colors.pink },
              { label: "Mood", icon: "smile" as const, route: "/(tabs)/mood" as const, color: colors.lavender },
              { label: "Symptoms", icon: "activity" as const, route: "/(tabs)/symptoms" as const, color: "#5BAD7F" },
              { label: "AI Chat", icon: "message-circle" as const, route: "/(tabs)/chat" as const, color: "#E8A44A" },
            ].map((action) => (
              <Pressable
                key={action.label}
                onPress={() => router.push(action.route)}
                style={({ pressed }) => [
                  styles.quickAction,
                  {
                    backgroundColor: action.color + "18",
                    borderColor: action.color + "44",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.qaIcon,
                    { backgroundColor: action.color + "22" },
                  ]}
                >
                  <Feather name={action.icon} size={20} color={action.color} />
                </View>
                <Text style={[styles.qaLabel, { color: action.color }]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greeting: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  body: {
    paddingHorizontal: 16,
    gap: 16,
    marginTop: 8,
  },
  ringCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  ringMeta: {
    alignItems: "center",
  },
  ringLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  ringValue: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  insightText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 20,
  },
  quickActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  quickAction: {
    flex: 1,
    minWidth: "42%",
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  qaIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  qaLabel: {
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
});
