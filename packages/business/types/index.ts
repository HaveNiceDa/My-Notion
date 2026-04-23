export interface Document {
  _id: string;
  title: string;
  userId: string;
  content?: string;
  coverImage?: string;
  coverImageStorageId?: string;
  icon?: string;
  isArchived: boolean;
  isPublished: boolean;
  isStarred?: boolean;
  isInKnowledgeBase?: boolean;
  parentDocument?: string;
  lastEditedTime?: number;
  _creationTime: number;
}

export interface AIConversation {
  _id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  _creationTime: number;
}

export interface AIMessage {
  _id: string;
  conversationId: string;
  content: string;
  role: "user" | "assistant";
  createdAt: number;
  documentId?: string;
  _creationTime: number;
}

export interface AIThinkingStep {
  _id: string;
  conversationId: string;
  messageId?: string;
  type: string;
  content: string;
  details?: string;
  createdAt: number;
  _creationTime: number;
}
