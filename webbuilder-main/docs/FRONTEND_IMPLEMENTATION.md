# Frontend Implementation Guide

Complete guide to implement the 3 major features in your React frontend.

---

## Feature 1: Clean Log Rendering with Filtered Events

### Component: `BuildLog.jsx`

```jsx
import React, { useState, useEffect, useRef } from 'react';

const BuildLog = ({ chatId, socket }) => {
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);
  
  // Internal events to hide from user
  const INTERNAL_EVENTS = [
    'thinking',
    'tool_started',
    'tool_completed',
    'snapshot_saved'
  ];
  
  // Event priority for styling
  const getEventStyle = (eventType) => {
    const styles = {
      error: 'bg-red-50 border-l-4 border-red-500 text-red-700',
      fatal_error: 'bg-red-100 border-l-4 border-red-600 text-red-800 font-bold',
      server_started: 'bg-green-50 border-l-4 border-green-500 text-green-700',
      deployment_success: 'bg-blue-50 border-l-4 border-blue-500 text-blue-700',
      build_success: 'bg-green-50 border-l-4 border-green-400 text-green-600',
      default: 'bg-gray-50 border-l-4 border-gray-300 text-gray-700'
    };
    
    return styles[eventType] || styles.default;
  };
  
  useEffect(() => {
    if (!socket) return;
    
    const handleMessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Filter out internal events
      if (INTERNAL_EVENTS.includes(data.e)) {
        return;
      }
      
      // Add to logs
      setLogs(prev => [...prev, {
        id: Date.now() + Math.random(),
        type: data.e,
        message: data.message,
        timestamp: new Date().toISOString()
      }]);
    };
    
    socket.addEventListener('message', handleMessage);
    
    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket]);
  
  // Auto-scroll to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);
  
  return (
    <div className="build-log h-96 overflow-y-auto bg-white rounded-lg shadow p-4 space-y-2">
      <h3 className="text-lg font-semibold mb-4">Build Log</h3>
      
      {logs.length === 0 && (
        <p className="text-gray-400 text-center py-8">Waiting for build to start...</p>
      )}
      
      {logs.map(log => (
        <div 
          key={log.id} 
          className={`p-3 rounded ${getEventStyle(log.type)}`}
        >
          <div className="flex items-start gap-2">
            <span className="text-xs text-gray-500 mt-1">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <p className="flex-1">{log.message}</p>
          </div>
        </div>
      ))}
      
      <div ref={logEndRef} />
    </div>
  );
};

export default BuildLog;
```

---

## Feature 2: Vercel URL Display

### Component: `DeploymentUrls.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { Copy, ExternalLink, CheckCircle } from 'lucide-react';

