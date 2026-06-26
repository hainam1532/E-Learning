import api from "../api";

export interface UploadDocumentResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    name: string;
    type: string;
    size: number;
    url: string;
  };
}

export interface UploadDocumentParams {
  document: File;
  name?: string;
}

// Upload document
export async function uploadDocument(
  params: UploadDocumentParams,
  onProgress?: (progress: number) => void
): Promise<UploadDocumentResponse> {
  const formData = new FormData();
  formData.append("document", params.document);
  if (params.name) {
    formData.append("name", params.name);
  }

  const response = await api.post<UploadDocumentResponse>("/documents/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(percentCompleted);
      }
    },
  });

  return response.data;
}
