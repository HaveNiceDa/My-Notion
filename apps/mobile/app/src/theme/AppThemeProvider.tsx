import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";

export type AppThemeName = "light" | "dark";

type AppThemeContextValue = {
  isLoading: boolean;
  theme: AppThemeName;
  setTheme: (nextTheme: AppThemeName) => Promise<void>;
};

const THEME_STORAGE_KEY = "@notion/theme";

const AppThemeContext = createContext<AppThemeContextValue>({
  isLoading: true,
  theme: "light",
  setTheme: async () => {},
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setThemeState] = useState<AppThemeName>("light");

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme === "light" || savedTheme === "dark") {
          setThemeState(savedTheme);
        }
      } catch (error) {
        console.error("Failed to load app theme:", error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadTheme();
  }, []);

  const setTheme = async (nextTheme: AppThemeName) => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setThemeState(nextTheme);
  };

  return (
    <AppThemeContext.Provider value={{ isLoading, theme, setTheme }}>
      {children}
    </AppThemeContext.Provider>
  );
}

export const useAppTheme = () => useContext(AppThemeContext);
