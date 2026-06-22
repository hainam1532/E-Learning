import api from "../api";

// Video types
export type VideoStatus = "PROCESSING" | "COMPLETED" | "FAILED";

export interface Video {
  id: number;
  lessonId: number | null;
  bucket: string;
  path: string;
  hlsPath: string | null;
  name: string | null;
  thumbnailUrl: string | null;
  duration: number | null;
  status: VideoStatus;
  progress: number;  // 0-100%
  streamingUrl: string | null;
  lesson?: {
    id: number;
    title: string;
    course: {
      id: number;
      title: string;
    };
  };
}

export interface VideoListResponse {
  success: boolean;
  data: Video[];
}

export interface VideoDetailResponse {
  success: boolean;
  data: Video;
}

export interface VideoStreamResponse {
  success: boolean;
  data: {
    streamUrl: string;
    videoId: number;
    duration: number | null;
  };
}

export interface ApiResponse {
  success: boolean;
  message: string;
}

// Update video request
export interface UpdateVideoRequest {
  name?: string;
}

// Get all videos
export async function getVideos(): Promise<Video[]> {
  const response = await api.get<VideoListResponse>("/videos");
  return response.data.data;
}

// Get video by ID
export async function getVideo(id: number): Promise<Video> {
  const response = await api.get<VideoDetailResponse>(`/videos/${id}`);
  return response.data.data;
}

// Get video streaming URL
export async function getVideoStreamUrl(id: number): Promise<VideoStreamResponse> {
  const response = await api.get<VideoStreamResponse>(`/videos/${id}/stream`);
  return response.data;
}

// Reprocess video
export async function reprocessVideo(id: number): Promise<ApiResponse> {
  const response = await api.post<ApiResponse>(`/videos/${id}/reprocess`);
  return response.data;
}

// Delete video
export async function deleteVideo(id: number): Promise<ApiResponse> {
  const response = await api.delete<ApiResponse>(`/videos/${id}`);
  return response.data;
}

// Update video name
export async function updateVideo(id: number, data: UpdateVideoRequest): Promise<ApiResponse> {
  const response = await api.put<ApiResponse>(`/videos/${id}`, data);
  return response.data;
}

// Upload thumbnail
export async function uploadThumbnail(id: number, file: File): Promise<ApiResponse & { thumbnailUrl?: string }> {
  const formData = new FormData();
  formData.append("thumbnail", file);
  
  const response = await api.post<ApiResponse & { thumbnailUrl: string }>(
    `/videos/${id}/thumbnail`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );
  return response.data;
}
