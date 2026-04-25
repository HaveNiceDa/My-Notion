import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { useMutation, useQuery } from "convex/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ScrollView,
  Text,
  View,
  useTheme,
  TamaguiProvider,
  Theme,
} from "tamagui";
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

  const slideAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 65,
          friction: 14,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (modalVisible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 14,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible]);

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
    <View flex={1}>
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
        <Text fontSize={18} fontWeight="bold" color="$color">
          {t("AI.conversationHistory")}
        </Text>
        <View width={22} />
      </View>
      <ScrollView flex={1} contentContainerStyle={tw`py-2`}>
        {conversations && conversations.length > 0 ? (
          conversations.map((conv: any) => (
            <Pressable
              key={conv._id}
              onPress={() => handleSelectConversation(conv._id)}
              style={({ pressed }) => [
                tw`flex-row items-center px-4 py-3 gap-3`,
                {
                  backgroundColor: pressed
                    ? theme.backgroundHover.val
                    : activeConversationId === conv._id
                      ? theme.backgroundHover.val
                      : "transparent",
                },
              ]}
            >
              <Ionicons name="chatbubble-outline" size={18} color={theme.placeholderColor.val} />
              <Text flex={1} fontSize={14} color="$color" numberOfLines={1}>
                {conv.title}
              </Text>
              <Pressable onPress={() => handleDeleteConversation(conv._id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={theme.placeholderColor.val} />
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
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 8,
        zIndex: 100,
      }}
    >
      <View style={tw`px-4 py-2`}>
        <Text fontSize={11} fontWeight="bold" color="$placeholderColor">
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
            {
              backgroundColor: pressed ? theme.backgroundHover.val : "transparent",
            },
          ]}
        >
          <Text fontSize={14} color="$color">{model.displayName}</Text>
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
        flex={1}
        style={{
          maxWidth: "85%",
          borderRadius: 20,
          borderLeftWidth: 3,
          borderLeftColor: theme.primary.val,
          borderTopLeftRadius: 0,
          backgroundColor: theme.backgroundHover.val,
          overflow: "hidden",
        }}
      >
        <Pressable
          onPress={() => setReasoningExpanded(!reasoningExpanded)}
          style={tw`flex-row items-center gap-1.5 px-3.5 pt-2.5 pb-1`}
        >
          <Ionicons name="bulb-outline" size={14} color={theme.primary.val} />
          <Text flex={1} fontSize={11} fontWeight="bold" color="$primary">
            {t("AI.deepThinking")}
          </Text>
          <Ionicons
            name={reasoningExpanded ? "chevron-up" : "chevron-down"}
            size={14}
            color={theme.placeholderColor.val}
          />
        </Pressable>

        {reasoningExpanded && (
          <View style={[tw`px-3.5 pb-2.5`, { maxHeight: 120 }]}>
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
              <Text fontSize={12} lineHeight={18} color="$placeholderColor">
                {displayReasoning}
              </Text>
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );

  const bubbleStyle = (role: "user" | "assistant") => [
    tw`px-4 py-2.5`,
    {
      maxWidth: "85%",
      borderRadius: 20,
      backgroundColor: role === "user" ? theme.backgroundHover.val : theme.backgroundPress.val,
      borderTopRightRadius: role === "user" ? 0 : undefined,
      borderTopLeftRadius: role === "assistant" ? 0 : undefined,
    },
  ];

  const renderChat = () => (
    <View flex={1}>
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
          <View style={[tw`items-center justify-center`, { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.backgroundHover.val }]}>
            <Ionicons name="sparkles" size={15} color={theme.primary.val} />
          </View>
          <Text fontSize={17} fontWeight="bold" color="$color">
            {t("AI.aiConversation")}
          </Text>
        </View>
        <View style={tw`flex-row items-center gap-2`}>
          <Pressable onPress={handleNewConversation} hitSlop={4}>
            <View style={[tw`items-center justify-center`, { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.backgroundHover.val }]}>
              <Ionicons name="add" size={20} color={theme.placeholderColor.val} />
            </View>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={4}>
            <View style={[tw`items-center justify-center`, { width: 32, height: 32 }]}>
              <Ionicons name="close" size={20} color={theme.placeholderColor.val} />
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        flex={1}
        style={tw`px-4`}
        contentContainerStyle={tw`py-4 gap-4`}
      >
        {!activeConversationId && !isSending && (!convexMessages || convexMessages.length === 0) && (
          <View style={tw`py-8 items-center gap-3`}>
            <Ionicons name="sparkles-outline" size={40} color={theme.placeholderColor.val} />
            <Text fontSize={20} fontWeight="bold" color="$color">
              {t("AI.todayIWillHelp")}
            </Text>
            <Text fontSize={14} color="$placeholderColor" style={{ textAlign: "center", maxWidth: "80%" }}>
              {t("AI.useAIToHandleTasks")}
            </Text>
          </View>
        )}

        {convexMessages?.map((msg: any) => (
          <View
            key={msg._id}
            style={tw`flex-row ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <View style={bubbleStyle(msg.role)}>
              <Text fontSize={15} lineHeight={22} color="$color">
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
                tw`px-4 py-2.5`,
                {
                  maxWidth: "85%",
                  borderRadius: 20,
                  borderTopLeftRadius: 0,
                  backgroundColor: theme.backgroundPress.val,
                },
              ]}
            >
              <Text fontSize={15} lineHeight={22} color="$color">
                {streamingContent}
              </Text>
            </View>
          </View>
        )}

        {isSending && streamingContent.length === 0 && displayReasoning.length === 0 && (
          <View style={tw`flex-row justify-start`}>
            <View style={[tw`px-4 py-2.5`, { borderRadius: 20, borderTopLeftRadius: 0, backgroundColor: theme.backgroundPress.val }]}>
              <ActivityIndicator size="small" color={theme.placeholderColor.val} />
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[tw`px-3 pt-1 pb-0`, { borderTopWidth: 1, borderTopColor: theme.borderColor.val }]}>
        <View style={tw`flex-row items-center gap-2 mb-2`}>
          <Pressable onPress={() => setShowModelPicker(!showModelPicker)}>
            <View
              style={[tw`flex-row items-center gap-1 px-2 py-1 rounded-full`, { backgroundColor: theme.backgroundHover.val }]}
            >
              <Ionicons name="hardware-chip-outline" size={13} color={theme.placeholderColor.val} />
              <Text fontSize={11} color="$placeholderColor">
                {currentModelConfig?.displayName ?? "Model"}
              </Text>
              <Ionicons name="chevron-down" size={12} color={theme.placeholderColor.val} />
            </View>
          </Pressable>

          <Pressable onPress={() => setEnableThinking(!enableThinking)}>
            <View
              style={[
                tw`flex-row items-center gap-1 px-2 py-1 rounded-full`,
                { backgroundColor: enableThinking ? theme.primary.val : theme.backgroundHover.val },
              ]}
            >
              <Ionicons
                name="bulb-outline"
                size={13}
                color={enableThinking ? theme.primaryForeground.val : theme.placeholderColor.val}
              />
              <Text
                fontSize={11}
                color={enableThinking ? "$primaryForeground" : "$placeholderColor"}
              >
                {t("AI.deepThinking")}
              </Text>
            </View>
          </Pressable>
        </View>

        <View
          style={[
            tw`flex-row items-center rounded-2xl`,
            {
              backgroundColor: theme.backgroundHover.val,
              paddingLeft: 0,
              paddingRight: 6,
              paddingVertical: 0,
              gap: 0,
              overflow: "hidden",
            },
          ]}
        >
          <TextInput
            style={
              [
                {
                  flex: 1,
                  minHeight: 44,
                  fontSize: 16,
                  color: theme.color.val,
                  paddingVertical: 0,
                  paddingHorizontal: 14,
                  margin: 0,
                  borderWidth: 0,
                  backgroundColor: "transparent",
                },
                Platform.OS === "web"
                  ? {
                      outlineStyle: "none",
                      boxShadow: "none",
                    }
                  : null,
              ] as any
            }
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
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                input.trim() && !isSending
                  ? theme.primary.val
                  : theme.backgroundPress.val,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons name="arrow-up" size={20} color={theme.primaryForeground.val} />
          </Pressable>
        </View>
      </View>

      {showModelPicker && renderModelPicker()}
    </View>
  );

  return (
    <Modal
      visible={modalVisible}
      animationType="none"
      transparent
      onRequestClose={onClose}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <Theme name={appTheme}>
          <View flex={1}>
            <Animated.View
              style={{
                flex: 1,
                backgroundColor: "rgba(0, 0, 0, 0.4)",
                opacity: overlayAnim,
              }}
            >
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
            </Animated.View>
            <Animated.View
              style={{
                height: modalHeight,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -6 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 24,
                backgroundColor: theme.background.val,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [modalHeight, 0],
                    }),
                  },
                ],
              }}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={{
                  height: modalHeight,
                }}
              >
                <View
                  flex={1}
                  bg="$background"
                  style={{
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    paddingBottom: insets.bottom,
                  }}
                >
                  {showHistory ? renderHistory() : renderChat()}
                </View>
              </KeyboardAvoidingView>
            </Animated.View>
          </View>
        </Theme>
      </TamaguiProvider>
    </Modal>
  );
}
