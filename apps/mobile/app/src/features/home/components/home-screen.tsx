import { useUser } from "@clerk/expo";
import { useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import tw from "twrnc";

import type { Id } from "@convex/_generated/dataModel";

import { CollapsibleSection } from "./collapsible-section";
import { HomeBottomBar } from "./home-bottom-bar";
import { HomeHeader } from "./home-header";
import { RecentSection } from "./recent-section";
import { SidebarDocumentTree } from "./sidebar-document-tree";
import { useRecentDocuments } from "../hooks/use-recent-documents";

export type HomeScreenProps = {
  onOpenAccountMenu?: () => void;
};

export function HomeScreen({ onOpenAccountMenu }: HomeScreenProps) {
  const router = useRouter();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const { items: recentItems } = useRecentDocuments(12);

  const workspaceTitle =
    user?.firstName != null && user.firstName.length > 0
      ? `${user.firstName}的工作空间`
      : "我的工作空间";

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

  const bottomOffset = Math.max(insets.bottom, 10) + 56;

  return (
    <View style={tw`flex-1 bg-[#f7f7f5]`}>
      <HomeHeader
        workspaceTitle={workspaceTitle}
        onPressInbox={() => {}}
        onPressMenu={onOpenAccountMenu}
      />

      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={[tw`pb-4`, { paddingBottom: bottomOffset }]}
        scrollIndicatorInsets={{ bottom: bottomOffset }}
      >
        {recentItems === undefined ? (
          <View style={tw`px-3 py-6 items-center`}>
            <ActivityIndicator />
          </View>
        ) : (
          <RecentSection
            title="最近"
            items={recentItems}
            onPressCard={(item) => goDocument(item.id as Id<"documents">)}
          />
        )}

        <View style={tw`px-1`}>
          <CollapsibleSection
            title="知识库"
            expanded={sections.knowledgeBase}
            onToggle={() => toggleSection("knowledgeBase")}
          >
            <SidebarDocumentTree
              variant="knowledge"
              expandedIds={treeOpen}
              onToggleExpand={toggleTree}
              onNavigateToDocument={goDocument}
              emptyHint="暂无知识库页面"
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="收藏"
            expanded={sections.favorites}
            onToggle={() => toggleSection("favorites")}
          >
            <SidebarDocumentTree
              variant="starred"
              expandedIds={treeOpen}
              onToggleExpand={toggleTree}
              onNavigateToDocument={goDocument}
              emptyHint="暂无收藏"
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="私人"
            expanded={sections.private}
            onToggle={() => toggleSection("private")}
          >
            <SidebarDocumentTree
              variant="private"
              expandedIds={treeOpen}
              onToggleExpand={toggleTree}
              onNavigateToDocument={goDocument}
            />
          </CollapsibleSection>
        </View>
      </ScrollView>

      <HomeBottomBar onPressSearch={() => {}} onPressAi={() => {}} onPressNewPage={() => {}} />
    </View>
  );
}
