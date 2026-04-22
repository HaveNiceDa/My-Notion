import React, { useState } from "react";
import { Modal, Pressable, TextInput, FlatList } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Spinner, Text, View, useTheme, TamaguiProvider, Theme } from "tamagui";
import tw from "twrnc";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter, type Href } from "expo-router";
import { config as tamaguiConfig } from "@tamagui/config";
import { useAppTheme } from "@/theme/AppThemeProvider";

type SearchModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function SearchModal({ visible, onClose }: SearchModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { theme: appTheme } = useAppTheme();
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState("");

  const documents = useQuery(api.documents.getSearch);

  const filteredDocuments = documents?.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const renderItem = ({ item }: { item: any }) => (
    <Pressable
      onPress={() => {
        onClose();
        router.push(`/(home)/document/${item._id}` as Href);
      }}
      style={({ pressed }) => [
        tw`flex-row items-center px-4 py-3 gap-3`,
        pressed ? { backgroundColor: theme.backgroundHover.val } : null,
      ]}
    >
      <Ionicons name="document-text-outline" size={20} color={theme.placeholderColor.val} />
      <Text style={[tw`text-base flex-1`, { color: theme.color.val }]} numberOfLines={1}>
        {item.title}
      </Text>
    </Pressable>
  );

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <TamaguiProvider config={tamaguiConfig} defaultTheme="light">
        <Theme name={appTheme}>
          <View style={tw`flex-1 bg-black/50`}>
            <View
              style={[
                tw`flex-1 rounded-t-3xl`,
                {
                  backgroundColor: theme.background.val,
                  paddingTop: 16,
                },
              ]}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  gap: 12,
                  paddingBottom: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.borderColor.val,
                }}
              >
                <View
                  style={[
                    tw`flex-1 flex-row items-center rounded-xl px-3 h-11`,
                    { backgroundColor: theme.backgroundHover.val },
                  ]}
                >
                  <Ionicons name="search" size={18} color={theme.placeholderColor.val} />
                  <TextInput
                    autoFocus
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={t("Navigation.search")}
                    style={[tw`flex-1 ml-2 text-base`, { color: theme.color.val }]}
                    placeholderTextColor={theme.placeholderColor.val}
                  />
                  {searchQuery.length > 0 && (
                    <Pressable onPress={() => setSearchQuery("")}>
                      <Ionicons name="close-circle" size={18} color={theme.placeholderColor.val} />
                    </Pressable>
                  )}
                </View>
                <Pressable onPress={onClose} hitSlop={8}>
                  <Text style={[tw`font-medium`, { color: theme.primary.val }]}>
                    {t("Modals.confirm.cancel")}
                  </Text>
                </Pressable>
              </View>

              {documents === undefined ? (
                <View style={tw`flex-1 items-center justify-center`}>
                  <Spinner size="large" />
                </View>
              ) : (
                <FlatList
                  data={filteredDocuments}
                  renderItem={renderItem}
                  keyExtractor={(item) => item._id}
                  contentContainerStyle={tw`pb-12`}
                  ListEmptyComponent={
                    <View style={tw`py-12 items-center justify-center`}>
                      <Text color="$placeholderColor">{t("SearchCommand.empty")}</Text>
                    </View>
                  }
                />
              )}
            </View>
          </View>
        </Theme>
      </TamaguiProvider>
    </Modal>
  );
}
