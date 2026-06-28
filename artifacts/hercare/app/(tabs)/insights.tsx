import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import React, { useState, useEffect } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MOOD_META } from "@/components/MoodChip";
import { SYMPTOM_ICONS } from "@/components/SymptomChip";
import { useApp } from "@/context/AppContext";
import type { MoodType, SymptomType } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const PHASE_DETAILS: Record<
  string,
  {
    title: string;
    avatar: "droplet" | "sun" | "zap" | "moon" | "help-circle";
    dosha: string;
    doshaDesc: string;
    hormones: { estrogen: number; progesterone: number; lh: number };
    focus: string;
    challenge: string;
  }
> = {
  Menstrual: {
    title: "Menstrual Phase",
    avatar: "droplet",
    dosha: "Vata (Air & Space)",
    doshaDesc: "During menstruation, Vata energy flows downward. Focus on nourishing warm foods, grounding practices, and deep rest.",
    hormones: { estrogen: 15, progesterone: 10, lh: 10 },
    focus: "Rest & Reflection 🌸",
    challenge: "Enjoy 10 minutes of restorative stretching or breathing."
  },
  Follicular: {
    title: "Follicular Phase",
    avatar: "sun",
    dosha: "Kapha (Water & Earth)",
    doshaDesc: "Stamina and planning rise as Kapha dominates. Build your energy with light, fresh, fiber-rich foods.",
    hormones: { estrogen: 65, progesterone: 15, lh: 20 },
    focus: "Strength & Planning 📝",
    challenge: "Plan your weekly goals and do a 15-minute energetic walk."
  },
  Ovulation: {
    title: "Ovulatory Phase",
    avatar: "zap",
    dosha: "Kapha to Pitta shift",
    doshaDesc: "Estrogen peaking causes high confidence and physical stamina. You are at your most social and vibrant!",
    hormones: { estrogen: 95, progesterone: 20, lh: 90 },
    focus: "Action & Connection ⚡",
    challenge: "Try a high-energy workout or reach out to a friend."
  },
  Luteal: {
    title: "Luteal Phase",
    avatar: "moon",
    dosha: "Pitta (Fire & Water)",
    doshaDesc: "Pitta warming causes body temperature to rise. Shift to calming, grounding routines to ease PMS symptoms.",
    hormones: { estrogen: 45, progesterone: 80, lh: 10 },
    focus: "Comfort & Grounding 🧘‍♀️",
    challenge: "Drink a cup of chamomile tea and sleep 15 mins earlier."
  },
  Unknown: {
    title: "Awaiting Data",
    avatar: "help-circle",
    dosha: "Vata / Kapha / Pitta",
    doshaDesc: "Log your period start date on the Home tab to identify your current Ayurvedic phase profile.",
    hormones: { estrogen: 10, progesterone: 10, lh: 10 },
    focus: "Log your Cycle",
    challenge: "Record your period start date to unlock your first challenge!"
  }
};

