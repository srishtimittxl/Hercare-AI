import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setupAllNotifications, disableAllNotifications } from "@/utils/notifications";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    profile,
    setProfile,
    healthProfile,
    cycleLogs,
    moodLogs,
    symptomLogs,
    chatHistory,
    predictedNextPeriod,
  } = useApp();
  const [name, setName] = useState(healthProfile.name || profile.name);
  const [saved, setSaved] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("hercare_notifications");
        if (stored === "true") setNotificationsEnabled(true);
      } catch {}
    })();
  }, []);

  const handleToggleNotifications = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotificationsEnabled(value);
    try {
      await AsyncStorage.setItem("hercare_notifications", value ? "true" : "false");
      if (value) {
        const success = await setupAllNotifications(
          healthProfile.name || profile.name,
          predictedNextPeriod
        );
        if (!success) {
          setNotificationsEnabled(false);
          await AsyncStorage.setItem("hercare_notifications", "false");
        }
      } else {
        await disableAllNotifications();
      }
    } catch {}
  };
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

  const displayName = healthProfile.name || profile.name;

  const profileDetails = healthProfile.onboardingComplete
    ? [
        { label: "Period regularity", value: healthProfile.periodRegularity || "—", icon: "refresh-cw" as const },
        { label: "Typical flow", value: healthProfile.typicalFlow || "—", icon: "droplet" as const },
        { label: "Avg cycle length", value: healthProfile.averageCycleLength ? `${healthProfile.averageCycleLength} days` : "—", icon: "calendar" as const },
        { label: "Age group", value: healthProfile.ageGroup || "—", icon: "user" as const },
        { label: "Diet type", value: healthProfile.dietType || "—", icon: "coffee" as const },
        {
          label: "Conditions",
          value: healthProfile.conditions?.length > 0 ? healthProfile.conditions.join(", ") : "None",
          icon: "heart" as const,
        },
      ]
    : [];

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
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.profileName, { color: colors.foreground }]}>
            {displayName}
          </Text>
          <Text style={[styles.profileSub, { color: colors.mutedForeground }]}>
            {healthProfile.ageGroup ? `Age ${healthProfile.ageGroup} · ` : ""}HerCare AI Member
          </Text>
          {healthProfile.onboardingComplete && (
            <View style={[styles.dietBadge, { backgroundColor: colors.lavenderLight, borderColor: colors.lavender + "44" }]}>
              <Ionicons name="leaf" size={12} color={colors.lavender} />
              <Text style={[styles.dietBadgeText, { color: colors.lavender }]}>
                {healthProfile.dietType || "Vegetarian"} · {healthProfile.periodRegularity || "Regular"} cycle
              </Text>
            </View>
          )}
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

        {/* Health Profile Details */}
        {healthProfile.onboardingComplete && (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                Health Profile
              </Text>
              <Pressable
                onPress={() => router.push("/onboarding")}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.6 : 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                })}
              >
                <Feather name="edit-2" size={14} color={colors.lavender} />
                <Text style={[styles.editText, { color: colors.lavender }]}>Edit</Text>
              </Pressable>
            </View>
            {profileDetails.map((d) => (
              <View key={d.label} style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <View style={styles.detailLeft}>
                  <Feather name={d.icon} size={14} color={colors.lavender} />
                  <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>
                    {d.label}
                  </Text>
                </View>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>
                  {d.value}
                </Text>
              </View>
            ))}
          </View>
        )}

        {!healthProfile.onboardingComplete && (
          <Pressable
            onPress={() => router.push("/onboarding")}
            style={({ pressed }) => [
              styles.onboardingCta,
              {
                backgroundColor: colors.lavenderLight,
                borderColor: colors.lavender + "44",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={[styles.onboardingCtaIcon, { backgroundColor: colors.lavender }]}>
              <Feather name="cpu" size={20} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.onboardingCtaTitle, { color: colors.foreground }]}>
                Set up your health profile
              </Text>
              <Text style={[styles.onboardingCtaSub, { color: colors.mutedForeground }]}>
                Get personalized Indian diet & wellness recommendations
              </Text>
            </View>
            <Feather name="arrow-right" size={18} color={colors.lavender} />
          </Pressable>
        )}

        {/* Edit profile name */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            Edit Name
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
            disabled={!name.trim() || name === (healthProfile.name || profile.name)}
          />
        </View>

        {/* Notifications Setting */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View style={[styles.notificationIconWrap, { backgroundColor: colors.lavenderLight }]}>
                <Feather name="bell" size={18} color={colors.lavender} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>
                  Personalized Reminders
                </Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2, fontFamily: "Inter_400Regular" }}>
                  Get cute alerts for cycle phases and hydration.
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: colors.muted, true: colors.lavender }}
              thumbColor={notificationsEnabled ? "#FFF" : colors.mutedForeground}
            />
          </View>
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
            { icon: "cpu" as const, text: "AI recommendations use Indian diet & Ayurveda" },
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

        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          HerCare AI v1.1.0
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
  dietBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  dietBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
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
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  editText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  detailLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  detailValue: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  onboardingCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  onboardingCtaIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  onboardingCtaTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  onboardingCtaSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
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
  notificationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
