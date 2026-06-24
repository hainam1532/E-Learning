import { useEffect, useRef, useState, useCallback } from "react";
import { getVideoStreamUrl } from "../services/video/video.get";
import { getLessonProgress, updateProgress } from "../services/progress";
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
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { Progress, message, Modal } from "antd";

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
  trackProgress?: boolean;
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
  videoName,
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
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [savedSeconds, setSavedSeconds] = useState(0);
  const [pendingPlay, setPendingPlay] = useState(false);

  const watermark = courseRule?.showWatermark ? "E+ Learning" : null;

  // Load video stream URL
  useEffect(() => {
    const loadStreamUrl = async () => {
      try {
        setLoading(true);
        const result = await getVideoStreamUrl(videoId);
        setStreamUrl(result.data.streamUrl);
        setLoading(false);
      } catch (err) {
        setError("Failed to load video");
        setLoading(false);
      }
    };
    loadStreamUrl();
  }, [videoId]);

  // Fetch saved progress when lessonId is provided
  useEffect(() => {
    const fetchSavedProgress = async () => {
      if (!trackProgress || !lessonId) return;

      try {
        if (initialSeconds > 0) {
          setCurrentTime(initialSeconds);
          setLastSavedTime(initialSeconds);
          return;
        }

        const progress = await getLessonProgress(lessonId);
        if (progress && progress.watchedSeconds > 0 && !progress.completed) {
          setSavedSeconds(progress.watchedSeconds);
          setShowResumeModal(true);
        }
      } catch (err) {
        console.error("Failed to fetch saved progress:", err);
      }
    };

    fetchSavedProgress();
  }, [lessonId, trackProgress, initialSeconds]);

  // Handle resume from saved position
  const handleResumeFromSaved = useCallback(() => {
    if (videoRef.current && savedSeconds > 0) {
      videoRef.current.currentTime = savedSeconds;
      setCurrentTime(savedSeconds);
      setLastSavedTime(savedSeconds);
    }
    setShowResumeModal(false);
    setPendingPlay(true);
  }, [savedSeconds]);

  // Handle start from beginning
  const handleStartFromBeginning = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      setCurrentTime(0);
    }
    setShowResumeModal(false);
    setPendingPlay(true);
  }, []);

  // Set initial position when video is loaded
  useEffect(() => {
    if (videoRef.current && !loading) {
      const startTime = initialSeconds > 0 ? initialSeconds : currentTime;
      if (startTime > 0) {
        videoRef.current.currentTime = startTime;
        setCurrentTime(startTime);
      }
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
          console.error("Failed to save progress:", err);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [trackProgress, lessonId, playing, lastSavedTime, onTimeUpdate]);

  // Handle pending play after modal decision
  useEffect(() => {
    if (pendingPlay && videoRef.current && !loading) {
      videoRef.current
        .play()
        .then(() => {
          setPlaying(true);
          onPlayingChange?.(true);
        })
        .catch(console.error);
      setPendingPlay(false);
    }
  }, [pendingPlay, loading, onPlayingChange]);

  // Handle video events
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);

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

    if (trackProgress && lessonId) {
      try {
        if (courseRule?.requireFullCompletion) {
          const percentWatched = (currentTime / duration) * 100;
          if (percentWatched >= 90) {
            await updateProgress(lessonId, Math.floor(currentTime), true);
            onComplete?.();
            message.success("Video completed!");
          } else {
            message.warning(
              "You need to watch at least 90% of the video to complete",
            );
          }
        } else {
          await updateProgress(lessonId, Math.floor(currentTime), true);
          onComplete?.();
          message.success("Video completed!");
        }
      } catch (err) {
        console.error("Failed to save progress:", err);
      }
    }
  }, [
    trackProgress,
    lessonId,
    currentTime,
    duration,
    courseRule?.requireFullCompletion,
    onComplete,
  ]);

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

  const handlePause = useCallback(async () => {
    setPlaying(false);
    onPlayingChange?.(false);

    if (trackProgress && lessonId && videoRef.current) {
      const currentSec = Math.floor(videoRef.current.currentTime);
      try {
        await updateProgress(lessonId, currentSec, false);
        setLastSavedTime(currentSec);
      } catch (err) {
        console.error("Failed to save progress on pause:", err);
      }
    }
  }, [trackProgress, lessonId, onPlayingChange]);

  // Save progress on component unmount
  useEffect(() => {
    return () => {
      if (trackProgress && lessonId && videoRef.current) {
        const currentSec = Math.floor(videoRef.current.currentTime);
        if (currentSec > lastSavedTime) {
          updateProgress(lessonId, currentSec, false).catch(console.error);
        }
      }
    };
  }, [trackProgress, lessonId, lastSavedTime]);

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
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleDownload = () => {
    if (courseRule?.blockDownload) {
      message.warning("Download is disabled for this course");
      return;
    }
    message.info("Download feature coming soon");
  };

  const handleVolumeChange = (value: number) => {
    setVolume(value);
    if (videoRef.current) {
      videoRef.current.volume = value / 100;
      setIsMuted(value === 0);
    }
  };

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

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(
        0,
        Math.min(duration, videoRef.current.currentTime + seconds),
      );
    }
  };

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

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
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
    <>
      <Modal
        open={showResumeModal}
        title={
          <span className="flex items-center gap-2">
            <QuestionCircleOutlined className="text-blue-500" />
            Tiếp tục xem video?
          </span>
        }
        onCancel={() => {
          setShowResumeModal(false);
          handleStartFromBeginning();
        }}
        footer={[
          <button
            key="start-over"
            onClick={handleStartFromBeginning}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
          >
            Xem lại từ đầu
          </button>,
          <button
            key="resume"
            onClick={handleResumeFromSaved}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
          >
            Tiếp tục (đến {formatTime(savedSeconds)})
          </button>,
        ]}
