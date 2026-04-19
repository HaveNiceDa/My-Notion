import { useUser } from "@clerk/expo";
import { useQuery, useMutation } from "convex/react";
import { useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Dialog, ScrollView, Spinner, Text, View } from "tamagui";
import tw, { style as twStyle } from "twrnc";
import { Alert } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { SupportedLanguage } from "@/i18n";
import { useLanguage } from "@/i18n/useLanguage";
import { useAppTheme, type AppThemeName } from "@/theme/AppThemeProvider";

import { CollapsibleSection } from "./collapsible-section";
import { HomeBottomBar } from "./home-bottom-bar";
import { HomeHeader } from "./home-header";
import { RecentSection } from "./recent-section";
import { SidebarDocumentTree } from "./sidebar-document-tree";
import { useRecentDocuments } from "../hooks/use-recent-documents";
import { ChatModal } from "../../ai-chat/components/ChatModal";
import { SearchModal } from "./search-modal";

export type HomeScreenProps = {
  onOpenAccountMenu?: () => void;
};

export function HomeScreen({ onOpenAccountMenu }: HomeScreenProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { currentLanguage, switchLanguage } = useLanguage();
  const { theme, setTheme } = useAppTheme();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const { items: recentItems } = useRecentDocuments(12);
  const privateRootDocuments = useQuery(api.documents.getSidebar, { parentDocument: undefined });
  const starredRootDocuments = useQuery(api.documents.getStarred, {});
  const knowledgeRootDocuments = useQuery(api.documents.getKnowledgeBaseDocuments, {});

  const create = useMutation(api.documents.create);

  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [languageDialogOpen, setLanguageDialogOpen] = useState(false);
  const [themeDialogOpen, setThemeDialogOpen] = useState(false);

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
        title: t("Home.untitled"),
      });
      router.push(`/(home)/document/${documentId}` as Href);
    } catch {
      Alert.alert(t("Common.error"), t("Common.somethingWentWrong"));
    }
  };

  const bottomOffset = Math.max(insets.bottom, 10) + 56;
  const languageOptions: { value: SupportedLanguage; label: string }[] = [
    { value: "zh-CN", label: t("Home.languageSimplifiedChinese") },
    { value: "zh-TW", label: t("Home.languageTraditionalChinese") },
    { value: "en", label: t("Home.languageEnglish") },
  ];

  const themeOptions: { value: AppThemeName; label: string }[] = [
    { value: "light", label: t("Home.themeLight") },
    { value: "dark", label: t("Home.themeDark") },
    { value: "light_blue", label: t("Home.themeBlueLight") },
    { value: "dark_blue", label: t("Home.themeBlueDark") },
  ];
  const isInitialLoading =
    recentItems === undefined ||
    privateRootDocuments === undefined ||
    starredRootDocuments === undefined ||
    knowledgeRootDocuments === undefined;

  return (
    <View flex={1} bg="$background">
      <HomeHeader
        workspaceTitle={workspaceTitle}
        openMenuLabel={t("Home.openSettingsMenu")}
        changeLanguageLabel={t("Home.changeLanguage")}
        changeThemeLabel={t("Home.changeTheme")}
        settingsLabel={t("Navigation.settings")}
        inboxLabel={t("Home.inbox")}
        workspaceMenuLabel={t("Home.openWorkspaceMenu")}
        workspaceSummary={t("Home.workspaceSummary")}
        onPressWorkspace={onOpenAccountMenu}
        onPressInbox={() => Alert.alert(t("Home.inbox"), t("Common.comingSoon"))}
        onOpenLanguagePicker={() => setLanguageDialogOpen(true)}
        onOpenThemePicker={() => setThemeDialogOpen(true)}
      />

      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={twStyle("pb-4", {
          paddingBottom: bottomOffset,
          paddingTop: 4,
        })}
        scrollIndicatorInsets={{ bottom: bottomOffset }}
      >
        {isInitialLoading ? (
          <View style={tw`px-3 py-16 items-center justify-center`}>
            <Spinner size="large" />
          </View>
        ) : (
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
                  rootDocuments={knowledgeRootDocuments}
                  expandedIds={treeOpen}
                  onToggleExpand={toggleTree}
                  onNavigateToDocument={goDocument}
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
                  rootDocuments={starredRootDocuments}
                  expandedIds={treeOpen}
                  onToggleExpand={toggleTree}
                  onNavigateToDocument={goDocument}
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
                  rootDocuments={privateRootDocuments}
                  expandedIds={treeOpen}
                  onToggleExpand={toggleTree}
                  onNavigateToDocument={goDocument}
                />
              </CollapsibleSection>
            </View>
          </View>
        )}
      </ScrollView>

      <HomeBottomBar
        onPressSearch={() => setSearchModalVisible(true)}
        onPressAi={() => setAiModalVisible(true)}
        onPressNewPage={handleCreateNew}
      />

      <ChatModal visible={aiModalVisible} onClose={() => setAiModalVisible(false)} />
      <SearchModal visible={searchModalVisible} onClose={() => setSearchModalVisible(false)} />

      <Dialog open={languageDialogOpen} onOpenChange={setLanguageDialogOpen} modal>
        <Dialog.Portal>
          <Dialog.Overlay key="language-overlay" opacity={0.5} />
          <Dialog.Content
            bordered
            elevate
            key="language-content"
            width={320}
            gap="$3"
            bg="$backgroundHover"
            style={{ borderRadius: 24 }}
          >
            <Dialog.Title>{t("Home.selectLanguage")}</Dialog.Title>
            {languageOptions.map((option) => (
              <Button key={option.value} onPress={() => {
                void switchLanguage(option.value);
                setLanguageDialogOpen(false);
              }} bg="$background">
                <Text width="100%">
                  {option.label}
                  {currentLanguage === option.value ? ` (${t("Home.currentSelection")})` : ""}
                </Text>
              </Button>
            ))}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      <Dialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen} modal>
        <Dialog.Portal>
          <Dialog.Overlay key="theme-overlay" opacity={0.5} />
          <Dialog.Content
            bordered
            elevate
            key="theme-content"
            width={320}
            gap="$3"
            bg="$backgroundHover"
            style={{ borderRadius: 24 }}
          >
            <Dialog.Title>{t("Home.selectTheme")}</Dialog.Title>
            {themeOptions.map((option) => (
              <Button key={option.value} onPress={() => {
                void setTheme(option.value);
                setThemeDialogOpen(false);
              }} bg="$background">
                <Text width="100%">
                  {option.label}
                  {theme === option.value ? ` (${t("Home.currentSelection")})` : ""}
                </Text>
              </Button>
            ))}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </View>
  );
}
