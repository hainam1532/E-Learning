import { Progress } from 'antd';
import { CheckCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';

interface CourseProgressBarProps {
  completedVideos: number;
  totalVideos: number;
  showLabel?: boolean;
}

export default function CourseProgressBar({
  completedVideos,
  totalVideos,
  showLabel = true
}: CourseProgressBarProps) {
  const percent = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;
  
  const isComplete = percent === 100;

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-slate-600">
            {isComplete ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircleOutlined /> Hoàn thành
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <PlayCircleOutlined /> Đang học
              </span>
            )}
          </span>
          <span className="text-sm text-slate-500">
            {completedVideos}/{totalVideos} video ({percent}%)
          </span>
        </div>
      )}
      
      <Progress 
        percent={percent}
        status={isComplete ? 'success' : 'active'}
        showInfo={false}
        strokeColor={isComplete ? '#22c55e' : '#3b82f6'}
        trailColor="#e2e8f0"
      />
    </div>
  );
}