closable={false}
        mask={{ closable: false }}
      >
        <p className="text-gray-600">
          Bạn đã xem dừng lại ở phút <strong>{formatTime(savedSeconds)}</strong>
          . Bạn có muốn tiếp tục xem từ đoạn này không?
        </p>
      </Modal>

      <div
        ref={containerRef}
        className="relative aspect-video bg-black rounded-lg overflow-hidden group"
      >
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

        {watermark && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-20">
            <div className="text-white text-6xl font-bold transform -rotate-45">
              {watermark}
            </div>
          </div>
        )}

{!playing && !loading && streamUrl && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-transparent md:opacity-0 md:hover:opacity-100 transition-opacity cursor-pointer"
          >
            <PlayCircleOutlined
              className="text-6xl hover:text-blue-400 transition-colors"
              style={{ color: "white" }}
            />
          </button>
        )}

<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <div className="mb-3">
            <Progress
              percent={progressPercent}
              showInfo={false}
              strokeColor="#3b82f6"
              railColor="rgba(255,255,255,0.3)"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => skipTime(-10)}
                className="text-white text-lg hover:text-blue-400 transition-colors"
                title="Rewind 10s"
              >
                <StepBackwardOutlined />
              </button>

              <button
                onClick={togglePlay}
                className="text-white text-3xl hover:text-blue-400 transition-colors"
              >
                {playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              </button>

              <span className="text-white text-sm ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 group/vol">
                <button
                  onClick={toggleMute}
                  className="text-white text-lg hover:text-blue-400 transition-colors"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted || volume === 0 ? (
                    <SoundOutlined />
                  ) : (
                    <SoundOutlined />
                  )}
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

              {courseRule?.lockSpeed1x && (
                <span className="text-yellow-400 text-sm flex items-center gap-1">
                  <LockOutlined /> 1x
                </span>
              )}

              <button
                onClick={toggleFullscreen}
                className="text-white text-lg hover:text-blue-400 transition-colors"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <CompressOutlined /> : <ExpandOutlined />}
              </button>

              <button
                onClick={handleDownload}
                className={`text-white text-lg hover:text-blue-400 transition-colors ${
                  courseRule?.blockDownload
                    ? "opacity-50 cursor-not-allowed"
                    : ""
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
    </>
  );
}
