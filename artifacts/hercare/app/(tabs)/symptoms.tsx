import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SeverityChip, SymptomChip, SYMPTOM_ICONS, SEVERITY_COLORS } from "@/components/SymptomChip";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import type { Severity, SymptomType } from "@/context/AppContext";

const SYMPTOMS: SymptomType[] = [
  "Cramps", "Bloating", "Headache", "Acne",
  "Fatigue", "Back Pain", "Breast Tenderness",
];
const SEVERITIES: Severity[] = ["Mild", "Moderate", "Severe"];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(d: string) {
  const today = todayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split("T")[0];
  if (d === today) return "Today";
  if (d === yStr) return "Yesterday";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function SymptomsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { symptomLogs, addSymptomLog } = useApp();
  const [selectedSymptom, setSelectedSymptom] = useState<SymptomType | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<Severity>("Mild");
  const [saved, setSaved] = useState(false);
  const [customSymptom, setCustomSymptom] = useState("");
  const [isCustomActive, setIsCustomActive] = useState(false);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const todayLogs = symptomLogs.filter((l) => l.date === todayStr());

  const handleSave = () => {
    if (!selectedSymptom || selectedSymptom === "Custom") return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addSymptomLog({
      symptom: selectedSymptom,
      severity: selectedSeverity,
      date: todayStr(),
    });
    setSelectedSymptom(null);
    setCustomSymptom("");
    setIsCustomActive(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.screenTitle, { color: colors.pink }]}>
          Symptom Tracker
        </Text>
        <Text style={[styles.screenSub, { color: colors.mutedForeground }]}>
          Track how your body feels
        </Text>
      </View>

      <View style={styles.body}>
        {/* Today's symptoms */}
        {todayLogs.length > 0 && (
          <View
            style={[
              styles.todayCard,
              { backgroundColor: colors.pinkLight + "66", borderColor: colors.border },
            ]}
          >
            <Text style={[styles.todayLabel, { color: colors.mutedForeground }]}>
              Logged today
            </Text>
            <View style={styles.todayChips}>
              {todayLogs.map((l) => (
                <View
                  key={l.id}
                  style={[
                    styles.todayChip,
                    { backgroundColor: SEVERITY_COLORS[l.severity] + "22", borderColor: SEVERITY_COLORS[l.severity] + "44" },
                  ]}
                >
                  <Feather
                    name={SYMPTOM_ICONS[l.symptom] || "activity"}
                    size={13}
                    color={SEVERITY_COLORS[l.severity]}
                  />
                  <Text style={[styles.todayChipText, { color: SEVERITY_COLORS[l.severity] }]}>
                    {l.symptom} · {l.severity}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Symptom picker */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            What are you experiencing?
          </Text>
          <View style={styles.chipGrid}>
            {SYMPTOMS.map((s) => (
              <SymptomChip
                key={s}
                symptom={s}
                selected={selectedSymptom === s}
                onPress={() => {
                  setSelectedSymptom(selectedSymptom === s ? null : s);
                  setCustomSymptom("");
                  setIsCustomActive(false);
                }}
              />
            ))}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const nextCustom = !isCustomActive;
                setIsCustomActive(nextCustom);
                setSelectedSymptom(nextCustom ? (customSymptom.trim() || "Custom") : null);
              }}
              style={({ pressed }) => [
                styles.customChip,
                {
                  backgroundColor: isCustomActive ? colors.pink + "18" : colors.card,
                  borderColor: isCustomActive ? colors.pink : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather
                name="plus"
                size={16}
                color={isCustomActive ? colors.pink : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.customChipLabel,
                  { color: isCustomActive ? colors.pink : colors.mutedForeground },
                ]}
              >
                Custom
              </Text>
            </Pressable>
          </View>

          {isCustomActive && (
            <TextInput
              value={customSymptom}
              onChangeText={(text) => {
                setCustomSymptom(text);
                setSelectedSymptom(text.trim() || "Custom");
              }}
              placeholder="What other symptom?..."
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.customInput,
                {
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
            />
          )}

          {selectedSymptom && (
            <>
              <Text style={[styles.severityTitle, { color: colors.foreground }]}>
                Severity
              </Text>
              <View style={styles.severityRow}>
                {SEVERITIES.map((sv) => (
                  <SeverityChip
                    key={sv}
                    severity={sv}
                    selected={selectedSeverity === sv}
                    onPress={() => setSelectedSeverity(sv)}
                  />
                ))}
              </View>
            </>
          )}

          <PrimaryButton
            label={saved ? "Saved!" : "Log Symptom"}
            onPress={handleSave}
            disabled={!selectedSymptom}
          />
        </View>

        {/* History */}
        {symptomLogs.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Recent History
            </Text>
            {symptomLogs.slice(0, 10).map((log) => {
              const sColor = SEVERITY_COLORS[log.severity];
              return (
                <View
                  key={log.id}
                  style={[
                    styles.historyRow,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.historyIcon,
                      { backgroundColor: sColor + "18" },
                    ]}
                  >
                    <Feather
                      name={SYMPTOM_ICONS[log.symptom] || "activity"}
                      size={16}
                      color={sColor}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historySymptom, { color: colors.foreground }]}>
                      {log.symptom}
                    </Text>
                    <View style={styles.severityBadgeRow}>
                      <View
                        style={[
                          styles.severityBadge,
                          { backgroundColor: sColor + "22" },
                        ]}
                      >
                        <Text style={[styles.severityBadgeText, { color: sColor }]}>
                          {log.severity}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>
                    {formatDate(log.date)}
                  </Text>
                </View>
              );
            })}
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
  todayCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  todayLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  todayChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  todayChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  todayChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
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
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  severityTitle: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  severityRow: {
    flexDirection: "row",
    gap: 8,
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
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  historySymptom: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Inter_500Medium",
  },
  severityBadgeRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  severityBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  historyDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  customChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  customChipLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  customInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
});
