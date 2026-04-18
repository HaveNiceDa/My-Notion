import { useCallback, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import tw from "twrnc";

import { mockHomeWorkspace } from "../mock/home-mock-data";
import type { HomePageItem } from "../types";
import { CollapsibleSection } from "./collapsible-section";
import { HomeBottomBar } from "./home-bottom-bar";
import { HomeHeader } from "./home-header";
import { RecentSection } from "./recent-section";
import { WorkspacePageRow } from "./workspace-page-row";

export type HomeScreenProps = {
  /** 由路由层注入，避免在 feature 内直接依赖 Clerk */
  onOpenAccountMenu?: () => void;
};

export function HomeScreen({ onOpenAccountMenu }: HomeScreenProps) {
  const data = useMemo(() => mockHomeWorkspace, []);
  const insets = useSafeAreaInsets();

  const [sections, setSections] = useState({
    knowledgeBase: true,
    favorites: false,
    private: true,
  });

  const [treeOpen, setTreeOpen] = useState<Set<string>>(() => {
    const s = new Set<string>();
    data.privatePages.forEach((p) => {
      if (p.children?.length) s.add(p.id);
    });
    return s;
  });

  const toggleSection = useCallback((key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleTree = useCallback((id: string) => {
    setTreeOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const bottomOffset = Math.max(insets.bottom, 10) + 56;

  return (
    <View style={tw`flex-1 bg-[#f7f7f5]`}>
      <HomeHeader
        workspaceTitle={data.workspaceTitle}
        onPressInbox={() => {}}
        onPressMenu={onOpenAccountMenu}
      />

      <ScrollView
        style={tw`flex-1`}
        contentContainerStyle={[tw`pb-4`, { paddingBottom: bottomOffset }]}
        scrollIndicatorInsets={{ bottom: bottomOffset }}
      >
        <RecentSection title="最近" items={data.recent} />

        <View style={tw`px-1`}>
          <CollapsibleSection
            title="知识库"
            expanded={sections.knowledgeBase}
            onToggle={() => toggleSection("knowledgeBase")}
          >
            {data.knowledgeBase.map((item: HomePageItem) => (
              <WorkspacePageRow
                key={item.id}
                item={item}
                expandedIds={treeOpen}
                onToggleExpand={toggleTree}
              />
            ))}
          </CollapsibleSection>

          <CollapsibleSection
            title="收藏"
            expanded={sections.favorites}
            onToggle={() => toggleSection("favorites")}
          >
            {data.favorites.map((item: HomePageItem) => (
              <WorkspacePageRow
                key={item.id}
                item={item}
                expandedIds={treeOpen}
                onToggleExpand={toggleTree}
              />
            ))}
          </CollapsibleSection>

          <CollapsibleSection
            title="私人"
            expanded={sections.private}
            onToggle={() => toggleSection("private")}
          >
            {data.privatePages.map((item: HomePageItem) => (
              <WorkspacePageRow
                key={item.id}
                item={item}
                expandedIds={treeOpen}
                onToggleExpand={toggleTree}
              />
            ))}
          </CollapsibleSection>
        </View>
      </ScrollView>

      <HomeBottomBar onPressSearch={() => {}} onPressAi={() => {}} onPressNewPage={() => {}} />
    </View>
  );
}
