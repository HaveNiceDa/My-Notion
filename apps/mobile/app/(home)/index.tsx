import { useClerk } from "@clerk/expo";
import { Alert } from "react-native";

import { HomeScreen } from "@/features/home/components/home-screen";

export default function HomeRoute() {
  const { signOut } = useClerk();

  const openAccountMenu = () => {
    Alert.alert("账户", undefined, [
      { text: "取消", style: "cancel" },
      { text: "退出登录", style: "destructive", onPress: () => void signOut() },
    ]);
  };

  return <HomeScreen onOpenAccountMenu={openAccountMenu} />;
}
