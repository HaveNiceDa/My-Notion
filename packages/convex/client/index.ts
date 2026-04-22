import { ConvexReactClient } from "convex/react";

export class ConvexClient {
  private static client: ConvexReactClient | null = null;

  static getClient(url: string) {
    if (!this.client) {
      this.client = new ConvexReactClient(url, {
        unsavedChangesWarning: false,
      });
    }
    return this.client;
  }
}
