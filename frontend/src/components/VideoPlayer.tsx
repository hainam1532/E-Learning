import { useEffect, useRef, useState, useCallback } from 'react';
import { getVideoStreamUrl } from '../services/video/video.get';
import { updateProgress } from '../services/progress';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  SyncOutlined,
  LockOutlined,
  DownloadOutlined,
  SoundOutlined,
  ExpandOutlined,
  CompressOutlined,
  StepBackwardOutlined,
  StepForwardOutlined
} from '@ant-design/icons';
import { Progress, message } from 'antd';

interface VideoPlayerProps {
  videoId: number;
  courseRule?: {
    antiFastForward: boolean;
    lockSpeed1x: boolean;
    showWatermark: boolean;
    blockDownload: boolean;
    requireFullCompletion: boolean;
  };
  initialSeconds?: number;
  lessonId?: number;
  trackProgress?: boolean; // Only track progress for academy courses
  onTimeUpdate?: (seconds: number) => void;
  onComplete?: () => void;
  onPlayingChange?: (playing: boolean) => void;
  videoName?: string | null;
}

export default function VideoPlayer({
  videoId,
  courseRule,
  initialSeconds = 0,
  lessonId,
  trackProgress = false,
  onTimeUpdate,
  onComplete,
  onPlayingChange,
  videoName
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [lastSavedTime, setLastSavedTime] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Watermark overlay
  const watermark = courseRule?.showWatermark ? 'E+ Learning' : null;

  // Load video stream URL
  useEffect(() => {
    const loadStreamUrl = async () => {
      try {
        setLoading(true);
        const result = await getVideoStreamUrl(videoId);
        setStreamUrl(result.data.streamUrl);
        setLoading(false);
      } catch (err) {
        setError('Failed to load video');
        setLoading(false);
      }
    };
    loadStreamUrl();
  }, [videoId]);

  // Set initial position when video is loaded
  useEffect(() => {
    if (videoRef.current && initialSeconds > 0 && !loading) {
      videoRef.current.currentTime = initialSeconds;
      setCurrentTime(initialSeconds);
    }
  }, [initialSeconds, loading]);

// Track progress periodically (every 10 seconds)
  useEffect(() => {
    if (!trackProgress || !lessonId || !playing) return;

    const interval = setInterval(async () => {
      const currentSec = Math.floor(videoRef.current?.currentTime || 0);
      if (currentSec > lastSavedTime + 10) {
        try {
          await updateProgress(lessonId, currentSec, false);
          setLastSavedTime(currentSec);
          onTimeUpdate?.(currentSec);
        } catch (err) {
          console.error('Failed to save progress:', err);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [trackProgress, lessonId, playing, lastSavedTime, onTimeUpdate]);

  // Handle video events
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
      // Anti-fast-forward rule
      if (courseRule?.antiFastForward && videoRef.current.playbackRate > 1) {
        videoRef.current.playbackRate = 1;
        setPlaybackRate(1);
      }
    }
  }, [courseRule?.antiFastForward]);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const handleEnded = useCallback(async () => {
    setPlaying(false);
    
    // Save final progress
    if (trackProgress && lessonId) {
      try {
        // Check if requireFullCompletion is enabled
        if (courseRule?.requireFullCompletion) {
          // Only mark complete if watched >= 90% of video
          const percentWatched = (currentTime / duration) * 100;
          if (percentWatched >= 90) {
            await updateProgress(lessonId, Math.floor(currentTime), true);
            onComplete?.();
            message.success('Video completed!');
          } else {
            message.warning('You need to watch at least 90% of the video to complete');
          }
        } else {
          await updateProgress(lessonId, Math.floor(currentTime), true);
          onComplete?.();
          message.success('Video completed!');
        }
      } catch (err) {
        console.error('Failed to save progress:', err);
      }
    }
  }, [trackProgress, lessonId, currentTime, duration, courseRule?.requireFullCompletion, onComplete]);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  }, [playing]);

const handlePlay = useCallback(() => {
    setPlaying(true);
    onPlayingChange?.(true);
  }, [onPlayingChange]);
  
  const handlePause = useCallback(() => {
    setPlaying(false);
    onPlayingChange?.(false);
  }, [onPlayingChange]);

  // Lock speed at 1x if rule is enabled
  useEffect(() => {
    if (courseRule?.lockSpeed1x && videoRef.current) {
      videoRef.current.playbackRate = 1;
      setPlaybackRate(1);
    }
  }, [courseRule?.lockSpeed1x]);

  // Format time (seconds to MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

// Download handler
  const handleDownload = () => {
    if (courseRule?.blockDownload) {
      message.warning('Download is disabled for this course');
      return;
    }
    // Trigger download - in production, this would be a signed URL
    message.info('Download feature coming soon');
  };

  // Volume handler
  const handleVolumeChange = (value: number) => {
    setVolume(value);
    if (videoRef.current) {
      videoRef.current.volume = value / 100;
      setIsMuted(value === 0);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume / 100;
        setIsMuted(false);
      } else {
        videoRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  // Skip forward/backward
  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    }
  };

  // Fullscreen handler
  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (loading) {
    return (
      <div className="relative aspect-video bg-slate-900 rounded-lg flex items-center justify-center">
        <div className="text-white text-center">
          <SyncOutlined spin className="text-4xl mb-4 text-blue-500" />
          <p>Loading video...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative aspect-video bg-slate-900 rounded-lg flex items-center justify-center">
        <div className="text-red-500 text-center">
          <p className="text-xl font-semibold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!streamUrl) {
    return (
      <div className="relative aspect-video bg-slate-900 rounded-lg flex items-center justify-center">
        <div className="text-white text-center">
          <p>Video not available</p>
        </div>
      </div>
    );
  }

return (
    <div ref={containerRef} className="relative aspect-video bg-black rounded-lg overflow-hidden group">
{/* Video Element */}
<video
        ref={videoRef}
        src={streamUrl}
        className="w-full h-full"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={handlePlay}
        onPause={handlePause}
        playsInline
        muted={isMuted}
      />

      {/* Watermark Overlay */}
      {watermark && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-20">
          <div className="text-white text-6xl font-bold transform -rotate-45">
            {watermark}
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Progress Bar */}
        <div className="mb-3">
          <Progress 
            percent={progressPercent} 
            showInfo={false}
            strokeColor="#3b82f6"
            railColor="rgba(255,255,255,0.3)"
          />
        </div>

        {/* Control Buttons - Left Side */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Skip Backward */}
            <button 
              onClick={() => skipTime(-10)}
              className="text-white text-lg hover:text-blue-400 transition-colors"
              title="Rewind 10s"
            >
              <StepBackwardOutlined />
            </button>

            {/* Play/Pause */}
            <button 
              onClick={togglePlay}
              className="text-white text-3xl hover:text-blue-400 transition-colors"
            >
              {playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            </button>

            {/* Skip Forward */}
            <button 
              onClick={() => skipTime(10)}
              className="text-white text-lg hover:text-blue-400 transition-colors"
              title="Forward 10s"
            >
              <StepForwardOutlined />
            </button>

            {/* Time Display */}
            <span className="text-white text-sm ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Control Buttons - Right Side */}
          <div className="flex items-center gap-2">
{/* Volume Control */}
            <div className="flex items-center gap-1 group/vol">
              <button 
                onClick={toggleMute}
                className="text-white text-lg hover:text-blue-400 transition-colors"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <SoundOutlined /> : <SoundOutlined />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-16 h-1 cursor-pointer accent-blue-500"
                title={`Volume: ${volume}%`}
              />
            </div>

            {/* Speed Indicator */}
            {courseRule?.lockSpeed1x && (
              <span className="text-yellow-400 text-sm flex items-center gap-1">
                <LockOutlined /> 1x
              </span>
            )}

            {/* Fullscreen */}
            <button 
              onClick={toggleFullscreen}
              className="text-white text-lg hover:text-blue-400 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
            </button>

            {/* Download */}
            <button 
              onClick={handleDownload}
              className={`text-white text-lg hover:text-blue-400 transition-colors ${
                courseRule?.blockDownload ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={courseRule?.blockDownload}
              title="Download"
            >
              <DownloadOutlined />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
