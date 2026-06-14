import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { AppLoadingScreen } from "@/components/app-loading-screen";

export default function Layout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { t } = useTranslation();

  if (!isLoaded) {
    return <AppLoadingScreen message={t("AppLoading.workspace")} />;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
