# WebSocket Events Documentation

This document lists all WebSocket events sent by the backend to the frontend.

## Event Types for Frontend Filtering

The frontend should filter and display these events appropriately:

### 🎯 **User-Facing Events** (Show in UI)
These events should be displayed as status updates to the user:

- `plan_received` - Plan generation started
- `plan_complete` - Plan generation finished
- `build_started` - Code generation started  
- `file_created` - Individual file created (real-time)
- `file_updated` - Individual file updated
- `files_stored` - Batch file storage complete
- `validation_started` - Code validation started
- `validation_complete` - Validation finished
- `install_started` - Dependency installation started
- `install_complete` - Dependencies installed
- `build_success` - Production build succeeded
- `starting_server` - Server starting
- `server_started` - Server ready + preview URL
- `deployment_started` - Vercel deployment started
- `deployment_success` - Vercel deployment complete + URL
- `deployment_failed` - Vercel deployment failed
- `error` - User-facing error message
- `fatal_error` - Fatal error requiring user action

### 📊 **Progress Events** (Show in UI with progress indicators)
- `install_progress` - npm install progress (e.g., "Installing... 30s")
- `server_progress` - Server startup progress
- `building` - Build in progress

### 🔇 **Internal Events** (Hide from UI logs)
These are internal events that should NOT be shown in the chat log:

- `thinking` - LLM thinking/processing (internal)
- `tool_started` - Agent tool execution started (internal)
- `tool_completed` - Agent tool execution completed (internal)
- `snapshot_saved` - Internal file snapshotting (internal)

---

## Complete Event Reference

### Planning Phase

```json
{
  "e": "plan_received",
  "message": "📋 Analyzing your request and creating implementation plan..."
}
```

```json
{
  "e": "plan_complete",
  "message": "✅ Plan created successfully",
  "plan": "# Implementation Plan\n\n..."
}
```

### Building Phase

```json
{
  "e": "build_started",
  "message": "🔨 Starting code generation..."
}
```

```json
{
  "e": "file_created",
  "file_path": "src/App.jsx",
  "size": 1024,
  "message": "✅ Created src/App.jsx"
}
```

```json
{
  "e": "file_updated",
  "file_path": "src/components/Header.jsx",
  "size": 2048,
  "message": "📝 Updated src/components/Header.jsx"
}
```

```json
{
  "e": "files_stored",
  "stored_count": 12,
  "failed_count": 0,
  "message": "📦 Stored 12 files in database"
}
```

### Validation Phase

```json
{
  "e": "validation_started",
  "message": "🔍 Validating code quality and dependencies..."
}
```

```json
{
  "e": "validation_complete",
  "message": "✅ Code validation passed"
}
```

### Installation & Build Phase

```json
{
  "e": "install_started",
  "message": "📦 Installing dependencies with npm..."
}
```

```json
{
  "e": "install_progress",
  "message": "Installing dependencies... (45s elapsed)"
}
```

```json
{
  "e": "install_complete",
  "message": "✅ Dependencies installed successfully"
}
```

```json
{
  "e": "building",
  "message": "Building production-optimized bundle..."
}
```

```json
{
  "e": "build_success",
  "message": "✅ Build completed, starting server..."
}
```

### Server Phase

```json
{
  "e": "starting_server",
  "message": "🚀 Starting HTTP server on port 5173..."
}
```

```json
{
  "e": "server_progress",
  "message": "Waiting for server... (10s)"
}
```

```json
{
  "e": "server_started",
  "message": "✅ Production build deployed and ready",
  "preview_url": "https://5173-xxxxx.e2b.app"
}
```

### Deployment Phase

```json
{
  "e": "deployment_started",
  "message": "🚀 Starting Vercel deployment..."
}
```

```json
{
  "e": "deployment_success",
  "message": "✅ Deployed to Vercel!",
  "vercel_url": "https://my-project-abc123.vercel.app"
}
```

```json
{
  "e": "deployment_failed",
  "message": "❌ Vercel deployment failed: <error details>"
}
```

### Error Events

```json
{
  "e": "error",
  "message": "❌ Build failed - check for errors in your code"
}
```

```json
{
  "e": "fatal_error",
  "message": "Fatal error: API key was reported as leaked"
}
```

---

## Frontend Integration Guide

### React Example

```jsx
// Filter events for display
const shouldShowInLog = (event) => {
  const internalEvents = [
    'thinking',
    'tool_started',
    'tool_completed',
    'snapshot_saved'
  ];
  
  return !internalEvents.includes(event.e);
};

// WebSocket handler
useEffect(() => {
  if (!socket) return;
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    // Always update files list for real-time viewer
    if (data.e === 'file_created' || data.e === 'file_updated') {
      updateFilesList(data);
    }
    
    // Show in logs only if user-facing
    if (shouldShowInLog(data)) {
      addToLog(data.message, data.e);
    }
    
    // Handle URLs
    if (data.preview_url) {
      setPreviewUrl(data.preview_url);
    }
    
    if (data.vercel_url) {
      setVercelUrl(data.vercel_url);
    }
  };
}, [socket]);
```

---

## Best Practices

1. **Always check event type** before displaying
2. **Filter out internal events** from chat logs
3. **Show file events** in the Files Panel, not the main log
4. **Display URLs** in a dedicated section, not inline in logs
5. **Use icons** (emojis) for visual clarity
6. **Group progress events** - don't spam the log with every 5s update

---

## Event Priorities

**Critical** (Always show):
- `server_started` (has preview URL)
- `deployment_success` (has Vercel URL)
- `error`, `fatal_error`

**High** (Show prominently):
- `plan_complete`
- `build_success`
- `validation_complete`

**Medium** (Show but don't emphasize):
- `file_created`, `file_updated`
- `install_complete`

**Low** (Show minimally or aggregate):
- `install_progress`
- `server_progress`
- `building`

**Hidden** (Never show in logs):
- `thinking`
- `tool_started`
- `tool_completed`
- `snapshot_saved`
