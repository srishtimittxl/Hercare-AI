import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { fetch as expoFetch } from "expo/fetch";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { discoverWorkingApiBase, resolveApiBase } from "@/utils/api";
import type { ChatMessage } from "@/context/AppContext";

const SESSION_STORAGE_KEY = "hercare_chat_session_id";

export const API_BASE = resolveApiBase();

function createSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function parseSseLines(
  lines: string[],
  onDelta: (deltaText: string) => void
): boolean {
  let sawDone = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data) continue;
    if (data === "[DONE]") {
      sawDone = true;
      continue;
    }
    try {
      const parsed = JSON.parse(data);
      const delta = parsed.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        onDelta(delta);
      }
    } catch {}
  }
  return sawDone;
}



function MessageBubble({ message }: { message: ChatMessage }) {
  const colors = useColors();
  const isUser = message.role === "user";

  return (
    <View
      style={[
        styles.bubbleWrap,
        { justifyContent: isUser ? "flex-end" : "flex-start" },
      ]}
    >
      {!isUser && (
        <View
          style={[styles.avatar, { backgroundColor: colors.lavenderLight }]}
        >
          <Feather name="heart" size={14} color={colors.lavender} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.lavender, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
          { maxWidth: "80%" },
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            { color: isUser ? "#FFF" : colors.foreground },
          ]}
        >
          {message.content}
        </Text>
        <Text
          style={[
            styles.bubbleTime,
            { color: isUser ? "rgba(255,255,255,0.65)" : colors.mutedForeground },
          ]}
        >
          {new Date(message.timestamp).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    chatHistory,
    addChatMessage,
    clearChatHistory,
    currentPhase,
    healthProfile,
  } = useApp();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  const [connectionState, setConnectionState] = useState<
    "checking" | "online" | "offline"
  >("checking");
  const [activeApiBase, setActiveApiBase] = useState<string>(API_BASE);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const checkBackendConnection = useCallback(async () => {
    setConnectionState("checking");
    try {
      const { online, baseUrl } = await discoverWorkingApiBase();
      setActiveApiBase(baseUrl);
      if (online) {
        setConnectionState("online");
        setErrorBanner(null);
      } else {
        setConnectionState("offline");
      }
    } catch {
      setConnectionState("offline");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const storedSession = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
        if (storedSession) {
          setSessionId(storedSession);
        } else {
          const freshId = createSessionId();
          setSessionId(freshId);
          await AsyncStorage.setItem(SESSION_STORAGE_KEY, freshId);
        }
      } catch {
        setSessionId(createSessionId());
      }
    })();
    checkBackendConnection();
  }, [checkBackendConnection]);

  const handleClearChat = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const oldSessionId = sessionId;
    const nextSessionId = createSessionId();
    setSessionId(nextSessionId);
    setErrorBanner(null);
    clearChatHistory();
    try {
      await AsyncStorage.setItem(SESSION_STORAGE_KEY, nextSessionId);
      if (oldSessionId) {
        const base = activeApiBase || resolveApiBase();
        await globalThis.fetch(
          `${base}/api/chat/session/${encodeURIComponent(oldSessionId)}`,
          { method: "DELETE" }
        );
      }
    } catch {}
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput("");
    setLoading(true);
    setStreamingText("");
    setErrorBanner(null);

    let activeSessionId = sessionId;
    if (!activeSessionId) {
      activeSessionId = createSessionId();
      setSessionId(activeSessionId);
      try {
        await AsyncStorage.setItem(SESSION_STORAGE_KEY, activeSessionId);
      } catch {}
    }

    const userMsg: Omit<ChatMessage, "id"> = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    addChatMessage(userMsg);

    const messages = [
      ...chatHistory.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];

    let targetBase = activeApiBase || resolveApiBase();
    if (connectionState !== "online") {
      const discovered = await discoverWorkingApiBase();
      targetBase = discovered.baseUrl;
      setActiveApiBase(discovered.baseUrl);
      if (discovered.online) {
        setConnectionState("online");
      }
    }

    const requestPayload = {
      messages,
      session_id: activeSessionId,
      cycle_phase:
        currentPhase && currentPhase !== "Unknown"
          ? currentPhase
          : undefined,
      dietary_preference: healthProfile.dietType || undefined,
    };

    try {
      let response: Response;
      try {
        response = (await expoFetch(`${targetBase}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            ...requestPayload,
            stream: true,
          }),
        })) as unknown as Response;
      } catch {
        response = await globalThis.fetch(`${targetBase}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            ...requestPayload,
            stream: false,
          }),
        });
      }

      if (!response.ok) {
        let errMsg =
          "AI Chat failed to respond. Please make sure the server is configured properly.";
        try {
          const errJson = (await response.json()) as {
            error?: string;
            detail?: string;
          };
          if (errJson.detail) {
            try {
              const detailObj = JSON.parse(errJson.detail) as {
                error?: { message?: string };
              };
              if (detailObj.error?.message) {
                errMsg = detailObj.error.message;
              } else {
                errMsg = errJson.detail;
              }
            } catch {
              errMsg = errJson.detail;
            }
          } else if (errJson.error) {
            errMsg = errJson.error;
          }
        } catch {}
        setErrorBanner(errMsg);
        addChatMessage({
          role: "assistant",
          content: `⚠️ API Error: ${errMsg}`,
          timestamp: new Date().toISOString(),
        });
        setLoading(false);
        return;
      }

      setConnectionState("online");
      let accumulated = "";

      if (response.body && typeof response.body.getReader === "function") {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let lineBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";
          parseSseLines(lines, (delta) => {
            accumulated += delta;
            setStreamingText(accumulated);
          });
        }

        if (lineBuffer.trim()) {
          parseSseLines([lineBuffer], (delta) => {
            accumulated += delta;
            setStreamingText(accumulated);
          });
        }
      } else {
        const rawText = await response.text();
        if (rawText.includes("data:")) {
          parseSseLines(rawText.split("\n"), (delta) => {
            accumulated += delta;
          });
        } else {
          try {
            const parsedJson = JSON.parse(rawText) as { response?: string };
            if (parsedJson.response) {
              accumulated = parsedJson.response;
            }
          } catch {}
        }
      }

      if (accumulated) {
        addChatMessage({
          role: "assistant",
          content: accumulated,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      setConnectionState("offline");
      const connMsg = `Unable to reach HerCare AI server at ${targetBase}. Check that the FastAPI backend is running on port 5001.`;
      setErrorBanner(connMsg);
      addChatMessage({
        role: "assistant",
        content:
          "I'm having trouble connecting right now. Please check your internet connection and try again.",
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
      setStreamingText("");
    }
  };

  const allMessages = streamingText
    ? [
        ...chatHistory,
        {
          id: "streaming",
          role: "assistant" as const,
          content: streamingText,
          timestamp: new Date().toISOString(),
        },
      ]
    : chatHistory;

  const reversed = [...allMessages].reverse();

  const statusDotColor =
    connectionState === "online"
      ? "#5BAD7F"
      : connectionState === "checking"
        ? "#E8A44A"
        : "#E8689A";

  const statusText =
    connectionState === "online"
      ? "Your health companion · Online"
      : connectionState === "checking"
        ? "Connecting to HerCare AI..."
        : "Offline · Tap to reconnect";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.headerAvatar,
              { backgroundColor: colors.lavenderLight },
            ]}
          >
            <Feather name="heart" size={18} color={colors.lavender} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              HerCare AI
            </Text>
            <Pressable
              onPress={
                connectionState === "offline"
                  ? checkBackendConnection
                  : undefined
              }
              style={styles.statusRow}
            >
              <View
                style={[styles.statusDot, { backgroundColor: statusDotColor }]}
              />
              <Text
                style={[styles.headerSub, { color: colors.mutedForeground }]}
              >
                {statusText}
              </Text>
            </Pressable>
          </View>
        </View>
        {chatHistory.length > 0 && (
          <Pressable
            onPress={handleClearChat}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Feather name="trash-2" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {errorBanner && (
        <Pressable
          onPress={checkBackendConnection}
          style={[
            styles.errorBanner,
            {
              backgroundColor: colors.pinkLight,
              borderColor: colors.pink + "55",
            },
          ]}
        >
          <Feather name="alert-circle" size={15} color={colors.pink} />
          <Text
            style={[styles.errorBannerText, { color: colors.foreground }]}
            numberOfLines={2}
          >
            {errorBanner}
          </Text>
          <Feather name="refresh-cw" size={14} color={colors.pink} />
        </Pressable>
      )}

      {/* Messages */}
      <FlatList
        style={{ flex: 0.8 }}
        ref={flatListRef}
        data={reversed}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        inverted
        contentContainerStyle={[
          styles.messageList,
          { paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          chatHistory.length === 0 && !loading ? (
            <View style={styles.emptyState}>
              <View
                style={[styles.emptyIcon, { backgroundColor: colors.lavenderLight }]}
              >
                <Feather name="message-circle" size={28} color={colors.lavender} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Ask me anything
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                I can help with menstrual health, PMS, nutrition, exercise, and PCOS awareness.
              </Text>
              {[
                "What causes cramps during my period?",
                "What should I eat during my luteal phase?",
                "What are the signs of PCOS?",
              ].map((q) => (
                <Pressable
                  key={q}
                  onPress={() => setInput(q)}
                  style={({ pressed }) => [
                    styles.suggestionChip,
                    {
                      backgroundColor: colors.lavenderLight + "88",
                      borderColor: colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.suggestionText, { color: colors.lavender }]}>
                    {q}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null
        }
      />

      {/* Input */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: bottomPad + 8,
          },
        ]}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your health..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[
            styles.textInput,
            {
              backgroundColor: colors.muted,
              color: colors.foreground,
              borderColor: colors.border,
            },
          ]}
          onSubmitEditing={sendMessage}
        />
        <Pressable
          onPress={sendMessage}
          disabled={!input.trim() || loading}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: input.trim() && !loading ? colors.lavender : colors.muted,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Feather
              name="send"
              size={18}
              color={input.trim() ? "#FFF" : colors.mutedForeground}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexGrow: 1,
  },
  bubbleWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 10,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    padding: 12,
    borderRadius: 18,
    gap: 4,
  },
  bubbleText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  bubbleTime: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  emptySub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
  suggestionChip: {
    alignSelf: "stretch",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
