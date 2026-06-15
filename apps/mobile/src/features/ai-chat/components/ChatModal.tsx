import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import type { TextStyle } from "react-native";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
  Sheet
} from "tamagui";
import twBase from "twrnc";

import type { Id } from "@convex/_generated/dataModel";
import {
  MODELS_CONFIG,
} from "@/lib/ai/chat";
import { useAgentChatSession } from "../hooks/use-agent-chat-session";
import type { AgentToolEventItem, AgentToolEventSource } from "../types";

type Props = {
  visible: boolean;
  onClose: () => void;
};

const tw = twBase as any;

export function ChatModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<Id<"aiConversations"> | null>(null);
  const [expandedToolIds, setExpandedToolIds] = useState<Set<string>>(new Set());
  const scrollViewRef = useRef<ScrollView>(null);
  const {
    conversations,
    convexMessages,
    input,
    setInput,
    status,
    isSending,
    streamingContent,
    reasoningContent,
    completedReasoning,
    reasoningExpanded,
    setReasoningExpanded,
    activeConversationId,
    selectedModel,
    setSelectedModel,
    enableThinking,
    setEnableThinking,
    knowledgeBaseEnabled,
    setKnowledgeBaseEnabled,
    thinkingSteps,
    toolEvents,
    stepsExpanded,
    setStepsExpanded,
    lastFailedInput,
    resumeCursor,
    handleSend,
    handleResume,
    handleStop,
    handleNewConversation,
    handleSelectConversation,
    handleDeleteConversation,
  } = useAgentChatSession(visible);

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

  const selectConversation = (id: Id<"aiConversations">) => {
    handleSelectConversation(id);
    setShowHistory(false);
  };

  const deleteConversation = async (id: Id<"aiConversations">) => {
    await handleDeleteConversation(id);
    setDeleteConfirmId(null);
  };

  const currentModelConfig = MODELS_CONFIG.find((m) => m.id === selectedModel);
  const displayReasoning = reasoningContent || completedReasoning;

  const getToolDisplayName = (name: string) => {
    if (name.includes("knowledge") || name.includes("rag")) {
      return t("AI.knowledgeSearchTool");
    }
    if (name.includes("document_read") || name.includes("docs_fetch")) {
      return t("AI.documentReadTool");
    }
    if (name.includes("document_search") || name.includes("docs_search")) {
      return t("AI.documentSearchTool");
    }
    if (name.includes("web_search")) {
      return t("AI.webSearchTool");
    }
    if (name.includes("web_extract")) {
      return t("AI.webExtractTool");
    }
    if (name.includes("memory_search")) {
      return t("AI.memorySearchTool");
    }
    if (name.includes("memory_write")) {
      return t("AI.memoryWriteTool");
    }
    if (name.includes("plan")) {
      return t("AI.taskPlanTool");
    }
    if (name.includes("mcp")) {
      return t("AI.mcpMyNotionTool");
    }
    return name;
  };

  const toggleToolExpanded = (id: string) => {
    setExpandedToolIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getSourceLabel = (source: AgentToolEventSource) => {
    if (source.title) return source.title;
    if (source.type === "web" && source.url) return source.url;
    if (source.type === "document") return t("AI.untitledDocument");
    if (source.type === "memory") return t("AI.memorySource");
    return source.type;
  };

  const renderToolEvents = () => {
    if (toolEvents.length === 0) return null;

    const statusLabel = (status: AgentToolEventItem["status"]) => {
      if (status === "completed") return t("AI.toolCompleted");
      if (status === "failed") return t("AI.taskPlanBlocked");
      return t("AI.toolRunning");
    };

    return (
      <View style={tw`flex-row justify-start`}>
        <View
          flex={1}
          style={{
            maxWidth: "85%",
            borderRadius: 20,
            borderLeftWidth: 3,
            borderLeftColor: "#8b5cf6",
            borderTopLeftRadius: 0,
            backgroundColor: theme.backgroundHover.val,
            paddingHorizontal: 14,
            paddingVertical: 10,
            gap: 8,
          }}
        >
          {toolEvents.map((event) => {
            const isExpanded = expandedToolIds.has(event.id);
            const isLongDetail = event.detail.length > 120;
            const detail = !isLongDetail || isExpanded
              ? event.detail
              : `${event.detail.slice(0, 120)}...`;

            return (
              <View key={event.id} style={tw`gap-1.5`}>
                <View style={tw`flex-row items-center gap-2`}>
                  {event.status === "running" ? (
                    <ActivityIndicator size="small" color="#8b5cf6" />
                  ) : (
                    <Ionicons
                      name={
                        event.status === "completed"
                          ? "checkmark-circle-outline"
                          : "alert-circle-outline"
                      }
                      size={14}
                      color={event.status === "completed" ? "#22c55e" : "#ef4444"}
                    />
                  )}
                  <Text flex={1} fontSize={12} fontWeight="bold" color="$color">
                    {getToolDisplayName(event.name)}
                  </Text>
                  <Text fontSize={10} color="$placeholderColor">
                    {statusLabel(event.status)}
                  </Text>
                </View>

                {detail.length > 0 && (
                  <Text fontSize={11} lineHeight={16} color="$placeholderColor">
                    {detail}
                  </Text>
                )}

                {isLongDetail && (
                  <Pressable
                    onPress={() => toggleToolExpanded(event.id)}
                    hitSlop={6}
                    style={tw`self-start`}
                  >
                    <Text fontSize={11} color="$primary">
                      {isExpanded ? t("AI.collapseToolResult") : t("AI.expandToolResult")}
                    </Text>
                  </Pressable>
                )}

                {event.sources.length > 0 && (
                  <View style={tw`gap-1`}>
                    {event.sources.slice(0, 3).map((source, index) => (
                      <View
                        key={`${event.id}-${source.type}-${index}`}
                        style={tw`flex-row items-center gap-1.5`}
                      >
                        <Ionicons
                          name={
                            source.type === "web"
                              ? "globe-outline"
                              : source.type === "memory"
                                ? "bookmark-outline"
                                : "document-text-outline"
                          }
                          size={11}
                          color={theme.placeholderColor.val}
                        />
                        <Text
                          flex={1}
                          fontSize={10}
                          color="$placeholderColor"
                          numberOfLines={1}
                        >
                          {getSourceLabel(source)}
                        </Text>
                      </View>
                    ))}
                    {event.sources.length > 3 && (
                      <Text fontSize={10} color="$placeholderColor">
                        {t("AI.moreSources", { count: event.sources.length - 3 })}
                      </Text>
                    )}
                  </View>
                )}

                {event.status === "failed" && event.recoverable && (
                  <Text fontSize={10} lineHeight={14} color="#ef4444">
                    {t("AI.recoverableToolError")}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

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
              onPress={() => selectConversation(conv._id)}
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
              <Pressable onPress={() => setDeleteConfirmId(conv._id)} hitSlop={8}>
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

      {deleteConfirmId && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
          }}
        >
          <View
            style={{
              width: 280,
              borderRadius: 16,
              backgroundColor: theme.background.val,
              padding: 20,
              gap: 12,
            }}
          >
            <Text fontSize={17} fontWeight="bold" color="$color">
              {t("AI.deleteConversation")}
            </Text>
            <Text fontSize={14} lineHeight={20} color="$placeholderColor">
              {t("AI.deleteConversationConfirm")}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
              <Pressable
                onPress={() => setDeleteConfirmId(null)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: theme.backgroundHover.val,
                }}
              >
                <Text fontSize={14} color="$color">{t("Error.ok")}</Text>
              </Pressable>
              <Pressable
                onPress={() => deleteConversation(deleteConfirmId)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: "#ef4444",
                }}
              >
                <Text fontSize={14} color="#fff">{t("Menu.delete")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
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

  const renderThinkingSteps = () => {
    if (thinkingSteps.length === 0) return null;

    return (
      <View style={tw`flex-row justify-start`}>
        <View
          flex={1}
          style={{
            maxWidth: "85%",
            borderRadius: 20,
            borderLeftWidth: 3,
            borderLeftColor: "#3b82f6",
            borderTopLeftRadius: 0,
            backgroundColor: theme.backgroundHover.val,
            overflow: "hidden",
          }}
        >
          <Pressable
            onPress={() => setStepsExpanded((expanded) => !expanded)}
            style={tw`flex-row items-center gap-1.5 px-3.5 pt-2.5 pb-1`}
          >
            <Ionicons name="search-outline" size={14} color="#3b82f6" />
            <Text flex={1} fontSize={11} fontWeight="bold" color="#3b82f6">
              {t("AI.knowledgeBaseSearch")}
            </Text>
            <Text fontSize={10} color="$placeholderColor">
              {thinkingSteps.length}
            </Text>
            <Ionicons
              name={stepsExpanded ? "chevron-up" : "chevron-down"}
              size={14}
              color={theme.placeholderColor.val}
            />
          </Pressable>

          {stepsExpanded && (
            <View style={[tw`px-3.5 pb-2.5 gap-1.5`, { maxHeight: 150 }]}>
              <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {thinkingSteps.map((step, index) => (
                  <View
                    key={`${step.type}-${index}`}
                    style={tw`flex-row items-start gap-1.5 py-0.5`}
                  >
                    <Ionicons
                      name={
                        step.type === "error"
                          ? "alert-circle-outline"
                          : step.type === "documents"
                            ? "document-text-outline"
                            : "ellipse"
                      }
                      size={10}
                      color={
                        step.type === "error"
                          ? "#ef4444"
                          : step.type === "documents"
                            ? "#22c55e"
                            : theme.placeholderColor.val
                      }
                      style={tw`mt-1`}
                    />
                    <Text fontSize={11} lineHeight={16} color="$placeholderColor" flex={1}>
                      {step.content}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>
    );
  };

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
          <Pressable
            onPress={() => {
              handleNewConversation();
              setShowHistory(false);
            }}
            hitSlop={4}
          >
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
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
              {[
                t("AI.writeMeetingAgenda"),
                t("AI.analyzePDFOrImage"),
                t("AI.createTaskReminder"),
              ].map((suggestion) => (
                <Pressable
                  key={suggestion}
                  onPress={() => {
                    setInput(suggestion);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 16,
                    backgroundColor: theme.backgroundHover.val,
                    borderWidth: 1,
                    borderColor: theme.borderColor.val,
                  }}
                >
                  <Text fontSize={13} color="$color">{suggestion}</Text>
                </Pressable>
              ))}
            </View>
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

        {thinkingSteps.length > 0 && renderThinkingSteps()}

        {toolEvents.length > 0 && renderToolEvents()}

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

        {isSending && streamingContent.length === 0 && displayReasoning.length === 0 && thinkingSteps.length === 0 && (
          <View style={tw`flex-row justify-start`}>
            <View style={[tw`px-4 py-2.5`, { borderRadius: 20, borderTopLeftRadius: 0, backgroundColor: theme.backgroundPress.val }]}>
              <ActivityIndicator size="small" color={theme.placeholderColor.val} />
            </View>
          </View>
        )}

        {(lastFailedInput || resumeCursor) && !isSending && (
          <View style={tw`flex-row justify-start`}>
            <View
              style={{
                maxWidth: "85%",
                borderRadius: 20,
                borderTopLeftRadius: 0,
                backgroundColor: theme.backgroundPress.val,
                paddingHorizontal: 16,
                paddingVertical: 10,
                gap: 8,
              }}
            >
              <Text fontSize={13} color="$placeholderColor">
                {status === "resumable"
                  ? t("AI.resumeInterrupted")
                  : t("AI.sendFailed")}
              </Text>
              <Pressable
                onPress={() => {
                  if (status === "resumable" && resumeCursor) {
                    handleResume();
                    return;
                  }
                  if (lastFailedInput) {
                    handleSend(lastFailedInput);
                  }
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  backgroundColor: theme.backgroundHover.val,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 12,
                  alignSelf: "flex-start",
                }}
              >
                <Ionicons
                  name={status === "resumable" ? "play-outline" : "refresh-outline"}
                  size={14}
                  color={theme.primary.val}
                />
                <Text fontSize={13} fontWeight="bold" color="$primary">
                  {status === "resumable"
                    ? t("AI.resumeGeneration")
                    : t("AI.retry")}
                </Text>
              </Pressable>
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

          <Pressable onPress={() => setKnowledgeBaseEnabled((enabled) => !enabled)}>
            <View
              style={[
                tw`flex-row items-center gap-1 px-2 py-1 rounded-full`,
                { backgroundColor: knowledgeBaseEnabled ? "#3b82f6" : theme.backgroundHover.val },
              ]}
            >
              <Ionicons
                name="book-outline"
                size={13}
                color={knowledgeBaseEnabled ? "#fff" : theme.placeholderColor.val}
              />
              <Text
                fontSize={11}
                color={knowledgeBaseEnabled ? "#fff" : "$placeholderColor"}
              >
                {t("AI.knowledgeBase")}
              </Text>
            </View>
          </Pressable>

          <Pressable onPress={() => setEnableThinking((enabled) => !enabled)}>
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

        {enableThinking && (
          <Text
            fontSize={11}
            lineHeight={16}
            color="$placeholderColor"
            style={tw`mb-2 px-1`}
          >
            {t("AI.deepThinkingCompatibilityHint")}
          </Text>
        )}

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
              ] as unknown as TextStyle
            }
            placeholder={t("AI.pleaseEnterYourQuestion")}
            placeholderTextColor={theme.placeholderColor.val}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <Pressable
            onPress={isSending ? handleStop : () => handleSend()}
            disabled={!isSending && !input.trim()}
            style={({ pressed }) => ({
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor:
                isSending
                  ? "#ef4444"
                  : input.trim()
                  ? theme.primary.val
                  : theme.backgroundPress.val,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons
              name={isSending ? "stop" : "arrow-up"}
              size={isSending ? 16 : 20}
              color={theme.primaryForeground.val}
            />
          </Pressable>
        </View>
      </View>

      {showModelPicker && renderModelPicker()}
    </View>
  );

  return (
    <Sheet
      modal
      open={visible}
      onOpenChange={(open: boolean) => {
        if (!open) onClose();
      }}
      snapPoints={[70]}
      dismissOnSnapToBottom
      zIndex={100_000}
    >
      <Sheet.Overlay
        bg="$shadow6"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
      />
      <Sheet.Handle />
      <Sheet.Frame
        borderTopLeftRadius="$6"
        borderTopRightRadius="$6"
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
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
      </Sheet.Frame>
    </Sheet>
  );
}
