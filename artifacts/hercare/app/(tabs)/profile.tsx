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
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, setProfile, cycleLogs, moodLogs, symptomLogs, chatHistory } = useApp();
  const [name, setName] = useState(profile.name);
  const [saved, setSaved] = useState(false);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSave = () => {
    if (!name.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setProfile({ ...profile, name: name.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const stats = [
    { label: "Cycles logged", value: cycleLogs.length, icon: "circle" as const, color: colors.pink },
    { label: "Mood entries", value: moodLogs.length, icon: "smile" as const, color: colors.lavender },
    { label: "Symptoms", value: symptomLogs.length, icon: "activity" as const, color: "#5BAD7F" },
    { label: "AI chats", value: chatHistory.filter((m) => m.role === "user").length, icon: "message-circle" as const, color: "#E8A44A" },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>
          Profile
        </Text>
      </View>

      <View style={styles.body}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: colors.lavender }]}>
            <Text style={styles.avatarText}>
              {profile.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.profileName, { color: colors.foreground }]}>
            {profile.name}
          </Text>
          <Text style={[styles.profileSub, { color: colors.mutedForeground }]}>
            HerCare AI Member
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          {stats.map((s) => (
            <View
              key={s.label}
              style={[
                styles.statCard,
                { backgroundColor: s.color + "14", borderColor: s.color + "33" },
              ]}
            >
              <Feather name={s.icon} size={18} color={s.color} />
              <Text style={[styles.statValue, { color: s.color }]}>
                {s.value}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Edit profile */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Edit Profile
          </Text>
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={[
                styles.input,
                {
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
          <PrimaryButton
            label={saved ? "Saved!" : "Save Changes"}
            onPress={handleSave}
            disabled={!name.trim() || name === profile.name}
          />
        </View>

        {/* Info section */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            About HerCare AI
          </Text>
          {[
            { icon: "shield" as const, text: "Your data is stored locally on your device" },
            { icon: "heart" as const, text: "AI responses are educational, not medical advice" },
            { icon: "lock" as const, text: "No personal data is shared with third parties" },
          ].map((item) => (
            <View key={item.text} style={styles.infoRow}>
              <Feather name={item.icon} size={16} color={colors.lavender} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>

        {/* Version */}
        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          HerCare AI v1.0.0
        </Text>
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
  avatarSection: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFF",
    fontSize: 32,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  profileSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "47%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 4,
    alignItems: "flex-start",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
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
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  infoText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 18,
  },
  version: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingBottom: 8,
  },
});
