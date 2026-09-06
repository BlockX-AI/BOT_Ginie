# Live File Viewing & Vercel URL Implementation

## ✅ COMPLETED: Backend Changes

### 1. File Storage on Creation ✅
**Files Modified:**
- `agent/tools.py`

**Changes:**
- Added imports for `get_db`, `store_project_file`, and `logging`
- Modified `create_file` tool:
  - Now stores files in database immediately after writing to sandbox
  - Sends WebSocket notification with `file_created` event
  - Includes file_path in WebSocket message
- Modified `write_multiple_files` tool:
  - Stores all files in database immediately after batch write
  - Sends WebSocket notifications for each file via callback
  - Logs warnings if DB storage fails (non-blocking)

**WebSocket Events:**
```json
{
  "e": "file_created",
  "message": "Created src/App.jsx",
  "file_path": "src/App.jsx",
  "file_id": "uuid",
  "size": 1024
}
```

### 2. Vercel Deployment Naming ✅
**Files Modified:**
- `integrations/vercel_client.py`
- `agent/graph_nodes.py`

**Changes in `vercel_client.py`:**
- Updated `_sanitize_project_name()` method:
  - Now uses chat title/prompt as primary name
  - Only adds short 4-character suffix for uniqueness (instead of 8-char UUID)
  - Better character handling (spaces, special chars)
  - Result: `"a-2048-tile-game-5f5a"` instead of `"project-7943d5f5"`

**Changes in `graph_nodes.py`:**
- Fetches `chat.title` from database
- Passes title to Vercel deployment as `project_name`
- Vercel URL now reflects the actual project: `https://a-2048-tile-game-5f5a.vercel.app`

**Vercel URL WebSocket Event:**
```json
{
  "e": "deployment_success",
  "message": "✅ Deployed to Vercel!",
  "vercel_url": "https://a-2048-tile-game-5f5a.vercel.app"
}
```

---

## 🔨 TODO: Frontend Changes

### 3. Update File Fetching API
**File to Modify:** `frontend/app/chat/[id]/page.tsx`

**Current Issue:**
- Uses old endpoint: `/projects/${chatId}/files`
- Only gets files from E2B sandbox, not database

**Required Changes:**
```typescript
// Line 84: Change endpoint
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

// Line 96: Update state mapping
setProjectFiles(response.data.files?.map(f => f.file_path) || []);
```

### 4. Add WebSocket Handler for File Events
**File to Modify:** `frontend/lib/websocket-handlers.ts`

**Add new handler in `handleWebSocketMessage` function:**
```typescript
// After line 100, add:
if (data.e === "file_created" || data.e === "file_stored") {
  console.log("📁 File created/stored:", data.file_path);
  
  // Trigger file list refresh
  if (handlers.fetchProjectFiles) {
    handlers.fetchProjectFiles();
  }
  
  return;
}

// Also add for deployment success to show Vercel URL
if (data.e === "deployment_success") {
  console.log("🚀 Deployment successful:", data.vercel_url);
  
  // Store Vercel URL
  if (handlers.setVercelUrl && data.vercel_url) {
    handlers.setVercelUrl(data.vercel_url);
  }
  
  return;
}
```

**Update WebSocketHandlers type:**
```typescript
// In chat-types.ts, add to WebSocketHandlers interface:
fetchProjectFiles?: () => void;
setVercelUrl?: (url: string) => void;
```

### 5. Add Vercel URL Display
**File to Modify:** `frontend/app/chat/[id]/page.tsx`

**Add State:**
```typescript
const [vercelUrl, setVercelUrl] = useState<string | null>(null);
```

**Update WebSocket handlers (line 247):**
```typescript
const wsHandlers = createWebSocketHandlers(
  chatId,
  () => {
    setWsConnected(true);
    setError(null);
  },
  () => setWsConnected(false),
  () => setWsConnected(false),
  (event) =>
    handleWebSocketMessage(event, {
      setCurrentTool,
      setIsBuilding,
      pollUrlUntilReady,
      setMessages,
      setAppUrl,
      setError,
      setUserData,
      consolidateMessages,
      currentTool,
      fetchProjectFiles,  // ADD THIS
      setVercelUrl,        // ADD THIS
    }),
);
```

**Add Vercel URL Display Component (in the chat header area):**
```tsx
{vercelUrl && (
  <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
    <svg className="w-4 h-4 text-green-400" /* Vercel icon */ />
    <span className="text-sm text-white/80">Live:</span>
    <a 
      href={vercelUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-green-400 hover:underline"
    >
      {vercelUrl.replace('https://', '')}
    </a>
    <ExternalLink className="w-3 h-3 text-white/50" />
  </div>
)}
```

---

## 📊 How It Works Now

### File Creation Flow:
```
1. Agent calls create_file("src/App.jsx", content)
   ↓
2. File written to E2B sandbox
   ↓
3. IMMEDIATELY stored in project_files table
   ↓
4. WebSocket event sent: { e: "file_created", file_path: "src/App.jsx" }
   ↓
5. Frontend receives event → calls /api/projects/{id}/files-list
   ↓
6. Files Panel updates in real-time
```

### Vercel Deployment Flow:
```
1. Build completes successfully
   ↓
2. vercel_deployer_node fetches chat.title
   ↓
3. Sanitizes title: "a 2048 tile game" → "a-2048-tile-game-5f5a"
   ↓
4. Deploys to Vercel with readable name
   ↓
5. WebSocket event: { e: "deployment_success", vercel_url: "https://..." }
   ↓
6. Frontend displays Vercel URL in header
```

---

## 🧪 Testing Checklist

### Backend (Already Works):
- ✅ Files stored in DB on creation
- ✅ WebSocket events sent with file info
- ✅ Vercel naming uses chat title
- ✅ Database foreign keys and cascades work

### Frontend (Needs Implementation):
- ⏳ Update API endpoint to `/api/projects/{id}/files-list`
- ⏳ Add WebSocket handlers for `file_created` and `deployment_success`
- ⏳ Display Vercel URL in chat header
- ⏳ Refresh file list on WebSocket events

---

## 🎯 Expected Results

### Before:
- Files only visible after entire build completes
- Vercel URL: `https://project-7943d5f5-7943d5f5.vercel.app`
- No live updates during build

### After:
- ✅ Files appear **immediately** as they're created
- ✅ Vercel URL: `https://a-2048-tile-game-5f5a.vercel.app`
- ✅ Real-time file panel updates
- ✅ Vercel link displayed prominently when deployment completes
- ✅ All files accessible even if build fails (stored in DB)

---

## 📝 Summary

**Backend: 100% Complete ✅**
- Tools modified to store files immediately
- WebSocket events implemented
- Vercel naming fixed

**Frontend: Ready for Implementation 🔨**
- API endpoint needs updating (1 line change)
- WebSocket handlers need 2 new event types
- Vercel URL display component needed
- All code snippets provided above

**Estimated Time:** 15-20 minutes to implement frontend changes
