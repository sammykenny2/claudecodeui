import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Settings, RefreshCw, Circle, AlertCircle, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

/**
 * MultiAgentChat - Integration with autogen-conversation Meeting Room
 *
 * Connects to the autogen-conversation WebSocket backend to enable
 * multi-agent conversations directly from claudecodeui.
 */

const AUTOGEN_WS_URL = 'ws://localhost:8000/ws/chat';
const AUTOGEN_API_URL = 'http://localhost:8000/api/v1';

// Available agents from autogen-conversation
const AVAILABLE_AGENTS = [
  { id: 'gemini', name: 'Gemini', color: '#4285F4', description: 'Google Gemini AI' },
  { id: 'claude', name: 'Claude', color: '#D97706', description: 'Anthropic Claude' },
  { id: 'ollama', name: 'Ollama', color: '#10B981', description: 'Local Ollama models' },
  { id: 'copilot', name: 'Copilot', color: '#6366F1', description: 'GitHub Copilot' },
];

export default function MultiAgentChat({ onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedAgents, setSelectedAgents] = useState(['gemini', 'claude']);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState({});
  const [providers, setProviders] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch available providers on mount
  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await fetch(`${AUTOGEN_API_URL}/providers`);
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);
      }
    } catch (err) {
      console.error('Failed to fetch providers:', err);
    }
  };

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setIsConnecting(true);
    setError(null);

    const newSessionId = `claude-ui-${Date.now()}`;
    setSessionId(newSessionId);

    const ws = new WebSocket(`${AUTOGEN_WS_URL}/${newSessionId}`);

    ws.onopen = () => {
      setIsConnected(true);
      setIsConnecting(false);
      setMessages(prev => [...prev, {
        type: 'system',
        content: 'Connected to Multi-Agent Meeting Room',
        timestamp: new Date().toISOString()
      }]);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    ws.onerror = (event) => {
      console.error('WebSocket error:', event);
      setError('Connection error. Is autogen-conversation server running?');
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsConnecting(false);
      setAgentStatuses({});
    };

    wsRef.current = ws;
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      // Send end session message
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'end_session' }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
    setSessionId(null);
  }, []);

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'message':
        setMessages(prev => [...prev, {
          type: 'agent',
          sender: data.sender,
          content: data.content,
          timestamp: data.timestamp || new Date().toISOString()
        }]);
        // Clear thinking status for this agent
        setAgentStatuses(prev => ({
          ...prev,
          [data.sender?.toLowerCase()]: 'idle'
        }));
        break;

      case 'status':
        setAgentStatuses(prev => ({
          ...prev,
          [data.agent?.toLowerCase()]: data.status
        }));
        break;

      case 'error':
        setMessages(prev => [...prev, {
          type: 'error',
          content: data.message || 'Unknown error',
          timestamp: new Date().toISOString()
        }]);
        break;

      case 'session_started':
        setMessages(prev => [...prev, {
          type: 'system',
          content: `Session started with agents: ${data.agents?.join(', ')}`,
          timestamp: new Date().toISOString()
        }]);
        break;

      case 'action_result':
        // Display ReAct action results
        setMessages(prev => [...prev, {
          type: 'action',
          action: data.action,
          result: data.result,
          success: data.success,
          timestamp: new Date().toISOString()
        }]);
        break;

      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const startSession = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connect();
      // Wait for connection then start
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'start_session',
            agents: selectedAgents
          }));
        }
      }, 500);
    } else {
      wsRef.current.send(JSON.stringify({
        type: 'start_session',
        agents: selectedAgents
      }));
    }
  };

  const sendMessage = () => {
    if (!inputValue.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const userMessage = {
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);

    wsRef.current.send(JSON.stringify({
      type: 'user_message',
      content: inputValue.trim()
    }));

    setInputValue('');

    // Set all selected agents to "thinking"
    const newStatuses = {};
    selectedAgents.forEach(agent => {
      newStatuses[agent] = 'thinking';
    });
    setAgentStatuses(newStatuses);
  };

  const toggleAgent = (agentId) => {
    setSelectedAgents(prev => {
      if (prev.includes(agentId)) {
        return prev.filter(id => id !== agentId);
      } else {
        return [...prev, agentId];
      }
    });
  };

  const getAgentColor = (agentId) => {
    const agent = AVAILABLE_AGENTS.find(a => a.id === agentId.toLowerCase());
    return agent?.color || '#6B7280';
  };

  const getProviderStatus = (agentId) => {
    const provider = providers.find(p => p.name.toLowerCase() === agentId.toLowerCase());
    return provider?.available ? 'available' : 'unavailable';
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-purple-400" />
          <h2 className="text-lg font-semibold">Multi-Agent Meeting Room</h2>
          {isConnected && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <Circle className="w-2 h-2 fill-current" />
              Connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchProviders}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh providers"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Agent Selector */}
      <div className="p-3 border-b border-gray-700 bg-gray-800/50">
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_AGENTS.map(agent => {
            const isSelected = selectedAgents.includes(agent.id);
            const status = getProviderStatus(agent.id);
            const agentStatus = agentStatuses[agent.id];

            return (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                  isSelected
                    ? 'bg-opacity-30 border-2'
                    : 'bg-gray-700 border-2 border-transparent opacity-60 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: isSelected ? `${agent.color}30` : undefined,
                  borderColor: isSelected ? agent.color : 'transparent'
                }}
                disabled={isConnected}
              >
                {/* Status indicator */}
                {agentStatus === 'thinking' ? (
                  <RefreshCw className="w-3 h-3 animate-spin" style={{ color: agent.color }} />
                ) : status === 'available' ? (
                  <CheckCircle className="w-3 h-3 text-green-400" />
                ) : (
                  <AlertCircle className="w-3 h-3 text-yellow-500" />
                )}
                <span style={{ color: isSelected ? agent.color : undefined }}>
                  {agent.name}
                </span>
              </button>
            );
          })}
        </div>

        {!isConnected && (
          <button
            onClick={startSession}
            disabled={selectedAgents.length === 0 || isConnecting}
            className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
          >
            {isConnecting ? 'Connecting...' : 'Start Session'}
          </button>
        )}

        {isConnected && (
          <button
            onClick={disconnect}
            className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
          >
            End Session
          </button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-2 p-3 bg-red-900/50 border border-red-700 rounded-lg text-sm text-red-200">
          {error}
          <div className="mt-1 text-xs text-red-300">
            Run: <code className="bg-red-900/50 px-1 rounded">uvicorn backend.server:app --port 8000</code>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Select agents and start a session to begin</p>
            <p className="text-sm mt-2">Messages from all agents will appear here</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.type === 'user' ? 'justify-end' : ''}`}>
            {msg.type !== 'user' && (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: msg.type === 'agent'
                    ? `${getAgentColor(msg.sender)}30`
                    : msg.type === 'error'
                    ? '#EF444430'
                    : '#6B728030'
                }}
              >
                {msg.type === 'agent' ? (
                  <Bot className="w-4 h-4" style={{ color: getAgentColor(msg.sender) }} />
                ) : msg.type === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <Settings className="w-4 h-4 text-gray-400" />
                )}
              </div>
            )}

            <div className={`max-w-[80%] ${msg.type === 'user' ? 'order-first' : ''}`}>
              {msg.type === 'agent' && (
                <div className="text-xs mb-1" style={{ color: getAgentColor(msg.sender) }}>
                  {msg.sender}
                </div>
              )}

              <div
                className={`rounded-lg px-4 py-2 ${
                  msg.type === 'user'
                    ? 'bg-blue-600'
                    : msg.type === 'error'
                    ? 'bg-red-900/50 border border-red-700'
                    : msg.type === 'system'
                    ? 'bg-gray-700/50 text-gray-400 text-sm'
                    : msg.type === 'action'
                    ? 'bg-yellow-900/30 border border-yellow-700/50'
                    : 'bg-gray-800'
                }`}
              >
                {msg.type === 'action' ? (
                  <div className="text-sm">
                    <div className="font-medium text-yellow-400">Action: {msg.action}</div>
                    <pre className="mt-1 text-xs overflow-x-auto whitespace-pre-wrap">
                      {typeof msg.result === 'string' ? msg.result : JSON.stringify(msg.result, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <ReactMarkdown className="prose prose-invert prose-sm max-w-none">
                    {msg.content}
                  </ReactMarkdown>
                )}
              </div>

              <div className="text-xs text-gray-500 mt-1">
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>

            {msg.type === 'user' && (
              <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-blue-400" />
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={isConnected ? "Type your message..." : "Start a session first..."}
            disabled={!isConnected}
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={sendMessage}
            disabled={!isConnected || !inputValue.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
