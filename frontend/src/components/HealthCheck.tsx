import { useState, useEffect, useRef } from 'react';
import { Result, Button } from 'antd';
import apacheIcon from '../assets/apache.png';
import { useTranslation } from 'react-i18next';

// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

type HealthStatus = 'checking' | 'healthy' | 'unhealthy' | 'maintenance';

interface HealthResponse {
  status: string;
  database: string;
  redis: string;
  timestamp: string;
}

export default function HealthCheck({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking');
  const [showLoading, setShowLoading] = useState(true);
const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          setHealthStatus('unhealthy');
          return;
        }

        const data: HealthResponse = await response.json();

        if (data.status === 'ok' && data.database === 'healthy' && data.redis === 'healthy') {
          setHealthStatus('healthy');
        } else if (data.database === 'maintenance' || data.redis === 'maintenance') {
          setHealthStatus('maintenance');
        } else {
          setHealthStatus('unhealthy');
        }
      } catch (error) {
        console.error('Health check failed:', error);
        setHealthStatus('unhealthy');
      }
    };

    // Start health check
    checkHealth();

    // Force loading to show for at least 5 seconds
    loadingTimerRef.current = setTimeout(() => {
      setShowLoading(false);
    }, 2000);

    // Periodic check every 30 seconds
    const interval = setInterval(checkHealth, 30000);

    return () => {
      clearInterval(interval);
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, []);

if (healthStatus === 'checking' || showLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* Rotating circle around icon */}
          <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          {/* Apache icon in center */}
          <img src={apacheIcon} alt={t('common.loading')} className="w-12 h-12 object-contain" />
        </div>
      </div>
    );
  }

  if (healthStatus === 'unhealthy') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Result
          status="error"
          title={t('healthCheck.serverUnreachableTitle')}
          subTitle={t('healthCheck.serverUnreachableSubTitle')}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              {t('healthCheck.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  if (healthStatus === 'maintenance') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Result
          status="warning"
          title={t('healthCheck.maintenanceTitle')}
          subTitle={t('healthCheck.maintenanceSubTitle')}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              {t('healthCheck.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}
