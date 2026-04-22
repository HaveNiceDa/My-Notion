import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, TextInput } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, Spinner, Text, View, useTheme } from "tamagui";
import tw from "twrnc";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ConfirmDialog } from "@/features/home/components/confirm-dialog";

export default function TrashScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const documents = useQuery(api.documents.getTrash);
  const restore = useMutation(api.documents.restore);
  const remove = useMutation(api.documents.remove);
  const batchRemove = useMutation(api.documents.batchRemove);

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<Id<"documents">>>(
    new Set(),
  );
  const [deleteTarget, setDeleteTarget] = useState<Id<"documents"> | null>(
    null,
  );
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  const filteredDocuments = documents?.filter((doc) =>
    doc.title.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleSelect = (id: Id<"documents">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!filteredDocuments) return;
    if (selectedIds.size === filteredDocuments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDocuments.map((d) => d._id)));
    }
  };

  const handleRestore = async (id: Id<"documents">) => {
    try {
      await restore({ id });
    } catch (error) {
      console.error("Failed to restore:", error);
    }
  };

  const handlePermanentDelete = async (id: Id<"documents">) => {
    try {
      await remove({ id });
      setDeleteTarget(null);
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const handleBatchDelete = async () => {
    try {
      await batchRemove({ ids: Array.from(selectedIds) });
      setSelectedIds(new Set());
      setBatchDeleteOpen(false);
    } catch (error) {
      console.error("Failed to batch delete:", error);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <View
        style={{
          paddingTop: insets.top,
          flex: 1,
        }}
      >
        <View
          px="$3"
          pb="$2"
          style={{
            borderBottomWidth: 1,
            borderBottomColor: theme.borderColor.val,
          }}
        >
          <View style={tw`flex-row items-center justify-between`}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={({ pressed }) => [
                tw`w-10 h-10 rounded-full items-center justify-center`,
                pressed
                  ? { backgroundColor: theme.backgroundPress.val }
                  : null,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={theme.color.val}
              />
            </Pressable>

            <Text style={tw`text-base font-semibold`}>
              {t("Navigation.trash")}
            </Text>

            <View style={tw`w-10`} />
          </View>
        </View>

        <View style={tw`flex-row items-center px-3 py-2 gap-2`}>
          <Ionicons
            name="search"
            size={18}
            color={theme.placeholderColor.val}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("TrashBox.filterByPageTitle")}
            placeholderTextColor={theme.placeholderColor.val}
            style={[
              tw`flex-1 text-sm py-1 px-2 rounded-lg`,
              {
                color: theme.color.val,
                backgroundColor: theme.backgroundHover.val,
              },
            ]}
          />
        </View>

        {filteredDocuments && filteredDocuments.length > 0 && (
          <View
            style={tw`flex-row items-center justify-between px-3 py-2`}
          >
            <View style={tw`flex-row items-center gap-2`}>
              <Pressable onPress={toggleSelectAll} hitSlop={8}>
                <Ionicons
                  name={
                    selectedIds.size === filteredDocuments.length &&
                    filteredDocuments.length > 0
                      ? "checkbox"
                      : "square-outline"
                  }
                  size={20}
                  color={theme.primary.val}
                />
              </Pressable>
              <Text color="$placeholderColor" style={tw`text-xs`}>
                {selectedIds.size} / {filteredDocuments.length}{" "}
                {t("TrashBox.selected")}
              </Text>
            </View>

            {selectedIds.size > 0 && (
              <Pressable
                onPress={() => setBatchDeleteOpen(true)}
                style={({ pressed }) => [
                  tw`flex-row items-center gap-1 px-3 py-1 rounded-lg`,
                  { backgroundColor: "#ef444420" },
                  pressed ? { opacity: 0.7 } : null,
                ]}
              >
                <Ionicons name="trash" size={14} color="#ef4444" />
                <Text style={[tw`text-xs`, { color: "#ef4444" }]}>
                  {t("TrashBox.batchDelete")}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {documents === undefined ? (
          <View flex={1} style={tw`items-center justify-center`}>
            <Spinner size="large" />
          </View>
        ) : (
          <ScrollView flex={1} contentContainerStyle={tw`pb-8`}>
            {filteredDocuments?.length === 0 && (
              <Text
                color="$placeholderColor"
                style={tw`text-sm text-center py-8`}
              >
                {t("TrashBox.noDocumentsFound")}
              </Text>
            )}

            {filteredDocuments?.map((doc) => (
              <View
                key={doc._id}
                style={tw`flex-row items-center px-3 py-2 gap-2`}
              >
                <Pressable
                  onPress={() => toggleSelect(doc._id)}
                  hitSlop={8}
                >
                  <Ionicons
                    name={
                      selectedIds.has(doc._id) ? "checkbox" : "square-outline"
                    }
                    size={20}
                    color={theme.primary.val}
                  />
                </Pressable>

                <Text
                  color="$color"
                  style={tw`flex-1 text-sm`}
                  numberOfLines={1}
                >
                  {doc.title}
                </Text>

                <Pressable
                  onPress={() => handleRestore(doc._id)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    tw`p-2 rounded-lg`,
                    pressed
                      ? { backgroundColor: theme.backgroundPress.val }
                      : null,
                  ]}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={20}
                    color={theme.placeholderColor.val}
                  />
                </Pressable>

                <Pressable
                  onPress={() => setDeleteTarget(doc._id)}
                  hitSlop={8}
                  style={({ pressed }) => [
                    tw`p-2 rounded-lg`,
                    pressed
                      ? { backgroundColor: theme.backgroundPress.val }
                      : null,
                  ]}
                >
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        destructive
        onConfirm={() => {
          if (deleteTarget) handlePermanentDelete(deleteTarget);
        }}
      />

      <ConfirmDialog
        open={batchDeleteOpen}
        onOpenChange={setBatchDeleteOpen}
        destructive
        onConfirm={handleBatchDelete}
      />
    </SafeAreaView>
  );
}
