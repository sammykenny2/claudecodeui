import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Server,
  Cpu,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Radio,
  Newspaper,
  Bot,
  Settings
} from 'lucide-react';

/**
 * IntegrationDashboard - Unified status dashboard for all SK2 services
 *
 * Displays real-time status from:
 * - news-podcaster (port 8080)
 * - autogen-conversation GenAI Gateway (port 8000)
 * - n8n (port 5678)
 * - claudecodeui itself (port 3001)
 */

const SERVICES = [
  {
    id: 'news-podcaster',
    name: 'News Podcaster',
    description: 'Podcast generation pipeline',
    icon: Newspaper,
    color: '#7C3AED',
    endpoints: {
      health: 'http://localhost:8080/api/health',
      runs: 'http://localhost:8080/api/runs',
    }
  },
  {
    id: 'genai-gateway',
    name: 'GenAI Gateway',
    description: 'Multi-provider LLM API',
    icon: Bot,
    color: '#3B82F6',
    endpoints: {
      health: 'http://localhost:8000/api/v1/health',
      providers: 'http://localhost:8000/api/v1/providers',
      statistics: 'http://localhost:8000/api/v1/statistics',
    }
  },
  {
    id: 'n8n',
    name: 'n8n Automation',
    description: 'Workflow automation platform',
    icon: Zap,
    color: '#FF6D5A',
    endpoints: {
      health: 'http://localhost:5678/healthz',
    }
  },
  {
    id: 'claudecodeui',
    name: 'Claude Code UI',
    description: 'This application',
    icon: Settings,
    color: '#10B981',
    endpoints: {
      health: '/health',
    }
  }
];

