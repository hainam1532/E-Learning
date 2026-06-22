declare module '@fontsource/public-sans';

// HLS.js type declarations
declare class Hls {
  static isSupported(): boolean;
  static Events: {
    MANIFEST_PARSED: string;
    ERROR: string;
  };
  loadSource(source: string): void;
  attachMedia(media: HTMLMediaElement): void;
  on(event: string, callback: (event: string, data: any) => void): void;
  destroy(): void;
}

declare global {
  interface Window {
    Hls: typeof Hls;
    hlsInstance: Hls | null;
  }
}

export {};
