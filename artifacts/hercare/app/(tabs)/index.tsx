import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { fetch } from "expo/fetch";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? process.env.EXPO_PUBLIC_DOMAIN.startsWith("http")
    ? process.env.EXPO_PUBLIC_DOMAIN
    : `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";


const CATEGORY_COLORS: Record<string, string> = {
  diet: "#5BAD7F",
  exercise: "#E8A44A",
  "self-care": "#9B6B9E",
  supplement: "#E8689A",
};

const CATEGORY_LABELS: Record<string, string> = {
  diet: "Diet",
  exercise: "Exercise",
  "self-care": "Self-Care",
  supplement: "Supplement",
};

type Recommendation = {
  title: string;
  description: string;
  category: string;
  icon: string;
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getMostCommonMood(moodLogs: { mood: MoodType }[]): MoodType | null {
  if (moodLogs.length === 0) return null;
  const counts: Record<string, number> = {};
  moodLogs.forEach((l) => {
    counts[l.mood] = (counts[l.mood] ?? 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function getMostCommonSymptom(symptomLogs: { symptom: SymptomType }[]): SymptomType | null {
  if (symptomLogs.length === 0) return null;
  const counts: Record<string, number> = {};
  symptomLogs.forEach((l) => {
    counts[l.symptom] = (counts[l.symptom] ?? 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    profile,
    healthProfile,
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

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recsError, setRecsError] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    if (!healthProfile.onboardingComplete) return;
    setRecsLoading(true);
    setRecsError(false);
    try {
      const recentMoods = moodLogs.slice(0, 7).map((m) => m.mood);
      const recentSymptoms = symptomLogs
        .slice(0, 7)
        .map((s) => ({ symptom: s.symptom, severity: s.severity }));

      const res = await fetch(`${API_BASE}/api/recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: currentPhase,
          cycleDay: currentCycleDay,
          recentMoods,
          recentSymptoms,
          healthProfile,
        }),
      });
      const data = (await res.json()) as { recommendations: Recommendation[] };
      if (data.recommendations?.length > 0) {
        setRecommendations(data.recommendations);
      }
    } catch {
      setRecsError(true);
    } finally {
      setRecsLoading(false);
    }
  }, [healthProfile, currentPhase, currentCycleDay, moodLogs, symptomLogs]);

  useEffect(() => {
    if (healthProfile.onboardingComplete) {
      fetchRecommendations();
    }
  }, [healthProfile.onboardingComplete, currentPhase]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const displayName = healthProfile.name || profile.name;

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
              {displayName} ✨
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
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        </View>

        {/* Phase badge */}
        {healthProfile.onboardingComplete && currentPhase !== "Unknown" && (
          <View style={[styles.phaseBadge, { backgroundColor: colors.lavender + "22", borderColor: colors.lavender + "55" }]}>
            <View style={[styles.phaseDot, { backgroundColor: colors.lavender }]} />
            <Text style={[styles.phaseText, { color: colors.lavender }]}>
              {currentPhase} Phase
              {healthProfile.periodRegularity ? ` · ${healthProfile.periodRegularity} cycle` : ""}
            </Text>
          </View>
        )}
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

        {/* AI Wellness Recommendations */}
        {healthProfile.onboardingComplete && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Your Wellness Plan
              </Text>
              <Pressable
                onPress={fetchRecommendations}
                disabled={recsLoading}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                {recsLoading ? (
                  <ActivityIndicator size="small" color={colors.lavender} />
                ) : (
                  <Feather name="refresh-cw" size={16} color={colors.lavender} />
                )}
              </Pressable>
            </View>

            {recsLoading && recommendations.length === 0 ? (
              <View style={[styles.recsLoadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator color={colors.lavender} />
                <Text style={[styles.recsLoadingText, { color: colors.mutedForeground }]}>
                  Generating your Indian wellness plan...
                </Text>
              </View>
            ) : recsError && recommendations.length === 0 ? (
              <View style={[styles.recsLoadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="wifi-off" size={20} color={colors.mutedForeground} />
                <Text style={[styles.recsLoadingText, { color: colors.mutedForeground }]}>
                  Could not load recommendations. Tap refresh to retry.
                </Text>
              </View>
            ) : (
              recommendations.map((rec, i) => {
                const catColor = CATEGORY_COLORS[rec.category] ?? colors.lavender;
                const iconName = (rec.icon as keyof typeof Feather.glyphMap) ?? "zap";
                return (
                  <View
                    key={i}
                    style={[
                      styles.recCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: catColor + "33",
                        borderLeftColor: catColor,
                      },
                    ]}
                  >
                    <View style={[styles.recIconWrap, { backgroundColor: catColor + "18" }]}>
                      <Feather name={iconName} size={18} color={catColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.recTitleRow}>
                        <Text style={[styles.recTitle, { color: colors.foreground }]}>
                          {rec.title}
                        </Text>
                        <View style={[styles.recBadge, { backgroundColor: catColor + "22" }]}>
                          <Text style={[styles.recBadgeText, { color: catColor }]}>
                            {CATEGORY_LABELS[rec.category] ?? rec.category}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.recDesc, { color: colors.mutedForeground }]}>
                        {rec.description}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}

            {!recsLoading && recommendations.length === 0 && !recsError && (
              <View style={[styles.recsLoadingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="cpu" size={20} color={colors.lavender} />
                <Text style={[styles.recsLoadingText, { color: colors.mutedForeground }]}>
                  Log your cycle to get personalized recommendations.
                </Text>
              </View>
            )}
          </View>
        )}

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
    gap: 12,
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
  phaseBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  phaseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  phaseText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  recsLoadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
  recsLoadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 20,
  },
  recCard: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    alignItems: "flex-start",
  },
  recIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  recTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  recTitle: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  recBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  recBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  recDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
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
