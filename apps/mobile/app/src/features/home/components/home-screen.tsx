import { useUser } from "@clerk/expo";
import { useQuery, useMutation } from "convex/react";
import { useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, Button, ScrollView, Spinner, Text, View } from "tamagui";
import tw, { style as twStyle } from "twrnc";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useSearch } from "@notion/business/hooks";

import { CollapsibleSection } from "./collapsible-section";
import { HomeBottomBar } from "./home-bottom-bar";
import { HomeHeader } from "./home-header";
import { RecentSection } from "./recent-section";
import { SidebarDocumentTree } from "./sidebar-document-tree";
import { useRecentDocuments } from "../hooks/use-recent-documents";
import { useDocumentTree } from "../hooks/use-document-tree";
import { ChatModal } from "../../ai-chat/components/ChatModal";
import { SearchModal } from "./search-modal";
import { SettingsModal } from "./settings-modal";

export type HomeScreenProps = {
  signOut?: () => void;
};

export function HomeScreen({ signOut }: HomeScreenProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const { user } = useUser();
  const { items: recentItems } = useRecentDocuments(12);
  const allDocuments = useQuery(api.documents.getAllSidebarDocuments, {});

  const { rootNodes: privateRootNodes } = useDocumentTree(allDocuments, "private");
  const { rootNodes: starredRootNodes } = useDocumentTree(allDocuments, "starred");
  const { rootNodes: knowledgeRootNodes } = useDocumentTree(allDocuments, "knowledge");

  const create = useMutation(api.documents.create);

  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [inboxDialogOpen, setInboxDialogOpen] = useState(false);

  const { onOpen: openSearch } = useSearch();

  const workspaceTitle =
    user?.firstName != null && user.firstName.length > 0
      ? t("Home.workspaceOwned", { name: user.firstName })
      : t("Home.myWorkspace");

  const [sections, setSections] = useState({
    knowledgeBase: true,
    favorites: false,
    private: true,
  });

  const [treeOpen, setTreeOpen] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleTree = useCallback((id: Id<"documents">) => {
    setTreeOpen((prev) => {
      const next = new Set(prev);
      const key = id as string;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const goDocument = useCallback(
    (id: Id<"documents">) => {
      router.push(`/(home)/document/${id}` as Href);
    },
    [router],
  );

  const handleCreateNew = async () => {
    try {
      const documentId = await create({
        title: t("Documents.untitled"),
      });
      router.push(`/(home)/document/${documentId}` as Href);
    } catch {
      setErrorDialogOpen(true);
    }
  };

  const handleCreateChild = async (parentId: Id<"documents">) => {
    try {
      const documentId = await create({
        title: t("Documents.untitled"),
        parentDocument: parentId,
      });
      if (!treeOpen.has(parentId)) {
        toggleTree(parentId);
      }
      router.push(`/(home)/document/${documentId}` as Href);
    } catch {
      setErrorDialogOpen(true);
    }
  };

  const isInitialLoading =
    recentItems === undefined ||
    allDocuments === undefined;

  return (
    <View flex={1} bg="$background">
      <HomeHeader
        workspaceTitle={workspaceTitle}
        settingsLabel={t("Navigation.settings")}
        inboxLabel={t("Home.inbox")}
        trashLabel={t("Navigation.trash")}
        onPressInbox={() => setInboxDialogOpen(true)}
        onPressTrash={() => router.push("/(home)/trash" as Href)}
      />

      {isInitialLoading ? (
        <View flex={1} style={tw`items-center justify-center`}>
          <Spinner size="large" />
        </View>
      ) : (
        <ScrollView
          style={tw`flex-1`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={twStyle("", {
            paddingTop: 4,
          })}
        >
          <View>
            <RecentSection
              title={t("Home.recent")}
              items={recentItems}
              onPressCard={(item) => goDocument(item.id as Id<"documents">)}
            />

            <View style={tw`mt-1`}>
              <CollapsibleSection
                title={t("Navigation.knowledgeBase")}
                expanded={sections.knowledgeBase}
                onToggle={() => toggleSection("knowledgeBase")}
              >
                <SidebarDocumentTree
                  variant="knowledge"
                  nodes={knowledgeRootNodes}
                  expandedIds={treeOpen}
                  onToggleExpand={toggleTree}
                  onNavigateToDocument={goDocument}
                  onCreateChild={handleCreateChild}
                  emptyHint={t("Documents.noKnowledgeBasePages")}
                />
              </CollapsibleSection>

              <CollapsibleSection
                title={t("Navigation.favorites")}
                expanded={sections.favorites}
                onToggle={() => toggleSection("favorites")}
              >
                <SidebarDocumentTree
                  variant="starred"
                  nodes={starredRootNodes}
                  expandedIds={treeOpen}
                  onToggleExpand={toggleTree}
                  onNavigateToDocument={goDocument}
                  onCreateChild={handleCreateChild}
                  emptyHint={t("Documents.noStarredPages")}
                />
              </CollapsibleSection>

              <CollapsibleSection
                title={t("Navigation.private")}
                expanded={sections.private}
                onToggle={() => toggleSection("private")}
              >
                <SidebarDocumentTree
                  variant="private"
                  nodes={privateRootNodes}
                  expandedIds={treeOpen}
                  onToggleExpand={toggleTree}
                  onNavigateToDocument={goDocument}
                  onCreateChild={handleCreateChild}
                />
              </CollapsibleSection>
            </View>
          </View>
        </ScrollView>
      )}

      <HomeBottomBar
        onPressSearch={openSearch}
        onPressAi={() => setAiModalVisible(true)}
        onPressNewPage={handleCreateNew}
      />

      <ChatModal
        visible={aiModalVisible}
        onClose={() => setAiModalVisible(false)}
      />
      <SearchModal />
      <SettingsModal signOut={signOut} />

      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen} modal>
        <Dialog.Portal>
          <Dialog.Overlay key="error-overlay" opacity={0.5} />
          <Dialog.Content
            bordered
            elevate
            key="error-content"
            width={320}
            gap="$3"
            bg="$backgroundHover"
            style={tw`rounded-3xl`}
          >
            <Dialog.Title>Error</Dialog.Title>
            <Text>{t("Error.somethingWentWrong")}</Text>
            <Button onPress={() => setErrorDialogOpen(false)} style={tw`mt-4`}>
              <Text width="100%">{t("Error.ok")}</Text>
            </Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      <Dialog open={inboxDialogOpen} onOpenChange={setInboxDialogOpen} modal>
        <Dialog.Portal>
          <Dialog.Overlay key="inbox-overlay" opacity={0.5} />
          <Dialog.Content
            bordered
            elevate
            key="inbox-content"
            width={320}
            gap="$3"
            bg="$backgroundHover"
            style={tw`rounded-3xl`}
          >
            <Dialog.Title>{t("Home.inbox")}</Dialog.Title>
            <Text>{t("Marketing.comingSoon")}</Text>
            <Button onPress={() => setInboxDialogOpen(false)} style={tw`mt-4`}>
              <Text width="100%">{t("Error.ok")}</Text>
            </Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}
