// types.ts
export interface Document {
  id: string;
  title: string;
  content: string;
  userId: string;
  vectorId: string | null;
  metadata: Record<string, any>;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  fileType: string;
}

export interface URL {
  id: string;
  url: string;
  title: string;
  content: string;
  lastAccessed: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  format: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Vector {
  id: string;
  contentType: string;
  contentId: string;
  embedding: number[];
  createdAt: Date;
}

export interface SharedContent {
  id: string;
  ownerId: string;
  sharedWithId: string;
  contentType: string;
  contentId: string;
  permissions: {
    read: boolean;
    write: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}
export interface VectorResult {
  id: string;
  user_id: string;
  content_type: string;
  content_id: string;
  metadata: string;
}