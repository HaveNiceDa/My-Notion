import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { useMutation, useQuery } from "convex/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Dimensions,
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
import {
  streamChat,
  buildMessages,
  type ChatMessage,
  type AIModel,
  DEFAULT_MODEL,
  MODELS_CONFIG,
} from "@/lib/ai/chat";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const MODAL_HEIGHT_RATIO = 0.65;

export function ChatModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const { theme: appTheme } = useAppTheme();
  const theme = useTheme();

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [reasoningContent, setReasoningContent] = useState("");
  const [completedReasoning, setCompletedReasoning] = useState("");
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<Id<"aiConversations"> | null>(null);
  const [selectedModel, setSelectedModel] = useState<AIModel>(DEFAULT_MODEL);
  const [enableThinking, setEnableThinking] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const isCreatingNewRef = useRef(false);

  const scrollViewRef = useRef<ScrollView>(null);

  const createConversation = useMutation(api.aiChat.createConversation);
  const addMessage = useMutation(api.aiChat.addMessage);
  const deleteConversation = useMutation(api.aiChat.deleteConversation);

  const conversations = useQuery(api.aiChat.getConversations, user ? { userId: user.id } : "skip");

  const convexMessages = useQuery(
    api.aiChat.getMessages,
    activeConversationId ? { conversationId: activeConversationId } : "skip",
  );

  useEffect(() => {
    if (
      conversations &&
      conversations.length > 0 &&
      !activeConversationId &&
      !isCreatingNewRef.current
    ) {
      setActiveConversationId(conversations[0]._id);
    }
  }, [conversations, activeConversationId]);

  useEffect(() => {
    if (visible) {
      isCreatingNewRef.current = false;
    }
  }, [visible]);

  useEffect(() => {
    if (convexMessages && convexMessages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [convexMessages]);

  useEffect(() => {
    if (streamingContent.length > 0 || reasoningContent.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, [streamingContent, reasoningContent]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !user || isSending) return;

    setIsSending(true);
    isCreatingNewRef.current = false;
    const userMessage = input.trim();
    setInput("");
    setStreamingContent("");
    setReasoningContent("");
    setCompletedReasoning("");

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
      let fullReasoning = "";

      await streamChat(
        chatMessages,
        selectedModel,
        enableThinking,
        {
          onContent: (text) => {
            fullContent += text;
            setStreamingContent(fullContent);
          },
          onReasoning: (text) => {
            fullReasoning += text;
            setReasoningContent(fullReasoning);
            setReasoningExpanded(true);
          },
          onError: (error) => {
            console.error("AI stream error:", error);
            setIsSending(false);
            setStreamingContent("");
            setReasoningContent("");
          },
          onComplete: async () => {
            if (fullReasoning) {
              setCompletedReasoning(fullReasoning);
              setReasoningContent("");
              setReasoningExpanded(false);
            }
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
      setReasoningContent("");
    }
  }, [input, user, isSending, activeConversationId, createConversation, addMessage, convexMessages, selectedModel, enableThinking]);

  const handleNewConversation = () => {
    isCreatingNewRef.current = true;
    setActiveConversationId(null);
    setStreamingContent("");
    setReasoningContent("");
    setCompletedReasoning("");
    setShowHistory(false);
  };

  const handleSelectConversation = (id: Id<"aiConversations">) => {
    isCreatingNewRef.current = false;
    setActiveConversationId(id);
    setStreamingContent("");
    setReasoningContent("");
    setCompletedReasoning("");
    setShowHistory(false);
  };

  const handleDeleteConversation = async (id: Id<"aiConversations">) => {
    if (!user) return;
    try {
      await deleteConversation({ conversationId: id, userId: user.id });
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setStreamingContent("");
        setReasoningContent("");
        setCompletedReasoning("");
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const screenHeight = Dimensions.get("screen").height;
  const modalHeight = screenHeight * MODAL_HEIGHT_RATIO;

  const currentModelConfig = MODELS_CONFIG.find((m) => m.id === selectedModel);

  const displayReasoning = reasoningContent || completedReasoning;

  const renderHistory = () => (
    <View style={tw`flex-1`}>
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
        <Pressable onPress={() => setShowHistory(false)} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={theme.primary.val} />
        </Pressable>
        <Text style={[tw`text-base font-semibold`, { color: theme.color.val }]}>
          {t("AI.conversationHistory")}
        </Text>
        <View style={tw`w-6`} />
      </View>
      <ScrollView style={tw`flex-1`} contentContainerStyle={tw`py-2`}>
        {conversations && conversations.length > 0 ? (
          conversations.map((conv: any) => (
            <Pressable
              key={conv._id}
              onPress={() => handleSelectConversation(conv._id)}
              style={({ pressed }) => [
                tw`flex-row items-center px-4 py-3 gap-3`,
                pressed ? { backgroundColor: theme.backgroundHover.val } : null,
                activeConversationId === conv._id
                  ? { backgroundColor: theme.backgroundHover.val }
                  : null,
              ]}
            >
              <Ionicons
                name="chatbubble-outline"
                size={18}
                color={theme.placeholderColor.val}
              />
              <Text
                style={[tw`flex-1 text-sm`, { color: theme.color.val }]}
                numberOfLines={1}
              >
                {conv.title}
              </Text>
              <Pressable
                onPress={() => handleDeleteConversation(conv._id)}
                hitSlop={8}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color={theme.placeholderColor.val}
                />
              </Pressable>
            </Pressable>
          ))
        ) : (
          <View style={tw`py-12 items-center`}>
            <Text color="$placeholderColor">{t("AI.noConversationRecords")}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  const renderModelPicker = () => (
    <View
      style={{
        position: "absolute",
        top: 48,
        right: 16,
        width: 220,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.borderColor.val,
        backgroundColor: theme.background.val,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 100,
      }}
    >
      <View style={tw`px-4 py-2.5`}>
        <Text style={[tw`text-xs font-semibold`, { color: theme.placeholderColor.val }]}>
          {t("AI.modelSelect")}
        </Text>
      </View>
      {MODELS_CONFIG.filter((m) => m.enabled).map((model) => (
        <Pressable
          key={model.id}
          onPress={() => {
            setSelectedModel(model.id);
            setShowModelPicker(false);
          }}
          style={({ pressed }) => [
            tw`flex-row items-center justify-between px-4 py-2.5`,
            pressed ? { backgroundColor: theme.backgroundHover.val } : null,
          ]}
        >
          <Text style={[tw`text-sm`, { color: theme.color.val }]}>
            {model.displayName}
          </Text>
          {selectedModel === model.id && (
            <Ionicons name="checkmark" size={18} color={theme.primary.val} />
          )}
        </Pressable>
      ))}
    </View>
  );

  const renderReasoningBubble = () => (
    <View style={tw`flex-row justify-start`}>
      <View
        style={[
          tw`max-w-[85%] rounded-2xl overflow-hidden`,
          {
            backgroundColor: theme.backgroundHover.val,
            borderLeftWidth: 3,
            borderLeftColor: theme.primary.val,
            borderTopLeftRadius: 0,
          },
        ]}
      >
        <Pressable
          onPress={() => setReasoningExpanded(!reasoningExpanded)}
          style={tw`flex-row items-center gap-1.5 px-4 pt-2.5 pb-1`}
        >
          <Ionicons name="bulb-outline" size={14} color={theme.primary.val} />
          <Text style={[tw`text-xs font-semibold flex-1`, { color: theme.primary.val }]}>
            {t("AI.deepThinking")}
          </Text>
          <Ionicons
            name={reasoningExpanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={theme.placeholderColor.val}
          />
        </Pressable>

        {reasoningExpanded && (
          <View
            style={{
              maxHeight: 120,
              paddingHorizontal: 16,
              paddingBottom: 10,
            }}
          >
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <Text
                style={[
                  tw`text-[13px] leading-4`,
                  { color: theme.placeholderColor.val },
                ]}
              >
                {displayReasoning}
              </Text>
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );

  const renderChat = () => (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.borderColor.val,
        }}
      >
        <View style={tw`flex-row items-center gap-2`}>
          <Pressable onPress={() => setShowHistory(true)} hitSlop={8}>
            <Ionicons name="menu-outline" size={22} color={theme.placeholderColor.val} />
          </Pressable>
          <View
            style={[
              tw`w-7 h-7 rounded-full items-center justify-center`,
              { backgroundColor: theme.backgroundHover.val },
            ]}
          >
            <Ionicons name="sparkles" size={15} color={theme.primary.val} />
          </View>
          <Text style={[tw`text-base font-bold`, { color: theme.color.val }]}>
            {t("AI.aiConversation")}
          </Text>
        </View>
        <View style={tw`flex-row items-center gap-2`}>
          <Pressable
            onPress={handleNewConversation}
            style={[
              tw`p-1.5 rounded-full`,
              { backgroundColor: theme.backgroundHover.val },
            ]}
          >
            <Ionicons name="add" size={20} color={theme.placeholderColor.val} />
          </Pressable>
          <Pressable onPress={onClose} style={tw`p-1.5`}>
            <Ionicons name="close" size={20} color={theme.placeholderColor.val} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={tw`flex-1 px-4`}
        contentContainerStyle={tw`py-4 gap-4`}
      >
        {!activeConversationId && !isSending && (!convexMessages || convexMessages.length === 0) && (
          <View style={tw`py-8 items-center gap-3`}>
            <Ionicons name="sparkles-outline" size={40} color={theme.placeholderColor.val} />
            <Text style={[tw`text-lg font-semibold`, { color: theme.color.val }]}>
              {t("AI.todayIWillHelp")}
            </Text>
            <Text style={[tw`text-sm text-center max-w-[80%]`, { color: theme.placeholderColor.val }]}>
              {t("AI.useAIToHandleTasks")}
            </Text>
          </View>
        )}

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

        {displayReasoning.length > 0 && renderReasoningBubble()}

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

        {isSending && streamingContent.length === 0 && displayReasoning.length === 0 && (
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
          paddingVertical: 8,
          borderTopWidth: 1,
          borderTopColor: theme.borderColor.val,
        }}
      >
        <View style={tw`flex-row items-center gap-2 mb-2`}>
          <Pressable
            onPress={() => setShowModelPicker(!showModelPicker)}
            style={[
              tw`flex-row items-center px-2.5 py-1 rounded-full gap-1`,
              { backgroundColor: theme.backgroundHover.val },
            ]}
          >
            <Ionicons name="hardware-chip-outline" size={13} color={theme.placeholderColor.val} />
            <Text style={[tw`text-xs`, { color: theme.placeholderColor.val }]}>
              {currentModelConfig?.displayName ?? "Model"}
            </Text>
            <Ionicons name="chevron-down" size={12} color={theme.placeholderColor.val} />
          </Pressable>

          <Pressable
            onPress={() => setEnableThinking(!enableThinking)}
            style={[
              tw`flex-row items-center px-2.5 py-1 rounded-full gap-1`,
              {
                backgroundColor: enableThinking
                  ? theme.primary.val
                  : theme.backgroundHover.val,
              },
            ]}
          >
            <Ionicons
              name="bulb-outline"
              size={13}
              color={enableThinking ? theme.primaryForeground.val : theme.placeholderColor.val}
            />
            <Text
              style={[
                tw`text-xs`,
                {
                  color: enableThinking
                    ? theme.primaryForeground.val
                    : theme.placeholderColor.val,
                },
              ]}
            >
              {t("AI.deepThinking")}
            </Text>
          </Pressable>
        </View>

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

      {showModelPicker && renderModelPicker()}
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <Theme name={appTheme}>
          <View style={tw`flex-1`}>
            <Pressable
              style={{ flex: 1 }}
              onPress={() => {
                if (showModelPicker) {
                  setShowModelPicker(false);
                } else {
                  onClose();
                }
              }}
            />
            <View
              style={{
                height: modalHeight,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.25,
                shadowRadius: 12,
                elevation: 24,
              }}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{
                  backgroundColor: theme.background.val,
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  overflow: "hidden",
                  height: modalHeight,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    paddingBottom: insets.bottom,
                    backgroundColor: theme.background.val,
                  }}
                >
                  {showHistory ? renderHistory() : renderChat()}
                </View>
              </KeyboardAvoidingView>
            </View>
          </View>
        </Theme>
      </TamaguiProvider>
    </Modal>
  );
}