const DeploymentUrls = ({ chatId, socket }) => {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [vercelUrl, setVercelUrl] = useState(null);
  const [copied, setCopied] = useState(null);
  
  useEffect(() => {
    if (!socket) return;
    
    const handleMessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Extract preview URL
      if (data.e === 'server_started' && data.preview_url) {
        setPreviewUrl(data.preview_url);
      }
      
      // Extract Vercel URL
      if (data.e === 'deployment_success' && data.vercel_url) {
        setVercelUrl(data.vercel_url);
      }
    };
    
    socket.addEventListener('message', handleMessage);
    
    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket]);
  
  const copyToClipboard = (url, type) => {
    navigator.clipboard.writeText(url);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };
  
  if (!previewUrl && !vercelUrl) {
    return null;
  }
  
  return (
    <div className="deployment-urls space-y-4 mt-6">
      <h3 className="text-lg font-semibold">🚀 Your App is Live!</h3>
      
      {/* Preview URL (E2B) */}
      {previewUrl && (
        <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-300">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-yellow-600">⚡</span>
              <span className="font-semibold text-yellow-800">Preview URL</span>
              <span className="text-xs bg-yellow-200 px-2 py-1 rounded">Temporary (30 min)</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 bg-white px-3 py-2 rounded text-sm truncate">
              {previewUrl}
            </code>
            
            <button
              onClick={() => window.open(previewUrl, '_blank')}
              className="p-2 hover:bg-yellow-100 rounded"
              title="Open preview"
            >
              <ExternalLink size={18} />
            </button>
            
            <button
              onClick={() => copyToClipboard(previewUrl, 'preview')}
              className="p-2 hover:bg-yellow-100 rounded"
              title="Copy URL"
            >
              {copied === 'preview' ? <CheckCircle size={18} className="text-green-600" /> : <Copy size={18} />}
            </button>
          </div>
          
          <p className="text-xs text-yellow-700 mt-2">
            ⚠️ This URL expires when the sandbox closes (~30 minutes)
          </p>
        </div>
      )}
      
      {/* Vercel URL (Permanent) */}
      {vercelUrl && (
        <div className="border rounded-lg p-4 bg-green-50 border-green-300">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-green-600">🎉</span>
              <span className="font-semibold text-green-800">Production URL</span>
              <span className="text-xs bg-green-200 px-2 py-1 rounded">Permanent ♾️</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 bg-white px-3 py-2 rounded text-sm truncate">
              {vercelUrl}
            </code>
            
            <button
              onClick={() => window.open(vercelUrl, '_blank')}
              className="p-2 hover:bg-green-100 rounded"
              title="Open production site"
            >
              <ExternalLink size={18} />
            </button>
            
            <button
              onClick={() => copyToClipboard(vercelUrl, 'vercel')}
              className="p-2 hover:bg-green-100 rounded"
              title="Copy URL"
            >
              {copied === 'vercel' ? <CheckCircle size={18} className="text-green-600" /> : <Copy size={18} />}
            </button>
          </div>
          
          <p className="text-xs text-green-700 mt-2">
            ✅ This URL never expires - share it with anyone!
          </p>
        </div>
      )}
    </div>
  );
};

export default DeploymentUrls;
```

---

## Feature 3: Real-Time Files Panel with ZIP Download

### Component: `FilesPanel.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import { Download, FileText, Folder, FolderOpen } from 'lucide-react';
import axios from 'axios';

