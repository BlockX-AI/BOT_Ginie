"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { WS_URL } from "@/lib/utils";
import apiClient from "@/api/client";
import {
  ChatIdHeader,
  MessageBubble,
  ToolCallsDropdown,
  PreviewPanel,
  ChatInput,
} from "@/components/chat";
import { consolidateMessages, getAllToolCalls } from "@/lib/chat-utils";
import {
  handleWebSocketMessage,
  createWebSocketHandlers,
} from "@/lib/websocket-handlers";
import type { Message, ActiveToolCall } from "@/lib/chat-types";

export default function ChatIdPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = params.id as string;

  const [wsConnected, setWsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [appUrl, setAppUrl] = useState<string | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [currentTool, setCurrentTool] = useState<ActiveToolCall | null>(null);
  const [isCheckingUrl, setIsCheckingUrl] = useState(false);
  const [showAllToolsDropdown, setShowAllToolsDropdown] = useState(false);
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [vercelUrl, setVercelUrl] = useState<string | null>(null);
  const [githubRepoUrl, setGithubRepoUrl] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const urlCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to fetch chat details including Vercel URL and build status
  const fetchChatDetails = async () => {
    if (typeof window === "undefined") return;

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) return;

      console.log("📋 Fetching chat details for:", chatId);

      const response = await apiClient.get<{
        chat: {
          id: string;
          title: string;
          app_url: string | null;
          vercel_url: string | null;
          deployment_status: string | null;
          github_repo_url?: string | null;
          created_at: string;
        };
        messages: any[];
      }>(`/chats/${chatId}/messages`);

      // Set Vercel URL if it exists (for existing deployments)
      if (response.data.chat.vercel_url) {
        console.log("🚀 Found existing Vercel URL:", response.data.chat.vercel_url);
        setVercelUrl(response.data.chat.vercel_url);
      }

      // Set GitHub repo URL if it exists (for existing exports)
      if (response.data.chat.github_repo_url) {
        console.log("🐙 Found existing GitHub repo URL:", response.data.chat.github_repo_url);
        setGithubRepoUrl(response.data.chat.github_repo_url);
      }

      // Set app URL if it exists (E2B preview)
      if (response.data.chat.app_url) {
        setAppUrl(response.data.chat.app_url);
      }

      // Load messages
      if (response.data.messages && response.data.messages.length > 0) {
        setMessages(response.data.messages);
      }
      
      // Check if there's an ongoing build (for page refresh persistence)
      try {
        const buildStatusResponse = await apiClient.get<{
          chat_id: string;
          build_status: string | null;
          build_started_at: string | null;
          last_build_event: string | null;
          is_building: boolean;
        }>(`/chats/${chatId}/build-status`);
        
        if (buildStatusResponse.data.is_building || buildStatusResponse.data.build_status === 'building') {
          console.log("⚠️ Detected ongoing build after page refresh");
          setIsBuilding(true);
          setError("⚠️ Build is in progress. This page was refreshed during an active build. The WebSocket will reconnect automatically, but some progress may be lost.");
        }
      } catch (buildErr) {
        console.log("Could not fetch build status:", buildErr);
      }
      
    } catch (error) {
      console.error("Error fetching chat details:", error);
    }
  };

  // Check authentication and load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      const user = localStorage.getItem("user_data");

      if (user) {
        try {
          setUserData(JSON.parse(user));
        } catch (err) {
          console.error("Failed to parse user data:", err);
        }
      }

      // Fetch chat details including Vercel URL
      await fetchChatDetails();
      
      // Fetch project files (critical for page refresh persistence)
      await fetchProjectFiles();

      setIsLoading(false);
    };

    loadInitialData();
  }, [chatId]);

  // Function to fetch project files
  const fetchProjectFiles = async () => {
    // Check if we're in a browser environment
    if (typeof window === "undefined") {
      console.log("Not in browser environment, skipping file fetch");
      return;
    }

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        console.log("No auth token available for fetching files");
        return;
      }

      console.log("📁 Fetching project files for:", chatId);

      const response = await apiClient.get<{
        project_id: string;
        file_count: number;
        files: Array<{
          id: string;
          file_path: string;
          size: number;
          created_at: string;
          updated_at: string;
        }>;
      }>(`/api/projects/${chatId}/files-list`);

      console.log(
        "Files fetched successfully:",
        response.data.files?.length || 0,
        "files",
      );
      setProjectFiles(response.data.files?.map(f => f.file_path) || []);
    } catch (error) {
      console.error("Error fetching files:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
      }
    }
  };

  // Function to check if URL is ready
  const checkUrlReady = async (url: string): Promise<boolean> => {
    try {
      const response = await fetch(url, {
        method: "HEAD",
        mode: "no-cors", // This will prevent CORS errors
      });
      // With no-cors, we can't read the status, but if it doesn't throw, it's accessible
      return true;
    } catch (error) {
      console.log("URL not ready yet:", error);
      return false;
    }
  };

  // Poll URL until it's ready
  const pollUrlUntilReady = async (url: string) => {
    setIsCheckingUrl(true);
    console.log("Starting URL health check for:", url);

    let attempts = 0;
    const maxAttempts = 20; // 20 attempts over ~20 seconds

    const checkInterval = setInterval(async () => {
      attempts++;
      console.log(`Health check attempt ${attempts}/${maxAttempts}`);

      const isReady = await checkUrlReady(url);

      if (isReady || attempts >= maxAttempts) {
        clearInterval(checkInterval);
        setIsCheckingUrl(false);

        if (isReady) {
          console.log("URL is ready, setting iframe");
          setAppUrl(url);
        } else {
          console.log("Max attempts reached, setting iframe anyway");
          setAppUrl(url);
        }
      }
    }, 1000); // Check every 1 second

    urlCheckIntervalRef.current = checkInterval;
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (urlCheckIntervalRef.current) {
        clearInterval(urlCheckIntervalRef.current);
      }
    };
  }, []);

  // Fetch files when appUrl becomes available
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === "undefined") {
      console.log("Not in browser, skipping file fetch setup");
      return;
    }

    if (appUrl && chatId) {
      // Delay initial fetch to ensure everything is ready
      const initialTimeout = setTimeout(() => {
        fetchProjectFiles();
      }, 1000);

      // Refetch files every 10 seconds while building
      const interval = setInterval(() => {
        if (isBuilding) {
          fetchProjectFiles();
        }
      }, 10000);

      return () => {
        clearTimeout(initialTimeout);
        clearInterval(interval);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUrl, isBuilding, chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle drag resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const chatWidth = (mouseX / rect.width) * 100;
      const newPreviewWidth = 100 - chatWidth;

      if (chatWidth > 20 && chatWidth < 70) {
        setPreviewWidth(newPreviewWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);

  // WebSocket connection setup with automatic reconnection
  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isCleaningUp = false;

    const connectWebSocket = () => {
      // Prevent duplicate connections
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log("WebSocket already connected, skipping...");
        return;
      }

      // Don't reconnect if we're cleaning up
      if (isCleaningUp) {
        console.log("Cleanup in progress, skipping reconnect");
        return;
      }

      const token = localStorage.getItem("auth_token");

      if (!token) {
        console.log("No token available for WebSocket connection");
        return;
      }

      // Small delay to ensure backend is ready
      setTimeout(() => {
        if (isCleaningUp) return;
        
        try {
          const wsUrl = `${WS_URL}/ws/${chatId}?token=${token}`;
          console.log("WebSocket URL being used:", wsUrl);
          const ws = new WebSocket(wsUrl);

          ws.onopen = () => {
            console.log("✅ WebSocket connected for chat:", chatId);
            setWsConnected(true);
            setError(null);
            reconnectAttempts = 0; // Reset on successful connection
          };

          ws.onerror = (error) => {
            console.error("WebSocket error:", error);
            setWsConnected(false);
          };

          ws.onmessage = (event) => {
            handleWebSocketMessage(event, {
              setCurrentTool,
              setIsBuilding,
              setIsLoading,
              pollUrlUntilReady,
              setMessages,
              setAppUrl,
              setError,
              setUserData,
              consolidateMessages,
              currentTool,
              fetchProjectFiles,
              setVercelUrl,
              setGithubRepoUrl,
            });
          };

          ws.onclose = (event) => {
            console.log("⛔ WebSocket disconnected, code:", event.code, "reason:", event.reason);
            setWsConnected(false);
            wsRef.current = null;

            // Don't reconnect if cleanup is in progress or code 1000 (normal closure)
            if (isCleaningUp || event.code === 1000) {
              console.log("Normal closure or cleanup, not reconnecting");
              return;
            }

            // Attempt reconnection with exponential backoff
            if (reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts++;
              const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
              console.log(`🔄 Attempting reconnect ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms...`);
              setError(`Connection lost. Reconnecting... (${reconnectAttempts}/${maxReconnectAttempts})`);
              
              reconnectTimeout = setTimeout(() => {
                if (!isCleaningUp) {
                  connectWebSocket();
                }
              }, delay);
            } else {
              setError("Connection lost. Please refresh the page to reconnect.");
              console.log("Max reconnect attempts reached");
            }
          };

          wsRef.current = ws;
        } catch (err) {
          console.log("WebSocket connection failed:", err);
          setWsConnected(false);
        }
      }, 100); // 100ms delay
    };

    connectWebSocket();

    return () => {
      // Cleanup WebSocket connection
      isCleaningUp = true;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current) {
        console.log("🧹 Cleaning up WebSocket connection");
        wsRef.current.close(1000, "Component unmounting");
        wsRef.current = null;
      }
    };
  }, [chatId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !wsRef.current || isBuilding) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    // Send message through WebSocket
    const message = {
      type: "chat_message",
      prompt: input.trim(),
    };
    wsRef.current.send(JSON.stringify(message));

    // Add user message to chat
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsBuilding(true); // Immediately show building state
  };

  return (
    <div
      className="min-h-screen w-full bg-black relative overflow-hidden"
      ref={containerRef}
    >
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 50% 100% at 10% 0%, rgba(226, 232, 240, 0.15), transparent 65%), #000000",
        }}
      />

      <div className="relative z-10 h-screen flex flex-col">
        <ChatIdHeader
          userData={userData}
          showPreview={showPreview}
          onTogglePreview={() => setShowPreview(!showPreview)}
          onNewChat={() => router.push("/chat")}
          onBack={() => router.push("/chat")}
        />

        {/* Vercel Deployment URL Banner */}
        {vercelUrl && (
          <div className="border-b border-white/5 bg-gradient-to-r from-green-500/10 to-emerald-500/10 px-4 py-3">
            <div className="flex items-center justify-center gap-3">
              <svg
                className="w-4 h-4 text-green-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2L2 19.7778H22L12 2Z" />
              </svg>
              <span className="text-sm text-white/70">Live Deployment:</span>
              <a
                href={vercelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-400 hover:text-green-300 hover:underline font-medium transition-colors flex items-center gap-1"
              >
                {vercelUrl.replace("https://", "")}
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
        )}

        {/* GitHub Repo URL Banner */}
        {githubRepoUrl && (
          <div className="border-b border-white/5 bg-gradient-to-r from-slate-500/10 to-gray-500/10 px-4 py-3">
            <div className="flex items-center justify-center gap-3">
              <svg
                className="w-4 h-4 text-white/70"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  fillRule="evenodd"
                  d="M12 .5C5.73.5.75 5.65.75 12.06c0 5.13 3.29 9.48 7.86 11.01.58.11.79-.26.79-.57v-2.03c-3.2.71-3.87-1.58-3.87-1.58-.52-1.36-1.28-1.72-1.28-1.72-1.05-.74.08-.72.08-.72 1.16.08 1.77 1.22 1.77 1.22 1.03 1.8 2.7 1.28 3.36.98.1-.77.4-1.28.72-1.58-2.55-.3-5.23-1.31-5.23-5.84 0-1.29.45-2.35 1.18-3.18-.12-.3-.51-1.52.11-3.17 0 0 .97-.32 3.18 1.21.92-.26 1.9-.39 2.88-.39.98 0 1.96.13 2.88.39 2.21-1.53 3.18-1.21 3.18-1.21.62 1.65.23 2.87.11 3.17.73.83 1.18 1.89 1.18 3.18 0 4.54-2.69 5.54-5.25 5.84.41.36.78 1.09.78 2.2v3.27c0 .31.21.68.8.57 4.56-1.53 7.85-5.88 7.85-11.01C23.25 5.65 18.27.5 12 .5z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm text-white/70">GitHub Repo:</span>
              <a
                href={githubRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white/80 hover:text-white hover:underline font-medium transition-colors flex items-center gap-1"
              >
                {githubRepoUrl.replace("https://", "")}
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Panel */}
          <div
            className="flex flex-col border-r border-white/5"
            style={{
              width: showPreview ? `${100 - previewWidth}%` : "100%",
              transition: isDragging ? "none" : "width 0.3s ease-out",
            }}
          >
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-2 text-white/60">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading messages...</span>
                  </div>
                </div>
              ) : error ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              ) : null}

              {messages.map((msg, index) => (
                <MessageBubble
                  key={index}
                  message={msg}
                  isLastMessage={index === messages.length - 1}
                  currentTool={currentTool}
                />
              ))}

              <div ref={messagesEndRef} />
            </div>

            <ToolCallsDropdown
              toolCalls={getAllToolCalls(messages)}
              isExpanded={showAllToolsDropdown}
              onToggle={() => setShowAllToolsDropdown(!showAllToolsDropdown)}
            />

            <ChatInput
              input={input}
              wsConnected={wsConnected}
              isBuilding={isBuilding}
              onInputChange={setInput}
              onSubmit={handleSendMessage}
            />
          </div>

          {/* Divider */}
          {showPreview && (
            <div
              className="w-1 bg-white/5 hover:bg-white/20 cursor-col-resize transition-colors"
              onMouseDown={() => setIsDragging(true)}
              style={{ userSelect: "none" }}
            />
          )}

          {/* Preview Area */}
          {showPreview && (
            <PreviewPanel
              appUrl={appUrl}
              vercelUrl={vercelUrl}
              isCheckingUrl={isCheckingUrl}
              previewWidth={previewWidth}
              files={projectFiles}
              projectId={chatId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
