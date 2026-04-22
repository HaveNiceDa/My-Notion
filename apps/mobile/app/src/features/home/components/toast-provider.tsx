import { createContext, useCallback, useContext, useState } from "react";
import { Animated, Pressable } from "react-native";
import { Text, View, useTheme } from "tamagui";
import tw from "twrnc";

type ToastItem = {
  id: number;
  message: string;
  type: "success" | "error";
};

type ToastContextType = {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
};

const ToastContext = createContext<ToastContextType>({
  showSuccess: () => {},
  showError: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (message: string, type: "success" | "error") => {
      const id = ++toastIdCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2200);
    },
    [],
  );

  const showSuccess = useCallback(
    (message: string) => addToast(message, "success"),
    [addToast],
  );

  const showError = useCallback(
    (message: string) => addToast(message, "error"),
    [addToast],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showSuccess, showError }}>
      {children}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: 60,
          left: 0,
          right: 0,
          alignItems: "center",
          zIndex: 9999,
        }}
      >
        {toasts.map((toast) => (
          <Pressable
            key={toast.id}
            onPress={() => removeToast(toast.id)}
            style={{
              marginBottom: 8,
              paddingHorizontal: 20,
              paddingVertical: 10,
              borderRadius: 20,
              backgroundColor:
                toast.type === "success"
                  ? theme.primary.val
                  : "#ef4444",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 5,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 14,
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              {toast.message}
            </Text>
          </Pressable>
        ))}
      </View>
    </ToastContext.Provider>
  );
}
