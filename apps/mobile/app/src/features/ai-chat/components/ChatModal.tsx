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
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import tw from "twrnc";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function ChatModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<Id<"aiConversations"> | null>(
    null,
  );

  const scrollViewRef = useRef<ScrollView>(null);

  const createConversation = useMutation(api.aiChat.createConversation);
  const addMessage = useMutation(api.aiChat.addMessage);

  const conversations = useQuery(api.aiChat.getConversations, user ? { userId: user.id } : "skip");

  const messages = useQuery(
    api.aiChat.getMessages,
    activeConversationId ? { conversationId: activeConversationId } : "skip",
  );

  // 初始化活跃对话 id
  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0]._id);
    }
  }, [conversations, activeConversationId]);
  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !user || isSending) return;

    setIsSending(true);
    const userMessage = input.trim();
    setInput("");

    try {
      let conversationId = activeConversationId;

      // 如果没有活跃对话，创建一个
      if (!conversationId) {
        conversationId = await createConversation({
          userId: user.id,
          title: userMessage.slice(0, 20),
        });
        setActiveConversationId(conversationId);
      }

      // 添加用户消息
      await addMessage({
        conversationId,
        content: userMessage,
        role: "user",
      });

      // TODO: 这里应该调用 AI 接口。目前先模拟一个回复。
      // 在实际项目中，这里应该调用 web 端的 API 或者在 Convex 中实现 AI 调用。
      setTimeout(async () => {
        await addMessage({
          conversationId: conversationId!,
          content: t("Home.aiMockResponse", { message: userMessage }),
          role: "assistant",
        });
        setIsSending(false);
      }, 1000);
    } catch (error) {
      console.error("Failed to send message:", error);
      setIsSending(false);
    }
  }, [input, user, isSending, activeConversationId, createConversation, addMessage]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={tw`flex-1 bg-black/40`}>
        <Pressable style={tw`flex-1`} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={tw`bg-white rounded-t-3xl overflow-hidden`}
        >
          <View style={[tw`bg-white`, { height: "85%", paddingBottom: insets.bottom }]}>
            {/* Header */}
            <View style={tw`flex-row items-center justify-between px-4 py-3 border-b border-neutral-100`}>
              <View style={tw`flex-row items-center gap-2`}>
                <View style={tw`w-8 h-8 rounded-full bg-violet-100 items-center justify-center`}>
                  <Ionicons name="sparkles" size={18} color="#7c3aed" />
                </View>
                <Text style={tw`text-lg font-bold text-neutral-900`}>{t("AI.aiConversation")}</Text>
              </View>
              <View style={tw`flex-row items-center gap-3`}>
                <Pressable
                  onPress={() => setActiveConversationId(null)}
                  style={tw`p-1 rounded-full bg-neutral-50`}
                >
                  <Ionicons name="add" size={24} color="#737373" />
                </Pressable>
                <Pressable onPress={onClose} style={tw`p-1`}>
                  <Ionicons name="close" size={24} color="#737373" />
                </Pressable>
              </View>
            </View>

            {/* Message List */}
            <ScrollView
              ref={scrollViewRef}
              style={tw`flex-1 px-4`}
              contentContainerStyle={tw`py-4 gap-4`}
            >
              {messages?.map((msg) => (
                <View
                  key={msg._id}
                  style={tw`flex-row ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <View
                    style={[
                      tw`max-w-[85%] px-4 py-2.5 rounded-2xl`,
                      msg.role === "user"
                        ? tw`bg-violet-600 rounded-tr-none`
                        : tw`bg-neutral-100 rounded-tl-none`,
                    ]}
                  >
                    <Text
                      style={[
                        tw`text-[15px] leading-5`,
                        msg.role === "user" ? tw`text-white` : tw`text-neutral-800`,
                      ]}
                    >
                      {msg.content}
                    </Text>
                  </View>
                </View>
              ))}
              {isSending && (
                <View style={tw`flex-row justify-start`}>
                  <View style={tw`bg-neutral-100 px-4 py-2.5 rounded-2xl rounded-tl-none`}>
                    <ActivityIndicator size="small" color="#7c3aed" />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Input Area */}
            <View style={tw`px-4 py-3 border-t border-neutral-100`}>
              <View style={tw`flex-row items-center bg-neutral-100 rounded-2xl px-3 py-1.5 gap-2`}>
                <TextInput
                  style={tw`flex-1 min-h-10 text-[16px] text-neutral-900 py-1`}
                  placeholder={t("AI.pleaseEnterYourQuestion")}
                  placeholderTextColor="#a3a3a3"
                  value={input}
                  onChangeText={setInput}
                  multiline
                  maxLength={500}
                />
                <Pressable
                  onPress={handleSend}
                  disabled={!input.trim() || isSending}
                  style={({ pressed }) => [
                    tw`w-8 h-8 rounded-full items-center justify-center ${
                      input.trim() && !isSending ? "bg-violet-600" : "bg-neutral-300"
                    }`,
                    pressed && tw`opacity-80`,
                  ]}
                >
                  <Ionicons name="arrow-up" size={20} color="#fff" />
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
