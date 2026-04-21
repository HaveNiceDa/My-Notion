import React, { useState } from "react";
import { Modal, Pressable, TextInput, FlatList } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Spinner, Text, View } from "tamagui";
import tw from "twrnc";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter, type Href } from "expo-router";

type SearchModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function SearchModal({ visible, onClose }: SearchModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  
  const documents = useQuery(api.documents.getSearch);

  const filteredDocuments = documents?.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderItem = ({ item }: { item: any }) => (
    <Pressable
      onPress={() => {
        onClose();
        router.push(`/(home)/document/${item._id}` as Href);
      }}
      style={({ pressed }) => tw`flex-row items-center px-4 py-3 gap-3 ${pressed ? "bg-neutral-100" : ""}`}
    >
      <Ionicons name="document-text-outline" size={20} color="#666" />
      <Text style={tw`text-base text-neutral-800 flex-1`} numberOfLines={1}>
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
      <View style={tw`flex-1 bg-black/50`}>
        <View 
          style={[
            tw`bg-white flex-1 mt-12 rounded-t-3xl`,
            { paddingTop: 16 }
          ]}
        >
          {/* Header */}
          <View style={tw`flex-row items-center px-4 gap-3 pb-4 border-b border-neutral-100`}>
            <View style={tw`flex-1 flex-row items-center bg-neutral-100 rounded-xl px-3 h-11`}>
              <Ionicons name="search" size={18} color="#999" />
              <TextInput
                autoFocus
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t("Navigation.search")}
                style={tw`flex-1 ml-2 text-base text-neutral-900`}
                placeholderTextColor="#999"
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={18} color="#ccc" />
                </Pressable>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={tw`text-neutral-600 font-medium`}>{t("Modals.confirm.cancel")}</Text>
            </Pressable>
          </View>

          {/* Results */}
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
                  <Text style={tw`text-neutral-400`}>{t("SearchCommand.empty")}</Text>
                </View>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
