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
import { useToast } from "@/features/home/components/toast-provider";

export default function TrashScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

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
      toast.showSuccess(t("TrashBox.noteRestored"));
    } catch (error) {
      console.error("Failed to restore:", error);
      toast.showError(t("TrashBox.failedToRestoreNote"));
    }
  };

  const handlePermanentDelete = async (id: Id<"documents">) => {
    try {
      await remove({ id });
      setDeleteTarget(null);
      toast.showSuccess(t("TrashBox.noteDeleted"));
    } catch (error) {
      console.error("Failed to delete:", error);
      toast.showError(t("TrashBox.failedToDeleteNote"));
    }
  };

  const handleBatchDelete = async () => {
    try {
      await batchRemove({ ids: Array.from(selectedIds) });
      setSelectedIds(new Set());
      setBatchDeleteOpen(false);
      toast.showSuccess(t("TrashBox.noteDeleted"));
    } catch (error) {
      console.error("Failed to batch delete:", error);
      toast.showError(t("TrashBox.failedToDeleteNote"));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <View style={{ paddingTop: insets.top, flex: 1 }}>
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

        <View
          style={tw`flex-row items-center mx-3 mt-3 mb-1 px-3 py-2 rounded-xl gap-2`}
          bg="$backgroundHover"
        >
          <Ionicons
            name="search"
            size={16}
            color={theme.placeholderColor.val}
          />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("TrashBox.filterByPageTitle")}
            placeholderTextColor={theme.placeholderColor.val}
            style={[
              tw`flex-1 text-sm`,
              { color: theme.color.val },
            ]}
          />
        </View>

        {filteredDocuments && filteredDocuments.length > 0 && (
          <View
            style={tw`flex-row items-center justify-between px-4 py-2`}
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
                  tw`flex-row items-center gap-1 px-3 py-1.5 rounded-full`,
                  { backgroundColor: "#ef444415" },
                  pressed ? { opacity: 0.7 } : null,
                ]}
              >
                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                <Text style={[tw`text-xs font-medium`, { color: "#ef4444" }]}>
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
              <View style={tw`items-center justify-center py-16`}>
                <Ionicons
                  name="trash-outline"
                  size={48}
                  color={theme.placeholderColor.val}
                  style={tw`mb-3 opacity-40`}
                />
                <Text color="$placeholderColor" style={tw`text-sm`}>
                  {t("TrashBox.noDocumentsFound")}
                </Text>
              </View>
            )}

            {filteredDocuments?.map((doc) => {
              const isSelected = selectedIds.has(doc._id);
              return (
                <View
                  key={doc._id}
                  style={[
                    tw`flex-row items-center mx-3 my-0.5 px-3 py-2.5 rounded-xl gap-2`,
                    {
                      backgroundColor: isSelected
                        ? theme.backgroundHover.val
                        : "transparent",
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => toggleSelect(doc._id)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={
                        isSelected ? "checkbox" : "square-outline"
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
                      tw`p-2 rounded-full`,
                      pressed
                        ? { backgroundColor: theme.backgroundPress.val }
                        : null,
                    ]}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={18}
                      color={theme.primary.val}
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => setDeleteTarget(doc._id)}
                    hitSlop={8}
                    style={({ pressed }) => [
                      tw`p-2 rounded-full`,
                      pressed
                        ? { backgroundColor: theme.backgroundPress.val }
                        : null,
                    ]}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color="#ef4444"
                    />
                  </Pressable>
                </View>
              );
            })}
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
