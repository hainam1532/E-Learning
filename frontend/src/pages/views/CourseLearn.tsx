import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Typography,
  Spin,
  Avatar,
  Tag,
  message,
  Drawer,
  Tabs,
  Modal
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  BookOutlined,
  UserOutlined,
  StarOutlined,
  GlobalOutlined,
  FileTextOutlined,
  SnippetsOutlined,
  HeartOutlined,
  HeartFilled,
  FileProtectOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { getCourse, getCourseWithProgress } from '../../services/course';
import { getCourseProgress, markLessonCompleted, toggleVideoLike, getVideoLikeStatus } from '../../services/progress';
import { getMyTrainingPlans, markTrainingResourceCompleted, type UserTrainingPlan, type UserTrainingResource } from '../../services/training';
import { getDocument, getDocumentBlob, type Document } from '../../services/document';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { useAuthStore } from '../../store/authStore';
import VideoPlayer from '../../components/VideoPlayer';
import CourseProgressBar from '../../components/CourseProgressBar';
import type { Course, CourseVideo } from '../../services/course';

const { Title, Text, Paragraph } = Typography;
const CB = '#0056D2';
// ─── Chiều cao navbar app (px) — điều chỉnh nếu khác ───────────────────────
const NAVBAR_H = 0;

export default function CourseLearn() {
  const { courseId, videoId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const lessonIdFromQuery = searchParams.get('lessonId');
  const videoIdFromQuery = searchParams.get('videoId');
  const planIdFromQuery = searchParams.get('planId');
  const { isAuthenticated } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [courseProgress, setCourseProgress] = useState<any>(null);
  const [currentVideoId, setCurrentVideoId] = useState<number | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [contentDrawerOpen, setContentDrawerOpen] = useState(false);
  const [activeContentTab, setActiveContentTab] = useState('video');
  const [activeInfoTab, setActiveInfoTab] = useState<'overview' | 'resources' | 'about'>('overview');
  const [activeTrainingPlan, setActiveTrainingPlan] = useState<UserTrainingPlan | null>(null);
  const [documentResources, setDocumentResources] = useState<UserTrainingResource[]>([]);
  const [examResources, setExamResources] = useState<UserTrainingResource[]>([]);
  const [documentViewerOpen, setDocumentViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<(Document & { resourceId: number; completed?: boolean }) | null>(null);
  const [completingDocument, setCompletingDocument] = useState(false);
  const [documentPreviewType, setDocumentPreviewType] = useState<'pdf' | 'docx' | 'xlsx' | 'unsupported'>('unsupported');
  const [documentPreviewHtml, setDocumentPreviewHtml] = useState('');
  const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
  const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);

  // ── Lock body scroll để thoát scroll của layout cha ────────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const isAcademyCourse = useMemo(() => !!course?.academyId, [course?.academyId]);
  const trackProgress = isAcademyCourse && isAuthenticated;
  const courseIdNum = useMemo(() => courseId ? parseInt(courseId) : null, [courseId]);
  const videoIdNum = useMemo(() => {
    if (videoId) { const p = parseInt(videoId); if (!isNaN(p)) return p; }
    return null;
  }, [videoId]);

  useEffect(() => {
    const fetchCourse = async () => {
      if (!courseIdNum) { setLoading(false); return; }
      try {
        setLoading(true);
        const courseData = trackProgress
          ? await getCourseWithProgress(courseIdNum)
          : await getCourse(courseIdNum);
        setCourse(courseData);
        if (trackProgress) {
          const progress = await getCourseProgress(courseIdNum);
          setCourseProgress(progress);
        }
        const courseVideoIds = courseData.courseVideos?.map((cv: any) => cv.videoId) || [];
        let targetVideoId = null;
        if (videoIdNum && courseVideoIds.includes(videoIdNum)) targetVideoId = videoIdNum;
        if (!targetVideoId && videoIdFromQuery) {
          const p = parseInt(videoIdFromQuery);
          if (!isNaN(p) && courseVideoIds.includes(p)) targetVideoId = p;
        }
        if (!targetVideoId && lessonIdFromQuery) {
          const p = parseInt(lessonIdFromQuery);
          if (!isNaN(p)) {
            const tl = courseData.lessons?.find((l: any) => l.id === p);
            if (tl && tl.videoId && courseVideoIds.includes(tl.videoId)) {
              targetVideoId = tl.videoId;
            } else {
              const sorted = [...(courseData.courseVideos || [])].sort((a: any, b: any) => a.order - b.order);
              const idx = courseData.lessons?.findIndex((l: any) => l.id === p) ?? -1;
              if (idx >= 0 && sorted[idx]) targetVideoId = sorted[idx].videoId;
            }
          }
        }
if (!targetVideoId && (courseData.courseVideos?.length ?? 0) > 0) {
          const sorted = [...(courseData.courseVideos || [])].sort((a: any, b: any) => a.order - b.order);
          targetVideoId = sorted[0]?.videoId;
        }
        if (targetVideoId) setCurrentVideoId(targetVideoId);
      } catch (error) {
        console.error('Failed to fetch course:', error);
        message.error('Failed to load course');
      } finally {
        setLoading(false);
      }
    };
    fetchCourse();
  }, [courseIdNum, videoIdNum, trackProgress]);

  useEffect(() => {
    const load = async () => {
      if (!courseIdNum || !isAuthenticated) { setActiveTrainingPlan(null); setDocumentResources([]); return; }
      try {
        const plans = await getMyTrainingPlans();
        const matched = plans.filter((p: any) => (p.resources || []).some((r: any) => r.type === 'COURSE' && r.refId === courseIdNum));
        if (!matched.length) { setActiveTrainingPlan(null); setDocumentResources([]); return; }
        let sel = matched[0];
        const pid = planIdFromQuery ? parseInt(planIdFromQuery) : NaN;
        if (!isNaN(pid)) { const byQ = matched.find((p: any) => p.id === pid); if (byQ) sel = byQ; }
        setActiveTrainingPlan(sel);
        setDocumentResources((sel.resources || []).filter((r: any) => r.type === 'DOCUMENT'));
        setExamResources((sel.resources || []).filter((r: any) => r.type === 'EXAM'));
      } catch { setActiveTrainingPlan(null); setDocumentResources([]); setExamResources([]); }
    };
    load();
  }, [courseIdNum, isAuthenticated, planIdFromQuery]);

  const videoList = useMemo((): CourseVideo[] => {
    if (!course?.courseVideos) return [];
    return course.courseVideos.sort((a: any, b: any) => a.order - b.order);
  }, [course?.courseVideos]);

  const currentCourseVideo = useMemo(() => {
    if (!currentVideoId || !videoList) return null;
    return videoList.find((v: any) => v.videoId === currentVideoId) || null;
  }, [currentVideoId, videoList]);

  const currentLesson = useMemo(() => {
    if (!currentCourseVideo) return null;
    const lesson = course?.lessons?.find((l: any) => l.videoId === currentCourseVideo.videoId);
    if (lesson) return lesson;
    const idx = videoList.findIndex((v: any) => v.videoId === currentCourseVideo.videoId);
    return idx >= 0 && course?.lessons?.[idx] ? course.lessons[idx] : null;
  }, [course?.lessons, currentCourseVideo, videoList]);

  const handleSelectVideo = (vId: number) => {
    setCurrentVideoId(vId);
    setIsVideoPlaying(false);
    navigate(`/learn/${courseIdNum}/${vId}`, { replace: true });
  };

  const handleVideoComplete = async () => {
    if (!trackProgress || !currentLesson) return;
    try {
      await markLessonCompleted(currentLesson.id);
      if (courseIdNum) { const p = await getCourseProgress(courseIdNum); setCourseProgress(p); }
      const idx = videoList.findIndex((v: any) => v.videoId === currentVideoId);
      if (idx < videoList.length - 1) handleSelectVideo(videoList[idx + 1].videoId);
    } catch (error) { console.error('Failed to mark complete:', error); }
  };

  useEffect(() => {
    const fetch = async () => {
      if (!currentVideoId || !isAuthenticated) return;
      try { const s = await getVideoLikeStatus(currentVideoId); setLiked(s.liked); setLikeCount(s.likeCount); }
      catch { setLiked(false); setLikeCount(0); }
    };
    fetch();
  }, [currentVideoId, isAuthenticated]);

  const handleLike = async () => {
    if (!currentVideoId || !isAuthenticated || likeLoading) return;
    setLikeLoading(true);
    try {
      const r = await toggleVideoLike(currentVideoId);
      setLiked(r.liked); setLikeCount(r.likeCount);
      message.success(r.liked ? 'Đã thêm vào yêu thích' : 'Đã bỏ yêu thích');
    } catch { message.error('Không thể cập nhật yêu thích'); }
    finally { setLikeLoading(false); }
  };

  const getInlineDocumentUrl = (docId: number) => `${apiBaseUrl}/documents/${docId}/content`;
  const getPrettyFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const loadDocumentPreview = async (doc: Document) => {
    const type = (doc.type || '').toLowerCase();
    setDocumentPreviewLoading(true);
    setDocumentPreviewHtml('');
    try {
      if (type === 'pdf') { setDocumentPreviewType('pdf'); return; }
      if (type === 'docx') {
        const blob = await getDocumentBlob(doc.id);
        const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
        setDocumentPreviewType('docx');
        setDocumentPreviewHtml(result.value || '<p>Không có nội dung.</p>');
        return;
      }
      if (type === 'xlsx') {
        const blob = await getDocumentBlob(doc.id);
        const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
        const parts = wb.SheetNames.slice(0, 3).map(name => {
          const html = XLSX.utils.sheet_to_html(wb.Sheets[name], { editable: false });
          return `<h3 style="margin:0 0 12px 0;font-size:16px;color:#334155">Sheet: ${name}</h3>${html}`;
        });
        setDocumentPreviewType('xlsx');
        setDocumentPreviewHtml(parts.join('<hr style="margin:16px 0;border-color:#e2e8f0"/>'));
        return;
      }
      setDocumentPreviewType('unsupported');
    } catch { setDocumentPreviewType('unsupported'); message.error('Không thể render tài liệu, vui lòng mở tab mới.'); }
    finally { setDocumentPreviewLoading(false); }
  };

  const openDocumentViewer = async (resource: UserTrainingResource) => {
    if (!resource.refId) return;
    try {
      let doc: Document;
      if (resource.document?.url) {
        doc = { id: resource.document.id || resource.refId, name: resource.document.name || resource.title_vi || 'Tài liệu', type: resource.document.type || 'pdf', size: resource.document.size || 0, bucket: '', path: '', url: resource.document.url, createdAt: '' };
      } else {
        doc = await getDocument(resource.refId);
      }
      setSelectedDocument({ ...doc, resourceId: resource.id, completed: resource.completed });
      setDocumentViewerOpen(true);
      await loadDocumentPreview(doc);
    } catch { message.error('Không thể mở tài liệu'); }
  };

  const refreshDocumentProgress = async () => {
    if (!courseIdNum || !isAuthenticated) return;
    try {
      const plans = await getMyTrainingPlans();
      const matched = plans.filter((p: any) => (p.resources || []).some((r: any) => r.type === 'COURSE' && r.refId === courseIdNum));
      if (!matched.length) return;
      let sel = matched[0];
      const pid = planIdFromQuery ? parseInt(planIdFromQuery) : NaN;
      if (!isNaN(pid)) { const bq = matched.find((p: any) => p.id === pid); if (bq) sel = bq; }
      const docs = (sel.resources || []).filter((r: any) => r.type === 'DOCUMENT');
      setActiveTrainingPlan(sel);
      setDocumentResources(docs);
      if (selectedDocument) {
        const updated = docs.find((d: any) => d.id === selectedDocument.resourceId);
        if (updated) setSelectedDocument(prev => prev ? { ...prev, completed: updated.completed } : prev);
      }
    } catch { /* no-op */ }
  };

  const handleMarkDocumentCompleted = async () => {
    if (!selectedDocument) return;
    try {
      setCompletingDocument(true);
      await markTrainingResourceCompleted(selectedDocument.resourceId);
      message.success('Đã ghi nhận hoàn thành tài liệu');
      await refreshDocumentProgress();
    } catch { message.error('Không thể ghi nhận hoàn thành tài liệu'); }
    finally { setCompletingDocument(false); }
  };

  const getTitle = () => {
    const lang = localStorage.getItem('i18nextLng') || 'vi';
    if (lang === 'en') return course?.title_en || course?.title_vi || 'Course';
    if (lang === 'zh') return course?.title_zh || course?.title_vi || 'Course';
    return course?.title_vi || 'Course';
  };

const fmtDur = (sec?: number | null | undefined) => sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : null;
  const currentIndex = videoList.findIndex((v: any) => v.videoId === currentVideoId);

  const renderLessonRow = (item: CourseVideo, index: number, opts?: { closeDrawer?: boolean }) => {
    const isActive = item.videoId === currentVideoId;
    const videoLesson = course?.lessons?.find((l: any) => l.videoId === item.videoId) || course?.lessons?.[index];
    const completedLessons = courseProgress?.completedLessons || [];
    const isCompleted = trackProgress && courseProgress && videoLesson && completedLessons.includes(videoLesson.id);
    const isPlaying = isActive && isVideoPlaying;
    const dur = fmtDur(item.video?.duration);
    return (
      <button
        key={item.videoId}
        onClick={() => { handleSelectVideo(item.videoId); if (opts?.closeDrawer) setContentDrawerOpen(false); }}
        className={`group w-full text-left flex items-start gap-3 px-4 py-3 border-l-[3px] transition-colors ${isActive ? 'bg-[#EEF4FF] border-[#0056D2]' : 'border-transparent hover:bg-slate-50'}`}
      >
        <span className="mt-0.5 shrink-0">
          {isCompleted ? <CheckCircleFilled style={{ color: '#16a34a', fontSize: 18 }} /> :
           isPlaying ? <PlayCircleOutlined style={{ color: '#ef4444', fontSize: 18 }} /> :
           isActive ? <PlayCircleOutlined style={{ color: CB, fontSize: 18 }} /> :
           <span className="inline-flex w-[18px] h-[18px] items-center justify-center rounded-full border border-slate-300 text-[11px] text-slate-400">{index + 1}</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm leading-snug line-clamp-2 ${isActive ? 'font-semibold text-[#0056D2]' : 'text-slate-700 group-hover:text-slate-900'}`}>
            {item.video?.name || `Video ${index + 1}`}
          </span>
          <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <PlayCircleOutlined />Video{dur ? ` • ${dur}` : ''}
          </span>
        </span>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center py-12">
        <Title level={4}>Course not found</Title>
        <Button type="primary" onClick={() => navigate('/')}>Back to Home</Button>
      </div>
    );
  }

  return (
    <>
      {/*
        ── LAYOUT STRATEGY ──────────────────────────────────────────────────────
        Dùng position:fixed để thoát hoàn toàn khỏi scroll container của layout cha.
        top = chiều cao navbar (NAVBAR_H). Cả trang cố định, chỉ <main> cuộn.
        ────────────────────────────────────────────────────────────────────────
      */}
      <div
        className="bg-slate-50 flex flex-col"
        style={{ position: 'fixed', inset: 0, top: NAVBAR_H, zIndex: 10, overflow: 'hidden' }}
      >
        {/* ── Top bar: fixed inside our shell, không scroll ── */}
        <header className="shrink-0 bg-white border-b border-slate-200">
          <div className="h-14 px-4 xl:px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate(-1)}
                className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <ArrowLeftOutlined />
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide truncate" style={{ color: CB }}>
                  {course.academy?.name_vi || 'Khóa học'}
                </p>
                <h1 className="text-sm font-bold text-slate-800 truncate leading-tight">{getTitle()}</h1>
              </div>
            </div>
            {trackProgress && courseProgress && (
              <div className="hidden md:block w-56 shrink-0">
                <CourseProgressBar
                  completedVideos={courseProgress.completedVideos}
                  totalVideos={courseProgress.totalVideos}
                />
              </div>
            )}
          </div>
        </header>

        {/* ── Body: sidebar + main — flex, chiếm hết phần còn lại ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Sidebar desktop: cuộn riêng ── */}
          <aside className="hidden xl:flex flex-col w-80 shrink-0 bg-white border-r border-slate-200 overflow-y-auto">
            <div className="px-4 py-3 border-b border-slate-100 shrink-0">
              <h2 className="text-sm font-bold text-slate-800">Nội dung khóa học</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {videoList.length} video
                {trackProgress && courseProgress ? ` • Hoàn thành ${courseProgress.completedVideos}/${courseProgress.totalVideos}` : ''}
              </p>
            </div>
            <div className="py-1">
              {videoList.length === 0
                ? <div className="px-4 py-6"><Text type="secondary">No videos available</Text></div>
                : videoList.map((item: any, index: number) => renderLessonRow(item, index))}
            </div>
            {documentResources.length > 0 && (
              <div className="border-t border-slate-100">
                <div className="px-4 pt-3 pb-1.5 flex items-center gap-2 text-sm font-bold text-slate-800 shrink-0">
                  <FileTextOutlined style={{ color: CB }} />
                  Tài liệu ({documentResources.filter(i => i.completed).length}/{documentResources.length})
                </div>
                {documentResources.map(resource => (
                  <button key={resource.id} onClick={() => openDocumentViewer(resource)}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 border-l-[3px] border-transparent hover:bg-slate-50 transition-colors">
                    <FileTextOutlined className="mt-0.5 text-slate-400 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-700 leading-snug line-clamp-2">
                        {resource.document?.name || resource.title_vi || 'Tài liệu'}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                        {resource.document?.type?.toUpperCase() || 'DOCUMENT'}
                        {resource.completed
                          ? <span className="text-green-600 font-medium">• Hoàn thành</span>
                          : <span className="text-amber-500 font-medium">• Chưa xong</span>}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {examResources.length > 0 && (
              <div className="border-t border-slate-100">
                <div className="px-4 pt-3 pb-1.5 flex items-center gap-2 text-sm font-bold text-slate-800 shrink-0">
                  <FileProtectOutlined style={{ color: CB }} /> Kỳ thi ({examResources.length})
                </div>
                <div className="flex flex-col gap-2 px-4 pb-4">
                  {examResources.map(resource => (
                    <button key={resource.id}
                      onClick={() => navigate(`/exam/${resource.refId}?planId=${activeTrainingPlan?.id}`)}
                      className="text-left rounded-lg border border-[#0056D2]/30 bg-[#EEF4FF] hover:bg-[#E0ECFF] px-3 py-2.5 transition-colors">
                      <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: CB }}>
                        <FileProtectOutlined />{resource.title_vi || 'Kỳ thi'}
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5 pl-6">Bấm để bắt đầu thi</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* ── Main: DÙNG NHẤT cuộn ── */}
          <main className="flex-1 min-w-0 overflow-y-auto">
            {/* Video — nền đen */}
            <div className="bg-black">
              <div className="max-w-5xl mx-auto">
                <div className="w-full aspect-video">
                  {currentCourseVideo?.video ? (
                    <VideoPlayer
                      videoId={currentCourseVideo.videoId}
                      videoName={currentCourseVideo.video?.name}
                      courseRule={course.rule}
                      lessonId={currentLesson?.id}
                      trackProgress={trackProgress}
                      onTimeUpdate={(s: number) => void s}
                      onComplete={handleVideoComplete}
                      onPlayingChange={(p: boolean) => setIsVideoPlaying(p)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-white/80 text-center">
                        <PlayCircleOutlined className="text-4xl mb-2" />
                        <p>Chọn một video để bắt đầu học</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 xl:px-8 py-5">
              {/* Title + like */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">
                    {currentCourseVideo?.video?.name || currentLesson?.title || `Video ${currentIndex >= 0 ? currentIndex + 1 : 1}`}
                  </h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <PlayCircleOutlined style={{ color: CB }} />
                      {currentIndex + 1} / {videoList.length} video
                    </span>
                    {currentCourseVideo?.video?.duration && (
                      <span className="flex items-center gap-1.5">
                        <ClockCircleOutlined /> {fmtDur(currentCourseVideo.video.duration)}
                      </span>
                    )}
                    {course.rating > 0 && (
                      <span className="flex items-center gap-1.5">
                        <StarOutlined className="text-amber-400" /> {course.rating}
                      </span>
                    )}
                    {activeTrainingPlan && (
                      <span className="flex items-center gap-1.5" style={{ color: CB }}>
                        <SnippetsOutlined /> Lộ trình {activeTrainingPlan.progressPercent}%
                      </span>
                    )}
                  </div>
                </div>
                {isAuthenticated && currentVideoId && (
                  <div className="shrink-0 flex items-center gap-1 rounded-full border border-slate-200 overflow-hidden h-9 text-sm self-start">
                    <span className="px-3 text-slate-600 font-medium select-none">{likeCount}</span>
                    <button disabled={likeLoading} onClick={handleLike}
                      className={`h-full px-3 flex items-center transition-colors cursor-pointer border-l border-slate-200 ${liked ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-white text-slate-400 hover:bg-slate-50 hover:text-red-400'}`}>
                      {liked ? <HeartFilled /> : <HeartOutlined />}
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile: open drawer button */}
              <Button size="large"
                className="xl:hidden mt-4 w-full flex items-center justify-center gap-2 font-semibold"
                style={{ background: CB, borderColor: CB, color: '#fff' }}
                onClick={() => { setActiveContentTab('video'); setContentDrawerOpen(true); }}>
                <PlayCircleOutlined />
                Nội dung khóa học ({currentIndex >= 0 ? currentIndex + 1 : 0}/{videoList.length})
              </Button>

              {trackProgress && courseProgress && (
                <div className="md:hidden mt-4 bg-white rounded-xl border border-slate-200 p-3">
                  <CourseProgressBar completedVideos={courseProgress.completedVideos} totalVideos={courseProgress.totalVideos} />
                </div>
              )}

              {/* Info tabs */}
              <div className="mt-6 border-b border-slate-200">
                <div className="flex gap-6">
                  {([
                    { key: 'overview', label: 'Tổng quan' },
                    { key: 'resources', label: `Tài liệu${documentResources.length ? ` (${documentResources.length})` : ''}` },
                    { key: 'about', label: 'Thông tin' },
                  ] as const).map(t => (
                    <button key={t.key} onClick={() => setActiveInfoTab(t.key)}
                      className={`relative -mb-px py-3 text-sm font-semibold transition-colors ${activeInfoTab === t.key ? 'text-[#0056D2] border-b-2 border-[#0056D2]' : 'text-slate-500 hover:text-slate-800 border-b-2 border-transparent'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="py-5">
                {activeInfoTab === 'overview' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-800 mb-1.5">Giới thiệu</h3>
                      <Paragraph className="!text-slate-600 !mb-0 whitespace-pre-line">
                        {course.description_vi || 'Chưa có mô tả cho khóa học này.'}
                      </Paragraph>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {course.academy && <Tag color="blue" icon={<BookOutlined />}>{course.academy.name_vi}</Tag>}
                      {course.language && <Tag icon={<GlobalOutlined />}>{course.language}</Tag>}
                      {course.isPublic && <Tag color="green">Công khai</Tag>}
                    </div>
                  </div>
                )}

                {activeInfoTab === 'resources' && (
                  <div className="space-y-3">
                    {documentResources.length === 0 && examResources.length === 0 ? (
                      <Text type="secondary">Chưa có tài liệu hay kỳ thi trong lộ trình.</Text>
                    ) : (
                      <>
                        {documentResources.map(resource => (
                          <button key={resource.id} onClick={() => openDocumentViewer(resource)}
                            className="w-full text-left rounded-xl border border-slate-200 hover:border-[#0056D2] hover:bg-[#F7FAFF] p-4 transition-colors flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#EEF4FF] flex items-center justify-center shrink-0">
                              <FileTextOutlined style={{ color: CB }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-800 truncate">{resource.document?.name || resource.title_vi || 'Tài liệu'}</p>
                              <p className="text-xs text-slate-500">{resource.document?.type?.toUpperCase() || 'DOCUMENT'}</p>
                            </div>
                            {resource.completed ? <Tag color="green">Hoàn thành</Tag> : <Tag color="gold">Chưa xong</Tag>}
                          </button>
                        ))}
                        {examResources.map(resource => (
                          <button key={resource.id}
                            onClick={() => navigate(`/exam/${resource.refId}?planId=${activeTrainingPlan?.id}`)}
                            className="w-full text-left rounded-xl border p-4 transition-colors flex items-center gap-3"
                            style={{ borderColor: `${CB}55`, background: '#EEF4FF' }}>
                            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shrink-0">
                              <FileProtectOutlined style={{ color: CB }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate" style={{ color: CB }}>{resource.title_vi || 'Kỳ thi'}</p>
                              <p className="text-xs text-slate-500">Bấm để bắt đầu thi</p>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {activeInfoTab === 'about' && (
                  <div className="space-y-5">
                    {course.instructor && (
                      <div>
                        <h3 className="text-base font-bold text-slate-800 mb-2">Giảng viên</h3>
                        <div className="flex items-center gap-3">
                          <Avatar size={44} icon={<UserOutlined />} />
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{course.instructor.fullName || 'Instructor'}</p>
                            <p className="text-xs text-slate-500">Giảng viên khóa học</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {course.academy && (
                        <div className="rounded-xl border border-slate-200 p-3">
                          <p className="text-xs text-slate-400 mb-1">Học viện</p>
                          <p className="text-sm font-semibold text-slate-800">{course.academy.name_vi}</p>
                        </div>
                      )}
                      {course.language && (
                        <div className="rounded-xl border border-slate-200 p-3">
                          <p className="text-xs text-slate-400 mb-1">Ngôn ngữ</p>
                          <p className="text-sm font-semibold text-slate-800">{course.language}</p>
                        </div>
                      )}
                      <div className="rounded-xl border border-slate-200 p-3">
                        <p className="text-xs text-slate-400 mb-1">Số video</p>
                        <p className="text-sm font-semibold text-slate-800">{videoList.length}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* ── Mobile Drawer ── */}
      <Drawer
        title={<Title level={5} className="mb-0!">Nội dung</Title>}
        placement="bottom"
        onClose={() => setContentDrawerOpen(false)}
        open={contentDrawerOpen}
        height="80vh"
        className="xl:hidden"
      >
        <Tabs activeKey={activeContentTab} onChange={setActiveContentTab} items={[
          {
            key: 'video',
            label: <span className="flex items-center gap-2"><PlayCircleOutlined /> Video ({videoList.length})</span>,
            children: (
              <div className="flex flex-col max-h-[58vh] overflow-y-auto -mx-6">
                {videoList.length === 0
                  ? <div className="px-6"><Text type="secondary">No videos available</Text></div>
                  : videoList.map((item: any, index: number) => renderLessonRow(item, index, { closeDrawer: true }))}
              </div>
            ),
          },
          {
            key: 'info',
            label: <span className="flex items-center gap-2"><BookOutlined /> Thông tin</span>,
            children: (
              <div className="max-h-[58vh] overflow-y-auto space-y-4">
                <div><Title level={5}>Mô tả</Title><Text>{course.description_vi || 'Chưa có mô tả'}</Text></div>
                {course.academy && <div><Title level={5}>Học viện</Title><Tag color="blue" icon={<BookOutlined />}>{course.academy.name_vi}</Tag></div>}
                {course.language && <div><Title level={5}>Ngôn ngữ</Title><Tag icon={<GlobalOutlined />}>{course.language}</Tag></div>}
                {course.instructor && (
                  <div><Title level={5}>Giảng viên</Title>
                    <div className="flex items-center gap-2"><Avatar icon={<UserOutlined />} /><Text>{course.instructor.fullName}</Text></div>
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'documents',
            label: <span className="flex items-center gap-2"><FileTextOutlined /> Tài liệu ({documentResources.length})</span>,
            children: (
              <div className="max-h-[58vh] overflow-y-auto space-y-2">
                {documentResources.length === 0
                  ? <Text type="secondary">Chưa có tài liệu trong kế hoạch.</Text>
                  : documentResources.map(resource => (
                    <div key={resource.id}
                      className="rounded-lg border border-slate-200 p-3 cursor-pointer hover:border-blue-300"
                      onClick={() => openDocumentViewer(resource)}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Text className="block font-medium text-slate-700">{resource.document?.name || resource.title_vi || 'Tài liệu'}</Text>
                          <Text type="secondary" className="text-xs">{resource.document?.type?.toUpperCase() || 'DOCUMENT'}</Text>
                        </div>
                        {resource.completed ? <Tag color="green">Hoàn thành</Tag> : <Tag color="gold">Chưa hoàn thành</Tag>}
                      </div>
                    </div>
                  ))}
              </div>
            ),
          },
          ...(examResources.length > 0 ? [{
            key: 'exams',
            label: <span className="flex items-center gap-2"><FileProtectOutlined /> Thi ({examResources.length})</span>,
            children: (
              <div className="max-h-[58vh] overflow-y-auto space-y-2">
                {examResources.map(resource => (
                  <Button key={resource.id} type="primary" icon={<FileProtectOutlined />} block size="large"
                    className="flex items-center justify-start h-auto py-4 px-4"
                    onClick={() => { navigate(`/exam/${resource.refId}?planId=${activeTrainingPlan?.id}`); setContentDrawerOpen(false); }}>
                    <div className="text-left">
                      <Text className="block font-medium text-white text-base">{resource.title_vi || 'Kỳ thi'}</Text>
                      <Text type="secondary" className="text-xs text-blue-100">Bấm để bắt đầu thi</Text>
                    </div>
                  </Button>
                ))}
              </div>
            ),
          }] : []),
        ]} />
      </Drawer>

      {/* ── Document Viewer Modal ── */}
      <Modal
        title={
          <div className="flex items-center justify-between gap-3 pr-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <FileTextOutlined style={{ color: CB }} />
                <span className="truncate">{selectedDocument?.name || 'Xem tài liệu'}</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {selectedDocument?.type?.toUpperCase() || 'FILE'} • {getPrettyFileSize(selectedDocument?.size)}
              </div>
            </div>
            <div>{selectedDocument?.completed ? <Tag color="green">Đã hoàn thành</Tag> : <Tag color="gold">Chưa hoàn thành</Tag>}</div>
          </div>
        }
        open={documentViewerOpen}
        onCancel={() => { setDocumentViewerOpen(false); setDocumentPreviewHtml(''); }}
        width={1100}
        styles={{ body: { background: '#f8fafc', borderRadius: 12, paddingTop: 14 } }}
        footer={
          <div className="flex items-center justify-between w-full">
            <Text type="secondary" className="text-xs">Bạn có thể xem trực tiếp tại đây mà không cần tải xuống.</Text>
            <div className="flex items-center gap-2">
              {selectedDocument && <Button onClick={() => window.open(getInlineDocumentUrl(selectedDocument.id), '_blank')}>Mở tab mới</Button>}
              <Button onClick={() => setDocumentViewerOpen(false)}>Đóng</Button>
              {!selectedDocument?.completed && (
                <Button type="primary" loading={completingDocument} onClick={handleMarkDocumentCompleted}>Xác nhận hoàn thành</Button>
              )}
            </div>
          </div>
        }
      >
        {documentPreviewLoading ? (
          <div className="h-[70vh] rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center gap-3">
            <Spin size="large" /><Text type="secondary">Đang tải nội dung tài liệu...</Text>
          </div>
        ) : selectedDocument ? (
          <>
            {documentPreviewType === 'pdf' && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <iframe title={selectedDocument.name || 'Document'} src={getInlineDocumentUrl(selectedDocument.id)} className="w-full h-[70vh]" />
              </div>
            )}
            {documentPreviewType === 'docx' && (
              <div className="h-[70vh] overflow-auto border border-slate-200 rounded-xl bg-white p-6 prose max-w-none">
                <div dangerouslySetInnerHTML={{ __html: documentPreviewHtml }} />
              </div>
            )}
            {documentPreviewType === 'xlsx' && (
              <div className="h-[70vh] overflow-auto border border-slate-200 rounded-xl bg-white p-4">
                <div className="[&_table]:w-full [&_table]:border-collapse [&_th]:border [&_td]:border [&_th]:border-slate-300 [&_td]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2 [&_td]:px-2 [&_th]:py-1 [&_td]:py-1 [&_td]:text-sm [&_th]:text-sm"
                  dangerouslySetInnerHTML={{ __html: documentPreviewHtml }} />
              </div>
            )}
            {documentPreviewType === 'unsupported' && (
              <div className="h-[70vh] rounded-xl border border-dashed border-slate-300 bg-white flex flex-col items-center justify-center gap-3 text-slate-500">
                <FileTextOutlined className="text-3xl" />
                <p>Định dạng này chưa hỗ trợ xem trực tiếp.</p>
                <Button onClick={() => window.open(getInlineDocumentUrl(selectedDocument.id), '_blank')}>Mở tab mới</Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-10 text-slate-500">Không có liên kết tài liệu để hiển thị.</div>
        )}
      </Modal>
    </>
  );
}