import api from "../api";

export interface UploadVideoResponse {
  success: boolean;
  message: string;
  data: {
    videoId: number;
    lessonId: number;
    status: string;
  };
}

export interface UploadVideoParams {
  lessonId?: number;
  video: File;
  name?: string;
}

// Upload video
export async function uploadVideo(
  params: UploadVideoParams,
  onProgress?: (progress: number) => void
): Promise<UploadVideoResponse> {
  const formData = new FormData();
  formData.append("video", params.video);
  if (params.lessonId) {
    formData.append("lessonId", String(params.lessonId));
  }
  if (params.name) {
    formData.append("name", params.name);
  }

  const response = await api.post<UploadVideoResponse>("/videos/upload", formData, {
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
