import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import type {
  AgeGroup,
  DietType,
  FlowLevel,
  KnownCondition,
  PeriodRegularity,
} from "@/context/AppContext";

const { width } = Dimensions.get("window");

type Chip<T> = { label: string; value: T; emoji?: string };

const REGULARITY_OPTIONS: Chip<PeriodRegularity>[] = [
  { label: "Regular", value: "Regular", emoji: "✅" },
  { label: "Irregular", value: "Irregular", emoji: "〰️" },
  { label: "Very Irregular", value: "Very Irregular", emoji: "❓" },
];

const FLOW_OPTIONS: Chip<FlowLevel>[] = [
  { label: "Light", value: "Light", emoji: "💧" },
  { label: "Medium", value: "Medium", emoji: "💧💧" },
  { label: "Heavy", value: "Heavy", emoji: "💧💧💧" },
];

const CYCLE_LENGTH_OPTIONS: Chip<number>[] = [
  { label: "21–24 days", value: 22 },
  { label: "25–27 days", value: 26 },
  { label: "28–30 days", value: 28 },
  { label: "31–35 days", value: 33 },
  { label: "Unsure", value: 28 },
];

const AGE_OPTIONS: Chip<AgeGroup>[] = [
  { label: "13–17", value: "13-17" },
  { label: "18–24", value: "18-24" },
  { label: "25–34", value: "25-34" },
  { label: "35–44", value: "35-44" },
  { label: "45+", value: "45+" },
];

const CONDITION_OPTIONS: Chip<KnownCondition>[] = [
  { label: "PCOS", value: "PCOS", emoji: "🔬" },
  { label: "Endometriosis", value: "Endometriosis", emoji: "🩺" },
  { label: "Fibroids", value: "Fibroids", emoji: "🩻" },
  { label: "Thyroid", value: "Thyroid", emoji: "⚕️" },
  { label: "None", value: "None", emoji: "✨" },
];

const DIET_OPTIONS: Chip<DietType>[] = [
  { label: "Vegetarian", value: "Vegetarian", emoji: "🥗" },
  { label: "Non-Vegetarian", value: "Non-Vegetarian", emoji: "🍗" },
  { label: "Vegan", value: "Vegan", emoji: "🌱" },
];

const STEPS = [
  { title: "Welcome to\nHerCare AI", subtitle: "Let's set up your personal health profile so we can give you the best recommendations." },
  { title: "Your Period\nPattern", subtitle: "Understanding your cycle helps us predict and personalize your care." },
  { title: "Your Cycle\n& Age", subtitle: "This helps us time your recommendations accurately." },
  { title: "Health\nConditions", subtitle: "Select any conditions you've been diagnosed with. This stays private on your device." },
  { title: "Your Diet\nPreference", subtitle: "We'll suggest Indian foods and recipes that work best for you." },
];

