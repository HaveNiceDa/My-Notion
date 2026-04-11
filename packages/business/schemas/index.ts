import { z } from "zod";

export const DocumentSchema = z.object({
  _id: z.string(),
  title: z.string(),
  userId: z.string(),
  content: z.string().optional(),
  coverImage: z.string().optional(),
  icon: z.string().optional(),
  isArchived: z.boolean(),
  isPublished: z.boolean(),
  isStarred: z.boolean().optional(),
  isInKnowledgeBase: z.boolean().optional(),
  parentDocument: z.string().optional(),
  lastEditedTime: z.number().optional(),
  _creationTime: z.number(),
});

export type Document = z.infer<typeof DocumentSchema>;

export const AIConversationSchema = z.object({
  _id: z.string(),
  userId: z.string(),
  title: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  _creationTime: z.number(),
});

export type AIConversation = z.infer<typeof AIConversationSchema>;

export const AIMessageSchema = z.object({
  _id: z.string(),
  conversationId: z.string(),
  content: z.string(),
  role: z.union([z.literal("user"), z.literal("assistant")]),
  createdAt: z.number(),
  documentId: z.string().optional(),
  _creationTime: z.number(),
});

export type AIMessage = z.infer<typeof AIMessageSchema>;

export const AIThinkingStepSchema = z.object({
  _id: z.string(),
  conversationId: z.string(),
  messageId: z.string().optional(),
  type: z.string(),
  content: z.string(),
  details: z.string().optional(),
  createdAt: z.number(),
  _creationTime: z.number(),
});

export type AIThinkingStep = z.infer<typeof AIThinkingStepSchema>;
