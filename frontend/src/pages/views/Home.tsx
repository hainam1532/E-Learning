import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button, Badge, Tag } from 'antd';
import { HeartOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getFeaturedCourses, getHomeSpecialTopics } from '../../services/course';
import type { Course, Academy, SpecialTopic } from '../../services/course';
import backgroundImage from '../../../public/photoBG.avif';

export default function Home() {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [specialTopics, setSpecialTopics] = useState<SpecialTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const specialTrackRef = useRef<HTMLDivElement | null>(null);
  const featuredTrackRef = useRef<HTMLDivElement | null>(null);

  // Get academyId from URL query params - this comes from the dropdown in UserLayout
  const selectedAcademy = useMemo(() => {
    const academyId = searchParams.get('academy');
    return academyId ? parseInt(academyId) : null;
  }, [searchParams]);

  // Fetch courses when academy selection changes
  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        const [featuredData, topicData] = await Promise.all([
          getFeaturedCourses(selectedAcademy || undefined),
          getHomeSpecialTopics({ academyId: selectedAcademy || undefined, page: 'home' }),
        ]);
        setCourses(featuredData);
        setSpecialTopics(topicData);
      } catch (error) {
        console.error('Failed to fetch courses:', error);
        setSpecialTopics([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [selectedAcademy]);

  // Get academy name based on language
  const getAcademyName = (academy: Academy | undefined): string => {
    if (!academy) return '';
    const lang = localStorage.getItem('i18nextLng') || 'vi';
    if (lang === 'en') return academy.name_en || academy.name_vi || '';
    if (lang === 'zh') return academy.name_zh || academy.name_vi || '';
    return academy.name_vi || '';
  };

  const getCourseTitle = (course: Course): string => {
    const lang = localStorage.getItem('i18nextLng') || 'vi';
    if (lang === 'en') return course.title_en || course.title_vi || course.title_zh || 'Untitled Course';
    if (lang === 'zh') return course.title_zh || course.title_vi || course.title_en || 'Untitled Course';
    return course.title_vi || course.title_en || course.title_zh || 'Untitled Course';
  };

  const getTopicName = (topic: SpecialTopic): string => {
    const lang = localStorage.getItem('i18nextLng') || 'vi';
    if (lang === 'en') return topic.name_en || topic.name_vi || topic.name_zh || '-';
    if (lang === 'zh') return topic.name_zh || topic.name_vi || topic.name_en || '-';
    return topic.name_vi || topic.name_en || topic.name_zh || '-';
  };

  const groupedSpecialTopics = useMemo(() => {
    const groups = new Map<number, { academy?: Academy; items: Array<{ topic: SpecialTopic; course: Course }> }>();

    specialTopics.forEach((topic) => {
      const academyId = topic.academy?.id || topic.academyId;
      if (!academyId) return;

      if (!groups.has(academyId)) {
        groups.set(academyId, {
          academy: topic.academy,
          items: [],
        });
      }

      const courses = topic.courses || [];
      courses.forEach((course) => {
        groups.get(academyId)?.items.push({ topic, course });
      });
    });

    return Array.from(groups.values()).filter((group) => group.items.length > 0);
  }, [specialTopics]);

  const specialItems = useMemo(() => {
    return groupedSpecialTopics.flatMap((group) => group.items);
  }, [groupedSpecialTopics]);

  const slideTrack = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    const container = ref.current;
    if (!container) return;

    const amount = Math.max(container.clientWidth * 0.85, 280);
    container.scrollBy({
      left: direction === 'right' ? amount : -amount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white px-6 py-10 md:py-12 text-center md:text-left flex flex-col md:flex-row items-center gap-8 shadow-2xl">
        <div className="flex-1 space-y-6 z-10">
          <Badge count="New Version" className="bg-blue-600 text-white border-none rounded-full px-3 py-1 font-semibold text-xs" />
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight">
            {t('home.heroTitle')} <br />
            <span className="bg-linear-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              {t('home.heroSubtitle')}
            </span>
          </h1>
          <p className="text-slate-300 text-base md:text-lg max-w-xl">
            {t('home.heroDesc')}
          </p>
          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            <Button
              type="primary"
              size="large"
              onClick={() => navigate(isAuthenticated ? '/courses' : '/login')}
              className="bg-blue-500 hover:bg-blue-600 border-none font-bold px-8 h-12 shadow-lg shadow-blue-500/20"
            >
              {t('home.getStarted')}
            </Button>
            {user?.role === 'admin' && (
              <Button
                size="large"
                ghost
                onClick={() => navigate('/admin')}
                className="text-white border-white/30 hover:border-white hover:text-white font-semibold h-12"
              >
                {t('home.adminSystem')}
              </Button>
            )}
          </div>
        </div>
        <div className="flex-1 relative w-full max-w-md md:max-w-none">
          <div className="absolute -top-12 -left-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl"></div>
          <img
            src={backgroundImage}
            alt="Students collaborating"
            className="rounded-2xl shadow-xl w-full object-cover aspect-4/3 max-h-105 border border-white/10"
          />
        </div>
      </section>

      {groupedSpecialTopics.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-800">{t('menu.coursesSpecial')}</h2>
                <Button type="link" className="px-0!" onClick={() => navigate('/topics')}>
                  Xem tất cả
                </Button>
              </div>
              <p className="text-slate-500 text-sm">{t('home.featuredCoursesSub')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button shape="circle" icon={<LeftOutlined />} onClick={() => slideTrack(specialTrackRef, 'left')} />
              <Button shape="circle" icon={<RightOutlined />} onClick={() => slideTrack(specialTrackRef, 'right')} />
            </div>
          </div>

          <div ref={specialTrackRef} className="flex gap-6 overflow-x-auto pb-2 scroll-smooth [&::-webkit-scrollbar]:hidden">
              {specialItems.map(({ topic, course }, index) => {
                const title = getCourseTitle(course);

                return (
                  <Card
                    key={`${topic.id}-${course.id}-${index}`}
                    hoverable
                    className="min-w-[320px] max-w-90 flex-1 overflow-hidden rounded-2xl border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer"
                    onClick={() => navigate(`/learn/${course.id}`)}
                    cover={
                      <img
                        alt={title}
                        src={course.coverImage || 'https://images.unsplash.com/photo-1510915228340-29c85a43dcfe?auto=format&fit=crop&w=600&q=80'}
                        className="h-48 w-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                    }
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Tag color="purple">{getTopicName(topic)}</Tag>
                        {course.academy && (
                          <Badge status="processing" text={getAcademyName(course.academy)} className="text-xs" />
                        )}
                        {course.language && (
                          <>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-500">{course.language}</span>
                          </>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-800 line-clamp-2 min-h-12 text-base hover:text-blue-600 transition-colors">
                        {title}
                      </h3>
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-slate-500 text-sm">
                          <span>{course.courseVideos?.length || 0} {t('home.videos') || 'videos'}</span>
                          <span className="inline-flex items-center gap-1 text-rose-500">
                            <HeartOutlined /> {course.likeCount || 0}
                          </span>
                        </div>
                        <Button
                          type="primary"
                          size="small"
                          className="bg-blue-600 border-none font-semibold"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/learn/${course.id}`);
                          }}
                        >
                          {t('home.learnNow')}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
          </div>
        </section>
      )}

      {/* Featured Courses */}
      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{t('home.featuredCourses')}</h2>
            <p className="text-slate-500 text-sm">{t('home.featuredCoursesSub')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button shape="circle" icon={<LeftOutlined />} onClick={() => slideTrack(featuredTrackRef, 'left')} />
            <Button shape="circle" icon={<RightOutlined />} onClick={() => slideTrack(featuredTrackRef, 'right')} />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            {selectedAcademy 
              ? (t('home.noCourses') || 'Không có khóa học nào thuộc học viện này')
              : (t('home.noCourses') || 'Chưa có khóa học nào')}
          </div>
        ) : (
          <div ref={featuredTrackRef} className="flex gap-6 overflow-x-auto pb-2 scroll-smooth [&::-webkit-scrollbar]:hidden">
            {courses.map((course) => {
              const title = getCourseTitle(course);
              
return (
                <Card
                  key={course.id}
                  hoverable
                  className="min-w-[320px] max-w-90 flex-1 overflow-hidden rounded-2xl border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer"
                  onClick={() => navigate(`/learn/${course.id}`)}
                  cover={
                    <img
                      alt={title}
                      src={course.coverImage || 'https://images.unsplash.com/photo-1510915228340-29c85a43dcfe?auto=format&fit=crop&w=600&q=80'}
                      className="h-48 w-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  }
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {course.academy && (
                        <Badge status="processing" text={getAcademyName(course.academy)} className="text-xs" />
                      )}
                      {course.language && (
                        <>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-500">{course.language}</span>
                        </>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-800 line-clamp-2 min-h-12 text-base hover:text-blue-600 transition-colors">
                      {title || 'Untitled Course'}
                    </h3>
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-slate-500 text-sm">
                        <span>{course.courseVideos?.length || 0} {t('home.videos') || 'videos'}</span>
                        <span className="inline-flex items-center gap-1 text-rose-500">
                          <HeartOutlined /> {course.likeCount || 0}
                        </span>
                      </div>
                      <Button 
                        type="primary" 
                        size="small" 
                        className="bg-blue-600 border-none font-semibold"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/learn/${course.id}`);
                        }}
                      >
                        {t('home.learnNow')}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
