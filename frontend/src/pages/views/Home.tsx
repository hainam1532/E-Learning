import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, Button, Badge } from 'antd';
import { BookOutlined, RiseOutlined, TeamOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCoursesByAcademy, getCourses } from '../../services/course';
import type { Course, Academy } from '../../services/course';

export default function Home() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);

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
        if (selectedAcademy) {
          const data = await getCoursesByAcademy(selectedAcademy);
          setCourses(data);
        } else {
          const data = await getCourses();
          setCourses(data);
        }
      } catch (error) {
        console.error('Failed to fetch courses:', error);
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

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white px-8 py-16 md:py-24 text-center md:text-left flex flex-col md:flex-row items-center gap-12 shadow-2xl">
        <div className="flex-1 space-y-6 z-10">
          <Badge count="New Version" className="bg-blue-600 text-white border-none rounded-full px-3 py-1 font-semibold text-xs" />
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            {t('home.heroTitle')} <br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              {t('home.heroSubtitle')}
            </span>
          </h1>
          <p className="text-slate-300 text-lg max-w-xl">
            {t('home.heroDesc')}
          </p>
          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            <Button
              type="primary"
              size="large"
              onClick={() => navigate('/login')}
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
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80"
            alt="Students collaborating"
            className="rounded-2xl shadow-xl w-full object-cover aspect-[4/3] border border-white/10"
          />
        </div>
      </section>

      {/* Feature stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 text-2xl">
            <BookOutlined />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800">50+</h3>
            <p className="text-slate-500 text-sm font-medium">{t('home.statCourses')}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 text-2xl">
            <TeamOutlined />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800">10,000+</h3>
            <p className="text-slate-500 text-sm font-medium">{t('home.statStudents')}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 text-2xl">
            <RiseOutlined />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800">95%</h3>
            <p className="text-slate-500 text-sm font-medium">{t('home.statCertificates')}</p>
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{t('home.featuredCourses')}</h2>
            <p className="text-slate-500 text-sm">{t('home.featuredCoursesSub')}</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {courses.map((course) => {
              const lang = localStorage.getItem('i18nextLng') || 'vi';
              const title = lang === 'en' ? (course.title_en || course.title_vi) 
                : lang === 'zh' ? (course.title_zh || course.title_vi) 
                : course.title_vi;
              
              return (
                <Card
                  key={course.id}
                  hoverable
                  className="overflow-hidden rounded-2xl border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300"
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
                    <h3 className="font-bold text-slate-800 line-clamp-2 min-h-[3rem] text-base hover:text-blue-600 transition-colors">
                      {title || 'Untitled Course'}
                    </h3>
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-slate-500 text-sm">
                        {course.courseVideos?.length || 0} {t('home.videos') || 'videos'}
                      </span>
                      <Button type="primary" size="small" className="bg-blue-600 border-none font-semibold">{t('home.learnNow')}</Button>
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
