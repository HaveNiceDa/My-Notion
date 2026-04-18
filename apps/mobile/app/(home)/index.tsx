import { useClerk } from "@clerk/expo";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";

import { HomeScreen } from "@/features/home/components/home-screen";

export default function HomeRoute() {
  const { signOut } = useClerk();
  const { t } = useTranslation();

  const openAccountMenu = () => {
    Alert.alert(t("Home.account"), undefined, [
      { text: t("Modals.confirm.cancel"), style: "cancel" },
      { text: t("common.logOut"), style: "destructive", onPress: () => void signOut() },
    ]);
  };

  return <HomeScreen onOpenAccountMenu={openAccountMenu} />;
}
