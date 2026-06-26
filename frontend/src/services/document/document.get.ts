import api from "../api";

// Document types
export type DocumentType = "xlsx" | "docx" | "pdf" | "pptx";

export interface Document {
  id: number;
  name: string | null;
  type: string;
  size: number;
  bucket: string;
  path: string;
  url: string;
  createdAt: string;
}

export interface DocumentListResponse {
  success: boolean;
  data: Document[];
}

export interface DocumentDetailResponse {
  success: boolean;
  data: Document;
}

export interface ApiResponse {
  success: boolean;
  message: string;
}

// Get all documents
export async function getDocuments(): Promise<Document[]> {
  const response = await api.get<DocumentListResponse>("/documents");
  return response.data.data;
}

// Get document by ID
export async function getDocument(id: number): Promise<Document> {
  const response = await api.get<DocumentDetailResponse>(`/documents/${id}`);
  return response.data.data;
}

// Get document file content as blob (for inline preview/parsing)
export async function getDocumentBlob(id: number): Promise<Blob> {
  const response = await api.get(`/documents/${id}/content`, {
    responseType: "blob",
  });
  return response.data as Blob;
}

// Delete document
export async function deleteDocument(id: number): Promise<ApiResponse> {
  const response = await api.delete<ApiResponse>(`/documents/${id}`);
  return response.data;
}
