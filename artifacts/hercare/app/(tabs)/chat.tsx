import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetch } from "expo/fetch";
import React, { useRef, useState } from "react";
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
import { KeyboardAvoidingView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import type { ChatMessage } from "@/context/AppContext";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? process.env.EXPO_PUBLIC_DOMAIN.startsWith("http")
    ? process.env.EXPO_PUBLIC_DOMAIN
    : `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";



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
  const { chatHistory, addChatMessage, clearChatHistory } = useApp();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput("");
    setLoading(true);
    setStreamingText("");

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

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        let errMsg = "AI Chat failed to respond. Please make sure the server is configured properly.";
        try {
          const errJson = await response.json() as { error?: string; detail?: string };
          if (errJson.detail) {
            try {
              const detailObj = JSON.parse(errJson.detail) as { error?: { message?: string } };
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
        addChatMessage({
          role: "assistant",
          content: `⚠️ API Error: ${errMsg}`,
          timestamp: new Date().toISOString(),
        });
        setLoading(false);
        return;
      }

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                accumulated += delta;
                setStreamingText(accumulated);
              }
            } catch {}
          }
        }
      }

      if (accumulated) {
        addChatMessage({
          role: "assistant",
          content: accumulated,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      addChatMessage({
        role: "assistant",
        content: "I'm having trouble connecting right now. Please check your internet connection and try again.",
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

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.background, }}
    >
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
          <View style={[styles.headerAvatar, { backgroundColor: colors.lavenderLight }]}>
            <Feather name="heart" size={18} color={colors.lavender} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              HerCare AI
            </Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              Your health companion
            </Text>
          </View>
        </View>
        {chatHistory.length > 0 && (
          <Pressable
            onPress={clearChatHistory}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Feather name="trash-2" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

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
