import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Empty, Input, Spin, Tag, Badge } from 'antd';
import { SearchOutlined, HeartOutlined, TagsOutlined } from '@ant-design/icons';
import { getHomeSpecialTopics, type Course, type SpecialTopic } from '../../services/course';

export default function Topics() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [topics, setTopics] = useState<SpecialTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedAcademy = useMemo(() => {
    const academyId = searchParams.get('academy');
    return academyId ? parseInt(academyId, 10) : null;
  }, [searchParams]);

  useEffect(() => {
    const fetchTopics = async () => {
      setLoading(true);
      try {
        const data = await getHomeSpecialTopics({
          academyId: selectedAcademy || undefined,
          page: 'home',
        });
        setTopics(data);
      } catch (error) {
        console.error('Failed to fetch topics:', error);
        setTopics([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTopics();
  }, [selectedAcademy]);

  const getTopicName = (topic: SpecialTopic): string => {
    const lang = localStorage.getItem('i18nextLng') || 'vi';
    if (lang === 'en') return topic.name_en || topic.name_vi || topic.name_zh || '-';
    if (lang === 'zh') return topic.name_zh || topic.name_vi || topic.name_en || '-';
    return topic.name_vi || topic.name_en || topic.name_zh || '-';
  };

  const getCourseTitle = (course: Course): string => {
    const lang = localStorage.getItem('i18nextLng') || 'vi';
    if (lang === 'en') return course.title_en || course.title_vi || course.title_zh || 'Untitled Course';
    if (lang === 'zh') return course.title_zh || course.title_vi || course.title_en || 'Untitled Course';
    return course.title_vi || course.title_en || course.title_zh || 'Untitled Course';
  };

  const visibleCourses = useMemo(() => {
    let source: Course[] = [];

    if (selectedTopicId) {
      const selectedTopic = topics.find((t) => t.id === selectedTopicId);
      source = selectedTopic?.courses || [];
    } else {
      source = topics.flatMap((topic) => topic.courses || []);
    }

    const deduped = source.filter((course, idx, arr) => arr.findIndex((c) => c.id === course.id) === idx);
    const onlyPublic = deduped.filter((course) => course.isPublic);

    if (!searchQuery.trim()) return onlyPublic;

    const q = searchQuery.toLowerCase();
    return onlyPublic.filter((course) => getCourseTitle(course).toLowerCase().includes(q));
  }, [topics, selectedTopicId, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
          <div className="flex flex-wrap gap-2 flex-1">
            <Tag
              className={`cursor-pointer px-3 py-1 ${selectedTopicId === null ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              onClick={() => setSelectedTopicId(null)}
            >
              Tất cả chủ đề
            </Tag>
            {topics.map((topic) => (
              <Tag
                key={topic.id}
                className={`cursor-pointer px-3 py-1 ${selectedTopicId === topic.id ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                onClick={() => setSelectedTopicId(topic.id)}
              >
                {getTopicName(topic)}
              </Tag>
            ))}
          </div>

          <div className="w-full lg:w-80">
            <Input
              placeholder="Tìm khóa học trong chủ đề..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10"
              allowClear
            />
          </div>
        </div>

        <div className="text-sm text-slate-500">Tìm thấy {visibleCourses.length} khóa học công khai</div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : visibleCourses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Empty description="Không có khóa học phù hợp trong chủ đề" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleCourses.map((course) => {
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
                    src={
                      course.coverImage ||
                      'https://images.unsplash.com/photo-1510915228340-29c85a43dcfe?auto=format&fit=crop&w=600&q=80'
                    }
                    className="h-48 w-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                }
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-1 rounded-full">
                      <TagsOutlined /> Chủ đề
                    </span>
                    {course.academy && (
                      <Badge status="processing" text={course.academy.name_vi} className="text-xs" />
                    )}
                  </div>

                  <h3 className="font-bold text-slate-800 line-clamp-2 min-h-12 text-base hover:text-blue-600 transition-colors">
                    {title}
                  </h3>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-slate-500 text-sm">
                      <span>{course.courseVideos?.length || 0} videos</span>
                      <span className="inline-flex items-center gap-1 text-rose-500">
                        <HeartOutlined /> {course.likeCount || 0}
                      </span>
                    </div>
                    <Tag color="blue" className="cursor-pointer">
                      Học ngay
                    </Tag>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
