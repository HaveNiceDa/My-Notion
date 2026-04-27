import type { KnowledgeBaseDocument } from "./types";

export interface DataSource {
  getKnowledgeBaseDocuments(userId: string): Promise<KnowledgeBaseDocument[]>;
  addThinkingStep?(
    conversationId: string,
    type: string,
    content: string,
    details?: string,
  ): Promise<void>;
  deleteThinkingSteps?(conversationId: string): Promise<number>;
}

import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

const api = anyApi;

interface ConvexDocument {
  _id: string;
  title: string;
  content: string;
}

export class ConvexDataSource implements DataSource {
  private convex: ConvexHttpClient;

  constructor(convexUrl: string, authToken?: string) {
    this.convex = new ConvexHttpClient(convexUrl);
    if (authToken) {
      this.convex.setAuth(authToken);
    }
  }

  async getKnowledgeBaseDocuments(_userId: string): Promise<KnowledgeBaseDocument[]> {
    const documents = await this.convex.query(
      api.aiChat.getKnowledgeBaseDocumentsForRAG,
      {},
    );
    return (documents as ConvexDocument[]).map((doc) => ({
      _id: doc._id,
      title: doc.title,
      content: doc.content,
    }));
  }

  async addThinkingStep(
    conversationId: string,
    type: string,
    content: string,
    details?: string,
  ): Promise<void> {
    await this.convex.mutation(api.aiChat.addThinkingStep, {
      conversationId,
      type,
      content,
      details,
    });
  }

  async deleteThinkingSteps(conversationId: string): Promise<number> {
    return await this.convex.mutation(api.aiChat.deleteThinkingSteps, {
      conversationId,
    });
  }
}
