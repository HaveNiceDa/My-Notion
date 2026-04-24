import React, { useState } from "react";
import { Modal, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Button, ScrollView, Text, View, useTheme, TamaguiProvider, Theme } from "tamagui";
import tw from "twrnc";
import { config as tamaguiConfig } from "@tamagui/config";
import { useUser } from "@clerk/expo";

import { useAppTheme, type AppThemeName } from "@/theme/AppThemeProvider";
import { useLanguage } from "@/i18n/useLanguage";
import type { SupportedLanguage } from "@/i18n";
import { useSettings } from "@notion/business/hooks";

export function SettingsModal({ signOut }: { signOut?: () => void }) {
  const { t } = useTranslation();
  const { theme: appTheme, setTheme } = useAppTheme();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { currentLanguage, switchLanguage } = useLanguage();
  const { isOpen, onClose } = useSettings();

  const [section, setSection] = useState<"main" | "language" | "theme" | "account">("main");

  const handleSwitchLanguage = async (lang: SupportedLanguage) => {
    await switchLanguage(lang);
    setSection("main");
  };

  const handleSetTheme = async (nextTheme: AppThemeName) => {
    await setTheme(nextTheme);
    setSection("main");
  };

  const languageOptions: { value: SupportedLanguage; label: string }[] = [
    { value: "zh-CN", label: t("Home.languageSimplifiedChinese") },
    { value: "zh-TW", label: t("Home.languageTraditionalChinese") },
    { value: "en", label: t("Home.languageEnglish") },
  ];

  const themeOptions: { value: AppThemeName; label: string }[] = [
    { value: "light", label: t("Home.themeLight") },
    { value: "light_blue", label: t("Home.themeBlueLight") },
  ];

  const workspaceTitle =
    user?.firstName != null && user.firstName.length > 0
      ? t("Home.workspaceOwned", { name: user.firstName })
      : t("Home.myWorkspace");

  const renderMain = () => (
    <>
      <View style={tw`px-4 py-3 flex-row items-center gap-3`}>
        <View
          style={[
            tw`w-10 h-10 rounded-full items-center justify-center`,
            { backgroundColor: theme.backgroundHover.val },
          ]}
        >
          <Ionicons name="person-outline" size={20} color={theme.color.val} />
        </View>
        <View style={tw`flex-1`}>
          <Text style={[tw`font-semibold`, { color: theme.color.val }]}>
            {user?.fullName ?? t("Home.myWorkspace")}
          </Text>
          <Text style={[tw`text-xs mt-0.5`, { color: theme.placeholderColor.val }]}>
            {workspaceTitle}
          </Text>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: theme.borderColor.val }} />

      <Pressable
        onPress={() => setSection("language")}
        style={({ pressed }) => [
          tw`flex-row items-center justify-between px-4 py-3.5`,
          pressed ? { backgroundColor: theme.backgroundHover.val } : null,
        ]}
      >
        <View style={tw`flex-row items-center gap-3`}>
          <Ionicons name="language-outline" size={20} color={theme.color.val} />
          <Text style={[tw`text-base`, { color: theme.color.val }]}>
            {t("Home.changeLanguage")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.placeholderColor.val} />
      </Pressable>

      <Pressable
        onPress={() => setSection("theme")}
        style={({ pressed }) => [
          tw`flex-row items-center justify-between px-4 py-3.5`,
          pressed ? { backgroundColor: theme.backgroundHover.val } : null,
        ]}
      >
        <View style={tw`flex-row items-center gap-3`}>
          <Ionicons name="color-palette-outline" size={20} color={theme.color.val} />
          <Text style={[tw`text-base`, { color: theme.color.val }]}>
            {t("Home.changeTheme")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.placeholderColor.val} />
      </Pressable>

      <Pressable
        onPress={() => setSection("account")}
        style={({ pressed }) => [
          tw`flex-row items-center justify-between px-4 py-3.5`,
          pressed ? { backgroundColor: theme.backgroundHover.val } : null,
        ]}
      >
        <View style={tw`flex-row items-center gap-3`}>
          <Ionicons name="person-circle-outline" size={20} color={theme.color.val} />
          <Text style={[tw`text-base`, { color: theme.color.val }]}>
            {t("Home.account")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.placeholderColor.val} />
      </Pressable>
    </>
  );

  const renderLanguage = () => (
    <>
      <View style={tw`flex-row items-center px-4 py-3`}>
        <Pressable onPress={() => setSection("main")} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={theme.primary.val} />
        </Pressable>
        <Text style={[tw`text-base font-semibold flex-1 text-center mr-6`, { color: theme.color.val }]}>
          {t("Home.selectLanguage")}
        </Text>
      </View>
      <View style={{ height: 1, backgroundColor: theme.borderColor.val }} />
      {languageOptions.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => void handleSwitchLanguage(option.value)}
          style={({ pressed }) => [
            tw`flex-row items-center justify-between px-4 py-3.5`,
            pressed ? { backgroundColor: theme.backgroundHover.val } : null,
          ]}
        >
          <Text style={[tw`text-base`, { color: theme.color.val }]}>
            {option.label}
          </Text>
          {currentLanguage === option.value && (
            <Ionicons name="checkmark" size={20} color={theme.primary.val} />
          )}
        </Pressable>
      ))}
    </>
  );

  const renderTheme = () => (
    <>
      <View style={tw`flex-row items-center px-4 py-3`}>
        <Pressable onPress={() => setSection("main")} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={theme.primary.val} />
        </Pressable>
        <Text style={[tw`text-base font-semibold flex-1 text-center mr-6`, { color: theme.color.val }]}>
          {t("Home.selectTheme")}
        </Text>
      </View>
      <View style={{ height: 1, backgroundColor: theme.borderColor.val }} />
      {themeOptions.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => void handleSetTheme(option.value)}
          style={({ pressed }) => [
            tw`flex-row items-center justify-between px-4 py-3.5`,
            pressed ? { backgroundColor: theme.backgroundHover.val } : null,
          ]}
        >
          <Text style={[tw`text-base`, { color: theme.color.val }]}>
            {option.label}
          </Text>
          {appTheme === option.value && (
            <Ionicons name="checkmark" size={20} color={theme.primary.val} />
          )}
        </Pressable>
      ))}
    </>
  );

  const renderAccount = () => (
    <>
      <View style={tw`flex-row items-center px-4 py-3`}>
        <Pressable onPress={() => setSection("main")} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={theme.primary.val} />
        </Pressable>
        <Text style={[tw`text-base font-semibold flex-1 text-center mr-6`, { color: theme.color.val }]}>
          {t("Home.account")}
        </Text>
      </View>
      <View style={{ height: 1, backgroundColor: theme.borderColor.val }} />
      <View style={tw`px-4 py-4`}>
        <View style={tw`flex-row items-center gap-3 mb-4`}>
          <View
            style={[
              tw`w-12 h-12 rounded-full items-center justify-center`,
              { backgroundColor: theme.backgroundHover.val },
            ]}
          >
            <Ionicons name="person" size={24} color={theme.color.val} />
          </View>
          <View style={tw`flex-1`}>
            <Text style={[tw`font-semibold`, { color: theme.color.val }]}>
              {user?.fullName ?? ""}
            </Text>
            <Text style={[tw`text-sm mt-0.5`, { color: theme.placeholderColor.val }]}>
              {user?.primaryEmailAddress?.emailAddress ?? ""}
            </Text>
          </View>
        </View>
        <Button
          theme="red"
          onPress={() => {
            void signOut?.();
            onClose();
          }}
          style={tw`w-full rounded-xl`}
        >
          <Text style={tw`font-semibold`}>{t("common.logOut")}</Text>
        </Button>
      </View>
    </>
  );

  const getTitle = () => {
    switch (section) {
      case "language":
        return t("Home.selectLanguage");
      case "theme":
        return t("Home.selectTheme");
      case "account":
        return t("Home.account");
      default:
        return t("Navigation.settings");
    }
  };

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
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
                  paddingTop: insets.top + 8,
                },
              ]}
            >
              <View style={tw`flex-row items-center px-4 pb-3`}>
                {section === "main" ? (
                  <Pressable onPress={onClose} hitSlop={10}>
                    <Text style={[tw`font-medium`, { color: theme.primary.val }]}>
                      {t("Modals.confirm.cancel")}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable onPress={() => setSection("main")} hitSlop={10}>
                    <Ionicons name="chevron-back" size={22} color={theme.primary.val} />
                  </Pressable>
                )}
                <Text
                  style={[
                    tw`text-base font-semibold flex-1 text-center`,
                    { color: theme.color.val },
                    section !== "main" ? tw`mr-6` : {},
                  ]}
                >
                  {getTitle()}
                </Text>
                {section === "main" && <View style={tw`w-12`} />}
              </View>

              <View style={{ height: 1, backgroundColor: theme.borderColor.val }} />

              <ScrollView style={tw`flex-1`} showsVerticalScrollIndicator={false}>
                {section === "main" && renderMain()}
                {section === "language" && renderLanguage()}
                {section === "theme" && renderTheme()}
                {section === "account" && renderAccount()}
              </ScrollView>
            </View>
          </View>
        </Theme>
      </TamaguiProvider>
    </Modal>
  );
}
