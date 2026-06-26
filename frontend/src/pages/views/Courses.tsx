import { useState, useEffect, useMemo, type Key } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Input, Tag, Tree, Spin, Empty, Badge, Button, Drawer, Select } from 'antd';
import { SearchOutlined, BookOutlined, HeartOutlined, HomeOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getCourses, getCoursesByAcademy, getCourseTags, type Course, type CourseTag, type Academy } from '../../services/course';
import { getCategories, getCoursesByCategory, type CourseCategory } from '../../services/category';
import { authGet } from '../../services/auth/auth.get';

export default function Courses() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState<CourseTag[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);
  
  // Filter states
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedTagId, setSelectedTagId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [selectedAcademyId, setSelectedAcademyId] = useState<number | undefined>(() => {
    const academyId = searchParams.get('academy');
    return academyId ? parseInt(academyId, 10) : undefined;
  });

  const getAcademyName = (academy: Academy): string => {
    const lang = localStorage.getItem('i18nextLng') || 'vi';
    if (lang === 'en') return academy.name_en || academy.name_vi || academy.code;
    if (lang === 'zh') return academy.name_zh || academy.name_vi || academy.code;
    return academy.name_vi || academy.name_en || academy.code;
  };

  const getTagName = (tag: CourseTag): string => {
    const lang = localStorage.getItem('i18nextLng') || 'vi';
    if (lang === 'en') return tag.name_en || tag.name_vi || tag.name_zh || '-';
    if (lang === 'zh') return tag.name_zh || tag.name_vi || tag.name_en || '-';
    return tag.name_vi || tag.name_en || tag.name_zh || '-';
  };

  useEffect(() => {
    const fetchAcademies = async () => {
      try {
        const response = await authGet.getPublicAcademies();
        setAcademies(response.data.academies || []);
      } catch (error) {
        console.error('Failed to fetch academies:', error);
      }
    };

    fetchAcademies();
  }, []);

  // Fetch tags and categories on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [tagsData, categoriesData] = await Promise.all([
          getCourseTags(),
          getCategories({ academyId: selectedAcademyId }),
        ]);
        setTags(tagsData);
        setCategories(categoriesData);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedAcademyId]);

  useEffect(() => {
    setSelectedCategoryId(null);
  }, [selectedAcademyId]);

  // Fetch courses when filters change
  useEffect(() => {
    const fetchCourses = async () => {
      setLoading(true);
      try {
        let courseData: Course[];
        
        if (selectedCategoryId) {
          // Get courses by category
          const result = await getCoursesByCategory(selectedCategoryId);
          courseData = result.filter(c => c.isPublic);
        } else if (selectedAcademyId) {
          const result = await getCoursesByAcademy(selectedAcademyId);
          courseData = result.filter(c => c.isPublic);
        } else {
          // Get all public courses
          const result = await getCourses();
          courseData = result.filter(c => c.isPublic);
        }
        
        setCourses(courseData);
      } catch (error) {
        console.error('Failed to fetch courses:', error);
        setCourses([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [selectedCategoryId, selectedAcademyId]);

  // Filter courses by search and tag
  const filteredCourses = useMemo(() => {
    let result = courses;
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(course => {
        const title = getCourseTitle(course);
        return title.toLowerCase().includes(query);
      });
    }
    
    // Filter by tag (if course has tags array)
    if (selectedTagId) {
      const tag = tags.find(t => t.id === selectedTagId);
      if (tag) {
        result = result.filter(course => {
          const courseTags = course.tags || [];
          return courseTags.includes(tag.name_vi);
        });
      }
    }
    
    return result;
  }, [courses, searchQuery, selectedTagId, tags]);

  // Helper functions
  const getCourseTitle = (course: Course): string => {
    const lang = localStorage.getItem('i18nextLng') || 'vi';
    if (lang === 'en') return course.title_en || course.title_vi || course.title_zh || t('coursesPage.untitledCourse');
    if (lang === 'zh') return course.title_zh || course.title_vi || course.title_en || t('coursesPage.untitledCourse');
    return course.title_vi || course.title_en || course.title_zh || t('coursesPage.untitledCourse');
  };

  const getCategoryName = (category: CourseCategory): string => {
    const lang = localStorage.getItem('i18nextLng') || 'vi';
    if (lang === 'en') return category.name_en || category.name_vi || '';
    if (lang === 'zh') return category.name_zh || category.name_vi || '';
    return category.name_vi || category.name_en || '';
  };

  // Build tree data from categories
  const treeData = useMemo(() => {
    const buildTree = (cats: CourseCategory[], parentId: number | null): any[] => {
      return cats
        .filter(c => c.parentId === parentId)
        .map(cat => ({
          key: cat.id,
          title: (
            <div className="flex items-center gap-2 py-1">
              <BookOutlined />
              <span>{getCategoryName(cat)}</span>
              {cat._count?.courses ? (
                <Badge count={cat._count.courses} style={{ backgroundColor: '#e6f7ff', color: '#1890ff' }} />
              ) : null}
            </div>
          ),
          children: buildTree(cats, cat.id),
        }));
    };
    
    return [
      {
        key: 'root',
        title: (
          <div className="flex items-center gap-2 py-1">
            <HomeOutlined />
            <span>{t('coursesPage.allCategories')}</span>
          </div>
        ),
        children: buildTree(categories, null),
      },
    ];
  }, [categories]);

  // Handle tree select
  const handleTreeSelect = (selectedKeys: Key[]) => {
    if (selectedKeys.length > 0) {
      const key = selectedKeys[0];
      if (key === 'root') {
        setSelectedCategoryId(null);
      } else {
        setSelectedCategoryId(Number(key));
      }
    } else {
      setSelectedCategoryId(null);
    }

    setCategoryDrawerOpen(false);
  };

  const renderCategoryTree = () => (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 lg:sticky lg:top-24 max-h-[70vh] overflow-auto">
      <h3 className="font-bold text-slate-800 mb-4">{t('coursesPage.categoryTitle')}</h3>
      <Select
        value={selectedAcademyId}
        onChange={(value) => setSelectedAcademyId(value)}
        allowClear
        placeholder={t('coursesPage.selectAcademy')}
        className="w-full mb-4"
        popupMatchSelectWidth={false}
        options={academies.map((academy) => ({
          value: academy.id,
          label: getAcademyName(academy),
        }))}
      />
      {categories.length > 0 ? (
        <Tree
          showLine
          defaultExpandedKeys={['root']}
          onSelect={handleTreeSelect}
          treeData={treeData}
          className="bg-transparent"
        />
      ) : (
        <Empty description={t('coursesPage.noCategories')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left Sidebar - Category Tree */}
      <div className="hidden lg:block w-full lg:w-72 lg:shrink-0">
        {renderCategoryTree()}
      </div>

      {/* Right Content */}
      <div className="w-full flex-1 space-y-6">
        <div className="lg:hidden">
          <Button icon={<AppstoreOutlined />} onClick={() => setCategoryDrawerOpen(true)}>
            {t('coursesPage.categoryTitle')}
          </Button>
          <Drawer
            title={t('coursesPage.categoryTitle')}
            placement="left"
            open={categoryDrawerOpen}
            onClose={() => setCategoryDrawerOpen(false)}
            width={320}
          >
            {renderCategoryTree()}
          </Drawer>
        </div>

        {/* Filters Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
            <div className="flex flex-wrap gap-2 flex-1">
            <Tag
              className={`cursor-pointer px-3 py-1 ${selectedTagId === null ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              onClick={() => setSelectedTagId(null)}
            >
              {t('coursesPage.allTags')}
            </Tag>
            {tags.map((tag) => (
              <Tag
                key={tag.id}
                className={`cursor-pointer px-3 py-1 ${selectedTagId === tag.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                onClick={() => setSelectedTagId(tag.id)}
              >
                {getTagName(tag)}
              </Tag>
            ))}
            </div>

            <div className="w-full lg:w-80">
              <Input
                placeholder={t('coursesPage.searchPlaceholder')}
                prefix={<SearchOutlined className="text-slate-400" />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10"
                allowClear
              />
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-slate-500">
            {t('coursesPage.foundCourses', { count: filteredCourses.length })}
          </div>
        </div>

        {/* Courses Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Spin size="large" />
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <Empty description={t('coursesPage.noMatchingCourses')} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => {
              const title = getCourseTitle(course);
              
              return (
                <Card
                  key={course.id}
                  hoverable
                  className="overflow-hidden rounded-2xl border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer"
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
                      {title}
                    </h3>
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-3 text-slate-500 text-sm">
                        <span>{t('coursesPage.videosCount', { count: course.courseVideos?.length || 0 })}</span>
                        <span className="inline-flex items-center gap-1 text-rose-500">
                          <HeartOutlined /> {course.likeCount || 0}
                        </span>
                      </div>
                      <Tag color="blue" className="cursor-pointer">
                        {t('coursesPage.learnNow')}
                      </Tag>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