export default function InsightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    cycleLogs,
    moodLogs,
    symptomLogs,
    currentPhase,
    averageCycleLength,
    daysUntilNextPeriod,
  } = useApp();

  const [challengeCompleted, setChallengeCompleted] = useState(false);

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const activePhase = currentPhase && PHASE_DETAILS[currentPhase] ? currentPhase : "Unknown";
  const details = PHASE_DETAILS[activePhase];

  const topMood =
    moodLogs.length > 0
      ? moodLogs[moodLogs.length - 1].mood
      : "No data";

  const topSymptom =
    symptomLogs.length > 0
      ? symptomLogs[symptomLogs.length - 1].symptom
      : "No data";

  const isMoodType = (m: string): m is MoodType => {
    return m in MOOD_META;
  };

  const isSymptomType = (s: string): s is SymptomType => {
    return s in SYMPTOM_ICONS;
  };

  const moodMeta = topMood && isMoodType(topMood) ? MOOD_META[topMood] : null;
  const symptomIconName = topSymptom && isSymptomType(topSymptom) ? SYMPTOM_ICONS[topSymptom] : null;

  const stats = [
    { label: "Cycles", value: cycleLogs.length, icon: "calendar" as const, color: colors.pink },
    { label: "Moods", value: moodLogs.length, icon: "smile" as const, color: colors.lavender },
    { label: "Symptoms", value: symptomLogs.length, icon: "activity" as const, color: "#5BAD7F" },
  ];

  const PHASES_LIST = [
    { key: "Menstrual", label: "Menstrual", color: colors.pink },
    { key: "Follicular", label: "Follicular", color: colors.lavender },
    { key: "Ovulation", label: "Ovulatory", color: "#E09045" },
    { key: "Luteal", label: "Luteal", color: "#8E5F97" },
  ];

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const val = await AsyncStorage.getItem(`hercare_challenge_${activePhase}_${today}`);
        setChallengeCompleted(val === "true");
      } catch {}
    })();
  }, [activePhase]);

  const handleToggleChallenge = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const nextVal = !challengeCompleted;
    setChallengeCompleted(nextVal);
    try {
      const today = new Date().toISOString().split("T")[0];
      await AsyncStorage.setItem(`hercare_challenge_${activePhase}_${today}`, nextVal ? "true" : "false");
    } catch {}
  };

  const getAyurvedicAdvice = () => {
    if (cycleLogs.length === 0) {
      return "Log your menstrual cycle on the Home tab to activate your Ayurvedic Body Map. Recording your cycle helps calculations and aligns your routine with your body's natural clock.";
    }

    const recentSymptomNames = symptomLogs.slice(-5).map(l => l.symptom.toLowerCase());
    const recentMoodNames = moodLogs.slice(-5).map(l => l.mood.toLowerCase());

    if (recentSymptomNames.includes("cramps") || recentSymptomNames.includes("back pain")) {
      return "🌸 Ayurvedic Cramp Remedy: Since cramps and lower back pain are driven by excess Vata (cold/dry energy), enjoy warm ginger and ajwain tea. Applying warm sesame oil on your lower abdomen helps relax the muscles.";
    }
    if (recentSymptomNames.includes("bloating") || recentSymptomNames.includes("fatigue")) {
      return "🍵 Digestive Balance: Bloating and heaviness signify low digestive fire (Agni). Sip hot cumin-coriander-fennel (CCF) tea throughout the day, and avoid cold drinks and raw foods.";
    }
    if (recentMoodNames.includes("irritated") || recentMoodNames.includes("anxious") || recentMoodNames.includes("stressed")) {
      return "🌿 Pitta/Vata Calming: Irritability and emotional sensitivity call for soothing Pitta remedies. Drink warm milk with a pinch of nutmeg before bed, or rub a drop of coconut oil on your temples.";
    }
    if (recentSymptomNames.includes("headache") || recentSymptomNames.includes("acne")) {
      return "🥥 Cooling Therapy: Breakouts and headaches indicate rising Pitta heat. Focus on cooling foods like cucumber, coconut water, and cilantro, and avoid spicy or fried foods.";
    }

    if (activePhase === "Menstrual") {
      return "🧘‍♀️ Menstrual Phase Care: Your body is letting go. Avoid intense exercises and opt for gentle walks or stretching. Feed your body warm khichdi with a teaspoon of ghee to nourish Vata.";
    }
    if (activePhase === "Follicular") {
      return "🥗 Follicular Vitality: Kapha is building. Fuel your rising stamina with bitter, astringent, and leafy green vegetables. Great time to kick off new workout routines!";
    }
    if (activePhase === "Ovulation") {
      return "🌟 Peak Energy: Estrogen and LH are surging. Share your high social energy with family and friends. Support your skin and metabolism with light, cooling fruits like melons and sweet berries.";
    }
    if (activePhase === "Luteal") {
      return "🍂 Luteal Grounding: Progesterone is high, making your digestive fire variable. Favor easy-to-digest soups, cooked grains, and roasted root vegetables. Keep stressors low.";
    }

    return "✨ Daily Health Insight: Continue logging your symptoms and feelings daily! HerCare AI analyzes these patterns to offer customized home remedies matching your monthly rhythm.";
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>
          Insights
        </Text>
      </View>

      <View style={styles.body}>
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {stats.map((s) => (
            <View
              key={s.label}
              style={[
                styles.statCard,
                { backgroundColor: s.color + "14", borderColor: s.color + "33" },
              ]}
            >
              <View style={[styles.statIconWrap, { backgroundColor: s.color + "22" }]}>
                <Feather name={s.icon} size={16} color={s.color} />
              </View>
              <Text style={[styles.statValue, { color: s.color }]}>
                {s.value}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Cycle Path visual */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground, marginBottom: 4 }]}>
            Your Cycle Path
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.mutedForeground }]}>
            Current Phase: <Text style={{ color: colors.lavender, fontWeight: "600" }}>{details.title}</Text>
          </Text>

          <View style={styles.pathTrack}>
            {PHASES_LIST.map((item, index) => {
              const isActive = activePhase.toLowerCase().includes(item.key.toLowerCase().slice(0, 5));
              return (
                <View key={item.key} style={styles.pathNode}>
                  <View
                    style={[
                      styles.pathDot,
                      {
                        backgroundColor: isActive ? item.color : colors.muted,
                        borderColor: isActive ? item.color : colors.border,
                      },
                    ]}
                  >
                    {isActive && <Text style={{ fontSize: 10 }}>🌸</Text>}
                  </View>
                  <Text
                    style={[
                      styles.pathLabel,
                      {
                        color: isActive ? colors.foreground : colors.mutedForeground,
                        fontWeight: isActive ? "600" : "400",
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Challenge Mini Card */}
        <Pressable
          onPress={handleToggleChallenge}
          style={({ pressed }) => [
            styles.challengeCard,
            {
              backgroundColor: challengeCompleted ? colors.pinkLight + "33" : colors.card,
              borderColor: challengeCompleted ? colors.pink : colors.border,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={[
                styles.checkbox,
                {
                  backgroundColor: challengeCompleted ? colors.pink : "transparent",
                  borderColor: challengeCompleted ? colors.pink : colors.mutedForeground,
                },
              ]}
            >
              {challengeCompleted && <Feather name="check" size={14} color="#FFF" />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.challengeHeader, { color: colors.pink }]}>
                Today's Wellness Challenge
              </Text>
              <Text
                style={[
                  styles.challengeText,
                  {
                    color: colors.foreground,
                    textDecorationLine: challengeCompleted ? "line-through" : "none",
                  },
                ]}
              >
                {details.challenge}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Phase Details & Hormone Bars */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
            <Feather name={details.avatar} size={18} color={colors.lavender} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Hormone & Dosha Profile
            </Text>
          </View>

          <View style={styles.doshaSection}>
            <Text style={[styles.doshaHeader, { color: colors.lavender }]}>
              Ayurvedic Element: {details.dosha}
            </Text>
            <Text style={[styles.doshaText, { color: colors.mutedForeground }]}>
              {details.doshaDesc}
            </Text>
          </View>

          <View style={styles.hormoneList}>
            <Text style={[styles.hormoneTitle, { color: colors.foreground }]}>
              Relative Hormone Levels
            </Text>

            {/* Estrogen */}
            <View style={styles.hormoneRow}>
              <View style={styles.hormoneLabelRow}>
                <Text style={[styles.hormoneLabel, { color: colors.mutedForeground }]}>Estrogen</Text>
                <Text style={[styles.hormoneVal, { color: colors.pink }]}>{details.hormones.estrogen}%</Text>
              </View>
              <View style={[styles.barBg, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${details.hormones.estrogen}%`, backgroundColor: colors.pink },
                  ]}
                />
              </View>
            </View>

            {/* Progesterone */}
            <View style={styles.hormoneRow}>
              <View style={styles.hormoneLabelRow}>
                <Text style={[styles.hormoneLabel, { color: colors.mutedForeground }]}>Progesterone</Text>
                <Text style={[styles.hormoneVal, { color: colors.lavender }]}>{details.hormones.progesterone}%</Text>
              </View>
              <View style={[styles.barBg, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${details.hormones.progesterone}%`, backgroundColor: colors.lavender },
                  ]}
                />
              </View>
            </View>

            {/* LH */}
            <View style={styles.hormoneRow}>
              <View style={styles.hormoneLabelRow}>
                <Text style={[styles.hormoneLabel, { color: colors.mutedForeground }]}>Luteinizing Hormone (LH)</Text>
                <Text style={[styles.hormoneVal, { color: "#E09045" }]}>{details.hormones.lh}%</Text>
              </View>
              <View style={[styles.barBg, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${details.hormones.lh}%`, backgroundColor: "#E09045" },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Latest Patterns */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
            <Feather name="trending-up" size={16} color={colors.lavender} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              Latest Patterns
            </Text>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.patternLeft}>
              <Feather
                name={moodMeta ? moodMeta.icon : "smile"}
                size={16}
                color={moodMeta ? moodMeta.color : colors.mutedForeground}
              />
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                Recent Mood
              </Text>
            </View>
            <Text style={[styles.detailValue, { color: moodMeta ? moodMeta.color : colors.foreground }]}>
              {topMood}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.patternLeft}>
              <Feather
                name={symptomIconName || "activity"}
                size={16}
                color={symptomIconName ? colors.pink : colors.mutedForeground}
              />
              <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                Recent Symptom
              </Text>
            </View>
            <Text style={[styles.detailValue, { color: colors.foreground }]}>
              {topSymptom}
            </Text>
          </View>
        </View>

        {/* AI Health Insight */}
        <View style={[styles.insightCard, { backgroundColor: colors.lavenderLight, borderColor: colors.lavender + "44" }]}>
          <View style={styles.insightHeader}>
            <View style={[styles.insightIconWrap, { backgroundColor: colors.lavender }]}>
              <Feather name="cpu" size={20} color="#FFF" />
            </View>
            <Text style={[styles.insightTitle, { color: colors.foreground }]}>
              Ayurvedic Daily AI Tips
            </Text>
          </View>
          <Text style={[styles.insightText, { color: colors.foreground }]}>
            {getAyurvedicAdvice()}
          </Text>
        </View>
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
  body: {
    paddingHorizontal: 16,
    gap: 16,
    marginTop: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    paddingBottom: 10,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  cardSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  patternLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    alignItems: "center",
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  insightCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  insightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  insightIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  insightText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  pathTrack: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingHorizontal: 8,
    position: "relative",
  },
  pathNode: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  pathDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pathLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  challengeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  challengeHeader: {
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  challengeText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  doshaSection: {
    gap: 4,
  },
  doshaHeader: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  doshaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  hormoneList: {
    gap: 12,
    marginTop: 6,
  },
  hormoneTitle: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  hormoneRow: {
    gap: 5,
  },
  hormoneLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  hormoneLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  hormoneVal: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  barBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
});