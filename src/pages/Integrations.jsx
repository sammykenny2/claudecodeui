import { useState } from 'react';
import { Activity, Bot, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import IntegrationDashboard from '../components/IntegrationDashboard';
import MultiAgentChat from '../components/MultiAgentChat';

/**
 * Integrations Page - Unified access to SK2 project integrations
 *
 * This page provides access to:
 * 1. Integration Dashboard - Monitor all SK2 services
 * 2. Multi-Agent Chat - Connect to autogen-conversation meeting room
 */

export default function Integrations() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard' or 'chat'

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Back to main app"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-purple-400" />
            SK2 Integrations
          </h1>
        </div>

        {/* View Selector */}
        <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setActiveView('dashboard')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === 'dashboard'
                ? 'bg-purple-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Dashboard
            </span>
          </button>
          <button
            onClick={() => setActiveView('chat')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeView === 'chat'
                ? 'bg-purple-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            <span className="flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Multi-Agent Chat
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === 'dashboard' && <IntegrationDashboard />}
        {activeView === 'chat' && <MultiAgentChat />}
      </div>
    </div>
  );
}