const FilesPanel = ({ chatId, socket }) => {
  const [files, setFiles] = useState([]);
  const [fileCount, setFileCount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  
  // Fetch initial files list
  useEffect(() => {
    fetchFiles();
  }, [chatId]);
  
  // Listen for real-time file updates
  useEffect(() => {
    if (!socket) return;
    
    const handleMessage = (event) => {
      const data = JSON.parse(event.data);
      
      // Real-time file creation/update
      if (data.e === 'file_created' || data.e === 'file_updated') {
        setFiles(prev => {
          const exists = prev.find(f => f.file_path === data.file_path);
          if (exists) {
            // Update existing
            return prev.map(f => 
              f.file_path === data.file_path 
                ? { ...f, size: data.size, updated_at: new Date().toISOString() }
                : f
            );
          } else {
            // Add new
            return [...prev, {
              id: Date.now(),
              file_path: data.file_path,
              size: data.size,
              created_at: new Date().toISOString()
            }];
          }
        });
        setFileCount(prev => exists ? prev : prev + 1);
      }
      
      // Batch files stored
      if (data.e === 'files_stored') {
        fetchFiles(); // Refresh full list
      }
    };
    
    socket.addEventListener('message', handleMessage);
    
    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket]);
  
  const fetchFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/projects/${chatId}/files-list`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFiles(response.data.files);
      setFileCount(response.data.file_count);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  };
  
  const downloadZip = async () => {
    try {
      setDownloading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/api/projects/${chatId}/download-db`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `project-${chatId.slice(0, 8)}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download ZIP:', error);
      alert('Failed to download project files');
    } finally {
      setDownloading(false);
    }
  };
  
  // Organize files into tree structure
  const buildFileTree = () => {
    const tree = {};
    
    files.forEach(file => {
      const parts = file.file_path.split('/');
      let current = tree;
      
      parts.forEach((part, index) => {
        if (index === parts.length - 1) {
          // It's a file
          if (!current.files) current.files = [];
          current.files.push(file);
        } else {
          // It's a folder
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
      });
    });
    
    return tree;
  };
  
  const toggleFolder = (path) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };
  
  const renderTree = (node, path = '') => {
    const folders = Object.keys(node).filter(k => k !== 'files');
    const files = node.files || [];
    
    return (
      <div className="ml-4">
        {/* Render folders */}
        {folders.map(folder => {
          const folderPath = path ? `${path}/${folder}` : folder;
          const isExpanded = expandedFolders.has(folderPath);
          
          return (
            <div key={folderPath}>
              <div 
                className="flex items-center gap-2 py-1 px-2 hover:bg-gray-100 rounded cursor-pointer"
                onClick={() => toggleFolder(folderPath)}
              >
                {isExpanded ? <FolderOpen size={16} className="text-yellow-600" /> : <Folder size={16} className="text-yellow-600" />}
                <span className="text-sm font-medium">{folder}</span>
              </div>
              {isExpanded && renderTree(node[folder], folderPath)}
            </div>
          );
        })}
        
        {/* Render files */}
        {files.map(file => (
          <div 
            key={file.id} 
            className="flex items-center gap-2 py-1 px-2 hover:bg-gray-50 rounded"
          >
            <FileText size={16} className="text-blue-500" />
            <span className="text-sm flex-1">{file.file_path.split('/').pop()}</span>
            <span className="text-xs text-gray-400">
              {(file.size / 1024).toFixed(1)} KB
            </span>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="files-panel border rounded-lg bg-white shadow-lg h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-gray-50">
        <div className="flex items-center gap-2">
          <FileText size={20} />
          <h3 className="font-semibold">Files ({fileCount})</h3>
        </div>
        
        <button
          onClick={downloadZip}
          disabled={fileCount === 0 || downloading}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
        >
          <Download size={16} />
          {downloading ? 'Downloading...' : 'Download ZIP'}
        </button>
      </div>
      
      {/* File tree */}
      <div className="flex-1 overflow-y-auto p-4">
        {fileCount === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <FileText size={48} className="mx-auto mb-2 opacity-50" />
            <p>No files yet</p>
            <p className="text-xs mt-1">Files will appear here as they're created</p>
          </div>
        ) : (
          renderTree(buildFileTree())
        )}
      </div>
      
      {/* Footer info */}
      {fileCount > 0 && (
        <div className="p-3 border-t bg-gray-50 text-xs text-gray-600">
          💡 Files are saved permanently and can be downloaded anytime
        </div>
      )}
    </div>
  );
};

export default FilesPanel;
```

---

## Complete Chat Interface Layout

### Component: `ChatInterface.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import BuildLog from './BuildLog';
import DeploymentUrls from './DeploymentUrls';
import FilesPanel from './FilesPanel';

const ChatInterface = ({ chatId }) => {
  const [socket, setSocket] = useState(null);
  
  useEffect(() => {
    // Connect WebSocket
    const ws = new WebSocket(`${process.env.REACT_APP_WS_URL}/ws/${chatId}`);
    ws.onopen = () => console.log('WebSocket connected');
    setSocket(ws);
    
    return () => {
      ws.close();
    };
  }, [chatId]);
  
  return (
    <div className="chat-interface grid grid-cols-3 gap-6 h-screen p-6">
      {/* Left: Chat + Build Log */}
      <div className="col-span-2 space-y-6">
        <BuildLog chatId={chatId} socket={socket} />
        <DeploymentUrls chatId={chatId} socket={socket} />
      </div>
      
      {/* Right: Files Panel */}
      <div className="col-span-1">
        <FilesPanel chatId={chatId} socket={socket} />
      </div>
    </div>
  );
};

export default ChatInterface;
```

---

## Environment Variables

Add to your `.env`:

```bash
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
```

---

## Dependencies

Install required packages:

```bash
npm install lucide-react axios
```

---

## Summary

You now have:
1. ✅ **Clean log rendering** with internal event filtering
2. ✅ **Vercel URL display** with both temporary and permanent URLs
3. ✅ **Real-time Files Panel** with live updates and ZIP download
4. ✅ **Professional UI** with proper styling and UX

The frontend will now show a clean, professional experience with real-time file updates, clear deployment URLs, and the ability to download project files at any time!
