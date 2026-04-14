import { ConvexReactClient } from "convex/react";
export const initConvexClient = (url: string) => {
  return new ConvexReactClient(url, {
    unsavedChangesWarning: false,
  });
};
