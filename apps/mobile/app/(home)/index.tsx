import { useClerk } from "@clerk/expo";

import { HomeScreen } from "@/features/home/components/home-screen";

export default function HomeRoute() {
  const { signOut } = useClerk();

  return <HomeScreen signOut={signOut} />;
}
