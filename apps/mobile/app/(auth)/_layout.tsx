import { useAuth } from "@clerk/expo";
import { Redirect, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { AppLoadingScreen } from "@/components/app-loading-screen";

export default function AuthRoutesLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const { t } = useTranslation();

  if (!isLoaded) {
    return <AppLoadingScreen message={t("AppLoading.auth")} />;
  }

  if (isSignedIn) {
    return <Redirect href="/" />;
  }

  return <Stack />;
}