function SelectChip<T extends string | number>({
  option,
  selected,
  onPress,
  multi,
}: {
  option: Chip<T>;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.lavender : colors.muted,
          borderColor: selected ? colors.lavender : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {option.emoji ? (
        <Text style={styles.chipEmoji}>{option.emoji}</Text>
      ) : null}
      <Text
        style={[
          styles.chipLabel,
          { color: selected ? "#FFF" : colors.foreground },
        ]}
      >
        {option.label}
      </Text>
      {multi && selected && (
        <Feather name="check" size={14} color="#FFF" style={{ marginLeft: 4 }} />
      )}
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setHealthProfile } = useApp();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [regularity, setRegularity] = useState<PeriodRegularity | "">("");
  const [flow, setFlow] = useState<FlowLevel | "">("");
  const [cycleLength, setCycleLength] = useState<number>(28);
  const [ageGroup, setAgeGroup] = useState<AgeGroup | "">("");
  const [conditions, setConditions] = useState<KnownCondition[]>([]);
  const [dietType, setDietType] = useState<DietType | "">("");

  const toggleCondition = (c: KnownCondition) => {
    Haptics.selectionAsync();
    if (c === "None") {
      setConditions(["None"]);
      return;
    }
    setConditions((prev) => {
      const without = prev.filter((x) => x !== "None");
      if (without.includes(c)) return without.filter((x) => x !== c);
      return [...without, c];
    });
  };

  const canNext = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return regularity !== "" && flow !== "";
    if (step === 2) return ageGroup !== "";
    if (step === 3) return conditions.length > 0;
    if (step === 4) return dietType !== "";
    return false;
  };

  const handleNext = () => {
    if (!canNext()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < 4) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setHealthProfile({
      name: name.trim(),
      periodRegularity: regularity,
      typicalFlow: flow,
      averageCycleLength: cycleLength,
      ageGroup,
      conditions,
      dietType,
      onboardingComplete: true,
    });
    router.replace("/(tabs)");
  };

  const progress = (step + 1) / 5;

  return (
    <LinearGradient
      colors={[colors.lavenderLight, colors.pinkLight + "88", colors.background]}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: topPad + 24, paddingBottom: bottomPad + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Progress bar */}
        <View style={styles.progressWrap}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                {
                  backgroundColor:
                    i <= step ? colors.lavender : colors.border,
                  width: i === step ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Step heading */}
        <View style={styles.headingWrap}>
          <Text style={[styles.stepTitle, { color: colors.foreground }]}>
            {STEPS[step].title}
          </Text>
          <Text style={[styles.stepSubtitle, { color: colors.mutedForeground }]}>
            {STEPS[step].subtitle}
          </Text>
        </View>

        {/* Step 0: Name */}
        {step === 0 && (
          <View style={styles.stepContent}>
            <View
              style={[
                styles.inputCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                What's your name?
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.muted,
                    color: colors.foreground,
                    borderColor: colors.border,
                  },
                ]}
              />
            </View>
            <View style={[styles.featureList, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { icon: "bar-chart-2" as const, text: "Track your cycle, mood & symptoms" },
                { icon: "cpu" as const, text: "AI-powered Indian diet recommendations" },
                { icon: "shield" as const, text: "All data stays private on your device" },
              ].map((f) => (
                <View key={f.text} style={styles.featureRow}>
                  <View style={[styles.featureIcon, { backgroundColor: colors.lavenderLight }]}>
                    <Feather name={f.icon} size={16} color={colors.lavender} />
                  </View>
                  <Text style={[styles.featureText, { color: colors.foreground }]}>
                    {f.text}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Step 1: Regularity + Flow */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
                How regular are your periods?
              </Text>
              <View style={styles.chipRow}>
                {REGULARITY_OPTIONS.map((o) => (
                  <SelectChip
                    key={o.value}
                    option={o}
                    selected={regularity === o.value}
                    onPress={() => { Haptics.selectionAsync(); setRegularity(o.value); }}
                  />
                ))}
              </View>
            </View>
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
                What is your typical flow?
              </Text>
              <View style={styles.chipRow}>
                {FLOW_OPTIONS.map((o) => (
                  <SelectChip
                    key={o.value}
                    option={o}
                    selected={flow === o.value}
                    onPress={() => { Haptics.selectionAsync(); setFlow(o.value); }}
                  />
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Step 2: Cycle length + Age */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
                How long is your average cycle?
              </Text>
              <View style={styles.chipRow}>
                {CYCLE_LENGTH_OPTIONS.map((o) => (
                  <SelectChip
                    key={o.value}
                    option={o}
                    selected={cycleLength === o.value}
                    onPress={() => { Haptics.selectionAsync(); setCycleLength(o.value); }}
                  />
                ))}
              </View>
            </View>
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
                Your age group
              </Text>
              <View style={styles.chipRow}>
                {AGE_OPTIONS.map((o) => (
                  <SelectChip
                    key={o.value}
                    option={o}
                    selected={ageGroup === o.value}
                    onPress={() => { Haptics.selectionAsync(); setAgeGroup(o.value); }}
                  />
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Step 3: Conditions */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
                Select all that apply
              </Text>
              <View style={styles.chipRow}>
                {CONDITION_OPTIONS.map((o) => (
                  <SelectChip
                    key={o.value}
                    option={o}
                    selected={conditions.includes(o.value)}
                    onPress={() => toggleCondition(o.value)}
                    multi
                  />
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Step 4: Diet */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.foreground }]}>
                Your dietary preference
              </Text>
              <View style={styles.chipRow}>
                {DIET_OPTIONS.map((o) => (
                  <SelectChip
                    key={o.value}
                    option={o}
                    selected={dietType === o.value}
                    onPress={() => { Haptics.selectionAsync(); setDietType(o.value); }}
                  />
                ))}
              </View>
            </View>
            <View style={[styles.infoBox, { backgroundColor: colors.lavenderLight, borderColor: colors.lavender + "44" }]}>
              <Feather name="info" size={16} color={colors.lavender} />
              <Text style={[styles.infoText, { color: colors.lavender }]}>
                We'll suggest Indian foods like dal, sabzi, ghee, and Ayurvedic herbs tailored to your cycle phase.
              </Text>
            </View>
          </View>
        )}

        {/* Navigation */}
        <View style={styles.navRow}>
          {step > 0 && (
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setStep(step - 1); }}
              style={({ pressed }) => [
                styles.backBtn,
                { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="arrow-left" size={20} color={colors.foreground} />
            </Pressable>
          )}
          <Pressable
            onPress={handleNext}
            disabled={!canNext()}
            style={({ pressed }) => [
              styles.nextBtn,
              {
                backgroundColor: canNext() ? colors.lavender : colors.muted,
                opacity: pressed ? 0.85 : 1,
                flex: step > 0 ? 1 : undefined,
              },
            ]}
          >
            <Text style={[styles.nextBtnText, { color: canNext() ? "#FFF" : colors.mutedForeground }]}>
              {step === 4 ? "Get My Plan ✨" : "Continue"}
            </Text>
            {step < 4 && (
              <Feather
                name="arrow-right"
                size={18}
                color={canNext() ? "#FFF" : colors.mutedForeground}
              />
            )}
          </Pressable>
        </View>

        {step === 0 && (
          <Pressable onPress={() => router.replace("/(tabs)")} style={{ alignSelf: "center", marginTop: 12 }}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip for now</Text>
          </Pressable>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    gap: 24,
    flexGrow: 1,
  },
  progressWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progressDot: {
    height: 8,
    borderRadius: 4,
  },
  headingWrap: {
    gap: 8,
  },
  stepTitle: {
    fontSize: 30,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    lineHeight: 36,
  },
  stepSubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  stepContent: {
    gap: 16,
  },
  inputCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  textInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  featureList: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    gap: 6,
  },
  chipEmoji: {
    fontSize: 14,
  },
  chipLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  infoBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  infoText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 19,
  },
  navRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  backBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 28,
    minWidth: 160,
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  skipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textDecorationLine: "underline",
  },
});