export default function IntegrationDashboard() {
  const [serviceStatuses, setServiceStatuses] = useState({});
  const [gatewayStats, setGatewayStats] = useState(null);
  const [gatewayProviders, setGatewayProviders] = useState([]);
  const [podcastRuns, setPodcastRuns] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const checkServiceHealth = useCallback(async (service) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(service.endpoints.health, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return {
          status: 'online',
          data,
          latency: Date.now() - performance.now()
        };
      } else {
        return { status: 'error', error: `HTTP ${response.status}` };
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return { status: 'timeout', error: 'Request timeout' };
      }
      return { status: 'offline', error: err.message };
    }
  }, []);

  const fetchGatewayDetails = useCallback(async () => {
    try {
      // Fetch providers
      const providersResp = await fetch('http://localhost:8000/api/v1/providers');
      if (providersResp.ok) {
        const data = await providersResp.json();
        setGatewayProviders(data.providers || []);
      }

      // Fetch statistics
      const statsResp = await fetch('http://localhost:8000/api/v1/statistics');
      if (statsResp.ok) {
        const data = await statsResp.json();
        setGatewayStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch gateway details:', err);
    }
  }, []);

  const fetchPodcastRuns = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8080/api/runs?limit=5');
      if (response.ok) {
        const data = await response.json();
        setPodcastRuns(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch podcast runs:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);

    const statuses = {};
    for (const service of SERVICES) {
      statuses[service.id] = await checkServiceHealth(service);
    }
    setServiceStatuses(statuses);

    // Fetch additional data if services are online
    if (statuses['genai-gateway']?.status === 'online') {
      await fetchGatewayDetails();
    }
    if (statuses['news-podcaster']?.status === 'online') {
      await fetchPodcastRuns();
    }

    setLastUpdated(new Date());
    setIsRefreshing(false);
  }, [checkServiceHealth, fetchGatewayDetails, fetchPodcastRuns]);

  // Initial load and auto-refresh
  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [refreshAll]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'text-green-400';
      case 'error': return 'text-yellow-400';
      case 'timeout': return 'text-orange-400';
      case 'offline': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'online': return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'error': return <XCircle className="w-5 h-5 text-yellow-400" />;
      case 'timeout': return <Clock className="w-5 h-5 text-orange-400" />;
      case 'offline': return <WifiOff className="w-5 h-5 text-red-400" />;
      default: return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  const onlineCount = Object.values(serviceStatuses).filter(s => s?.status === 'online').length;

  return (
    <div className="p-6 bg-gray-900 text-gray-100 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Activity className="w-7 h-7 text-purple-400" />
            Integration Dashboard
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Monitor all SK2 services in one place
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={refreshAll}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Server className="w-4 h-4" />
            <span className="text-sm">Services Online</span>
          </div>
          <div className="text-3xl font-bold text-green-400">
            {onlineCount}/{SERVICES.length}
          </div>
        </div>

        {gatewayStats && (
          <>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Cpu className="w-4 h-4" />
                <span className="text-sm">Gateway Calls</span>
              </div>
              <div className="text-3xl font-bold text-blue-400">
                {gatewayStats.total_calls || 0}
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Success Rate</span>
              </div>
              <div className="text-3xl font-bold text-green-400">
                {((gatewayStats.overall_success_rate || 0) * 100).toFixed(1)}%
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 text-gray-400 mb-2">
                <Radio className="w-4 h-4" />
                <span className="text-sm">Active Providers</span>
              </div>
              <div className="text-3xl font-bold text-purple-400">
                {gatewayProviders.filter(p => p.available).length}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Service Status Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {SERVICES.map(service => {
          const status = serviceStatuses[service.id];
          const Icon = service.icon;

          return (
            <div
              key={service.id}
              className="bg-gray-800 rounded-xl p-5 border border-gray-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: `${service.color}20` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: service.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{service.name}</h3>
                    <p className="text-gray-400 text-sm">{service.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(status?.status)}
                  <span className={`text-sm font-medium ${getStatusColor(status?.status)}`}>
                    {status?.status || 'Checking...'}
                  </span>
                </div>
              </div>

              {status?.error && (
                <div className="mt-3 text-xs text-gray-500 bg-gray-900 rounded p-2">
                  {status.error}
                </div>
              )}

              {/* Service-specific details */}
              {service.id === 'news-podcaster' && status?.status === 'online' && status?.data && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Version:</span>
                      <span className="ml-2">{status.data.version}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Active Runs:</span>
                      <span className="ml-2">{status.data.active_runs || 0}</span>
                    </div>
                  </div>
                </div>
              )}

              {service.id === 'genai-gateway' && status?.status === 'online' && status?.data && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Version:</span>
                      <span className="ml-2">{status.data.version}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Providers:</span>
                      <span className="ml-2">{status.data.providers_available}/{status.data.providers_total}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* GenAI Gateway Providers */}
      {gatewayProviders.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700 mb-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-400" />
            GenAI Gateway Providers
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {gatewayProviders.map(provider => (
              <div
                key={provider.name}
                className={`p-3 rounded-lg border ${
                  provider.available
                    ? 'bg-green-900/20 border-green-700/50'
                    : 'bg-gray-900 border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium capitalize">{provider.name}</span>
                  {provider.available ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-gray-500" />
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  <div>Channel: {provider.channel}</div>
                  <div>Calls: {provider.total_calls || 0}</div>
                  {provider.last_error && (
                    <div className="text-red-400 mt-1 truncate" title={provider.last_error}>
                      Error: {provider.last_error}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Podcast Runs */}
      {podcastRuns.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-purple-400" />
            Recent Podcast Runs
          </h3>
          <div className="space-y-3">
            {podcastRuns.map(run => (
              <div
                key={run.id}
                className="flex items-center justify-between p-3 bg-gray-900 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    run.status === 'completed' ? 'bg-green-400' :
                    run.status === 'failed' ? 'bg-red-400' :
                    'bg-yellow-400 animate-pulse'
                  }`} />
                  <div>
                    <span className="text-sm font-medium">Run {run.id}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {new Date(run.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-400">
                    {run.articles_collected || 0} articles
                  </span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    run.status === 'completed' ? 'bg-green-900/50 text-green-400' :
                    run.status === 'failed' ? 'bg-red-900/50 text-red-400' :
                    'bg-yellow-900/50 text-yellow-400'
                  }`}>
                    {run.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-6 flex gap-4">
        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          GenAI Gateway Docs
        </a>
        <a
          href="http://localhost:8080/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm font-medium transition-colors"
        >
          News Podcaster Docs
        </a>
        <a
          href="http://localhost:5678"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-medium transition-colors"
        >
          n8n Dashboard
        </a>
      </div>
    </div>
  );
}
