import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MoodChip, MOOD_META } from "@/components/MoodChip";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import type { MoodType } from "@/context/AppContext";

const MOODS: MoodType[] = [
  "Happy", "Calm", "Motivated", "Sad",
  "Irritated", "Anxious", "Tired", "Stressed",
];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(d: string) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d === todayStr()) return "Today";
  if (d === yesterday.toISOString().split("T")[0]) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function MoodScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { moodLogs, addMoodLog } = useApp();
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const todayLog = moodLogs.find((l) => l.date === todayStr());

  const handleSave = () => {
    if (!selectedMood) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addMoodLog({ mood: selectedMood, notes, date: todayStr() });
    setSelectedMood(null);
    setNotes("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.screenTitle, { color: colors.lavender }]}>
          Mood Tracker
        </Text>
        <Text style={[styles.screenSub, { color: colors.mutedForeground }]}>
          How are you feeling today?
        </Text>
      </View>

      <View style={styles.body}>
        {/* Today's mood */}
        {todayLog ? (
          <View
            style={[
              styles.todayCard,
              { backgroundColor: colors.lavenderLight + "66", borderColor: colors.border },
            ]}
          >
            <Text style={[styles.todayLabel, { color: colors.mutedForeground }]}>
              Today's mood
            </Text>
            <View style={styles.todayMoodRow}>
              <Feather
                name={MOOD_META[todayLog.mood].icon}
                size={22}
                color={MOOD_META[todayLog.mood].color}
              />
              <Text style={[styles.todayMood, { color: MOOD_META[todayLog.mood].color }]}>
                {todayLog.mood}
              </Text>
            </View>
            {todayLog.notes ? (
              <Text style={[styles.todayNotes, { color: colors.mutedForeground }]}>
                "{todayLog.notes}"
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* Mood picker */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {todayLog ? "Log another mood" : "Select your mood"}
          </Text>
          <View style={styles.moodGrid}>
            {MOODS.map((m) => (
              <MoodChip
                key={m}
                mood={m}
                selected={selectedMood === m}
                onPress={() => setSelectedMood(selectedMood === m ? null : m)}
              />
            ))}
          </View>

          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add a note (optional)..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.notesInput,
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
          />

          <PrimaryButton
            label={saved ? "Saved!" : "Save Mood"}
            onPress={handleSave}
            disabled={!selectedMood}
          />
        </View>

        {/* History */}
        {moodLogs.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              History
            </Text>
            {moodLogs.slice(0, 10).map((log) => {
              const meta = MOOD_META[log.mood];
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
                      styles.moodIcon,
                      { backgroundColor: meta.color + "18" },
                    ]}
                  >
                    <Feather name={meta.icon} size={16} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historyMood, { color: meta.color }]}>
                      {log.mood}
                    </Text>
                    {log.notes ? (
                      <Text style={[styles.historyNote, { color: colors.mutedForeground }]}>
                        {log.notes}
                      </Text>
                    ) : null}
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
    gap: 6,
  },
  todayLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  todayMoodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  todayMood: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  todayNotes: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
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
  moodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  notesInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 80,
    textAlignVertical: "top",
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
  moodIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  historyMood: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  historyNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    fontStyle: "italic",
  },
  historyDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
