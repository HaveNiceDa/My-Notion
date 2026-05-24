import { useMemo } from "react";
import { DefaultChatTransport } from "ai";
import { useAuth, useClerk } from "@clerk/nextjs";
import { getInitialAIModelId } from "@/src/components/ai-chat/models";

export function useEditorAITransport() {
  const { isSignedIn, isLoaded } = useAuth();
  const { openSignIn } = useClerk();
  const model = getInitialAIModelId();

  return useMemo(() => {
    const authFetch: typeof globalThis.fetch = async (input, init) => {
      if (isLoaded && !isSignedIn) {
        openSignIn({});
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }
      return globalThis.fetch(input, init);
    };

    return new DefaultChatTransport({
      api: "/api/editor-ai/streamText",
      fetch: authFetch,
      body: {
        modelId: model,
      },
    });
  }, [model, isSignedIn, isLoaded, openSignIn]);
}
