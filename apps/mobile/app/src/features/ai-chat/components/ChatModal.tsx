import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { useMutation, useQuery } from "convex/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text, useTheme, TamaguiProvider, Theme } from "tamagui";
import tw from "twrnc";
import { config as tamaguiConfig } from "@tamagui/config";
import { useAppTheme } from "@/theme/AppThemeProvider";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { streamChat, buildMessages, type ChatMessage, DEFAULT_MODEL } from "@/lib/ai/chat";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ChatModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const { theme: appTheme } = useAppTheme();
  const theme = useTheme();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<Id<"aiConversations"> | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  const createConversation = useMutation(api.aiChat.createConversation);
  const addMessage = useMutation(api.aiChat.addMessage);

  const conversations = useQuery(api.aiChat.getConversations, user ? { userId: user.id } : "skip");

  const convexMessages = useQuery(
    api.aiChat.getMessages,
    activeConversationId ? { conversationId: activeConversationId } : "skip",
  );

  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0]._id);
    }
  }, [conversations, activeConversationId]);

  useEffect(() => {
    if (convexMessages && convexMessages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [convexMessages]);

  useEffect(() => {
    if (streamingContent.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [streamingContent]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !user || isSending) return;

    setIsSending(true);
    const userMessage = input.trim();
    setInput("");
    setStreamingContent("");

    try {
      let conversationId = activeConversationId;

      if (!conversationId) {
        conversationId = await createConversation({
          userId: user.id,
          title: userMessage.slice(0, 20),
        });
        setActiveConversationId(conversationId);
      }

      await addMessage({
        conversationId,
        content: userMessage,
        role: "user",
      });

      const history: ChatMessage[] = (convexMessages ?? [])
        .filter((msg: any) => msg.role === "user" || msg.role === "assistant")
        .map((msg: any) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));

      const chatMessages = buildMessages(userMessage, history);

      let fullContent = "";

      await streamChat(
        chatMessages,
        DEFAULT_MODEL,
        false,
        {
          onContent: (text) => {
            fullContent += text;
            setStreamingContent(fullContent);
          },
          onError: (error) => {
            console.error("AI stream error:", error);
            setIsSending(false);
            setStreamingContent("");
          },
          onComplete: async () => {
            if (conversationId && fullContent) {
              try {
                await addMessage({
                  conversationId,
                  content: fullContent,
                  role: "assistant",
                });
              } catch (err) {
                console.error("Failed to save assistant message:", err);
              }
            }
            setStreamingContent("");
            setIsSending(false);
          },
        },
      );
    } catch (error) {
      console.error("Failed to send message:", error);
      setIsSending(false);
      setStreamingContent("");
    }
  }, [input, user, isSending, activeConversationId, createConversation, addMessage, convexMessages]);

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setStreamingContent("");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <Theme name={appTheme}>
          <View style={tw`flex-1 bg-black/40`}>
            <Pressable style={tw`flex-1`} onPress={onClose} />
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={{
                backgroundColor: theme.background.val,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                overflow: "hidden",
              }}
            >
              <View style={{ height: "85%", paddingBottom: insets.bottom, backgroundColor: theme.background.val }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: theme.borderColor.val,
                  }}
                >
                  <View style={tw`flex-row items-center gap-2`}>
                    <View
                      style={[
                        tw`w-8 h-8 rounded-full items-center justify-center`,
                        { backgroundColor: theme.backgroundHover.val },
                      ]}
                    >
                      <Ionicons name="sparkles" size={18} color={theme.primary.val} />
                    </View>
                    <Text style={[tw`text-lg font-bold`, { color: theme.color.val }]}>
                      {t("AI.aiConversation")}
                    </Text>
                  </View>
                  <View style={tw`flex-row items-center gap-3`}>
                    <Pressable
                      onPress={handleNewConversation}
                      style={[
                        tw`p-1 rounded-full`,
                        { backgroundColor: theme.backgroundHover.val },
                      ]}
                    >
                      <Ionicons name="add" size={24} color={theme.placeholderColor.val} />
                    </Pressable>
                    <Pressable onPress={onClose} style={tw`p-1`}>
                      <Ionicons name="close" size={24} color={theme.placeholderColor.val} />
                    </Pressable>
                  </View>
                </View>

                <ScrollView
                  ref={scrollViewRef}
                  style={tw`flex-1 px-4`}
                  contentContainerStyle={tw`py-4 gap-4`}
                >
                  {convexMessages?.map((msg: any) => (
                    <View
                      key={msg._id}
                      style={tw`flex-row ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <View
                        style={[
                          tw`max-w-[85%] px-4 py-2.5 rounded-2xl`,
                          msg.role === "user"
                            ? {
                                backgroundColor: theme.backgroundHover.val,
                                borderTopRightRadius: 0,
                              }
                            : {
                                backgroundColor: theme.backgroundPress.val,
                                borderTopLeftRadius: 0,
                              },
                        ]}
                      >
                        <Text
                          style={[
                            tw`text-[15px] leading-5`,
                            {
                              color: theme.color.val,
                            },
                          ]}
                        >
                          {msg.content}
                        </Text>
                      </View>
                    </View>
                  ))}

                  {streamingContent.length > 0 && (
                    <View style={tw`flex-row justify-start`}>
                      <View
                        style={[
                          tw`max-w-[85%] px-4 py-2.5 rounded-2xl`,
                          {
                            backgroundColor: theme.backgroundPress.val,
                            borderTopLeftRadius: 0,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            tw`text-[15px] leading-5`,
                            {
                              color: theme.color.val,
                            },
                          ]}
                        >
                          {streamingContent}
                        </Text>
                      </View>
                    </View>
                  )}

                  {isSending && streamingContent.length === 0 && (
                    <View style={tw`flex-row justify-start`}>
                      <View
                        style={[
                          tw`px-4 py-2.5 rounded-2xl`,
                          {
                            backgroundColor: theme.backgroundPress.val,
                            borderTopLeftRadius: 0,
                          },
                        ]}
                      >
                        <ActivityIndicator size="small" color={theme.placeholderColor.val} />
                      </View>
                    </View>
                  )}
                </ScrollView>

                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderTopWidth: 1,
                    borderTopColor: theme.borderColor.val,
                  }}
                >
                  <View
                    style={[
                      tw`flex-row items-center rounded-2xl px-3 py-1.5 gap-2`,
                      { backgroundColor: theme.backgroundHover.val },
                    ]}
                  >
                    <TextInput
                      style={[
                        tw`flex-1 min-h-10 text-[16px] py-1`,
                        { color: theme.color.val },
                      ]}
                      placeholder={t("AI.pleaseEnterYourQuestion")}
                      placeholderTextColor={theme.placeholderColor.val}
                      value={input}
                      onChangeText={setInput}
                      multiline
                      maxLength={500}
                    />
                    <Pressable
                      onPress={handleSend}
                      disabled={!input.trim() || isSending}
                      style={({ pressed }) => [
                        tw`w-8 h-8 rounded-full items-center justify-center`,
                        {
                          backgroundColor:
                            input.trim() && !isSending
                              ? theme.primary.val
                              : theme.backgroundPress.val,
                        },
                        pressed ? tw`opacity-80` : null,
                      ]}
                    >
                      <Ionicons name="arrow-up" size={20} color={theme.primaryForeground.val} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Theme>
      </TamaguiProvider>
    </Modal>
  );
}
