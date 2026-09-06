# Logger Update: LLM Request/Response Logging

This document describes how to add structured Gemini (LLM) request/response logging to both server logs (Pino) and job SSE logs, while protecting secrets and limiting log volume.

## Objectives
- **Traceability**: Capture model name, prompt/response sizes, latency, retries, and HTTP status codes.
- **Safety**: Never log API keys; truncate long payloads; optionally log prompt/output previews behind flags.
- **SSE visibility**: Emit concise events into job logs so users can watch LLM activity live.

## Environment Flags (.env)
- `LOG_LLM=1` – master switch for LLM logging (default on).
- `LOG_LLM_PROMPTS=0` – log prompt previews (truncated) when set to 1.
- `LOG_LLM_OUTPUTS=0` – log output previews (truncated) when set to 1.
- `LLM_MAX_LOG_CHARS=2000` – max preview length for prompts/outputs.

Optionally reuse existing flags in `api/routes/ai.js`:
- `LOG_AI_PROMPTS=0`
- `LOG_AI_OUTPUTS=0`

## Changes in `api/routes/ai.js`
Integrate logging inside `callGemini()` and at call sites (pipeline/fix flows).

### Helpers (safe truncation)
```js
const LLM_LOG = String(process.env.LOG_LLM || '1') === '1';
const LLM_LOG_PROMPTS = String(process.env.LOG_LLM_PROMPTS || '') === '1' || String(process.env.LOG_AI_PROMPTS || '') === '1';
const LLM_LOG_OUTPUTS = String(process.env.LOG_LLM_OUTPUTS || '') === '1' || String(process.env.LOG_AI_OUTPUTS || '') === '1';
const LLM_MAX_LOG_CHARS = Math.max(256, Number(process.env.LLM_MAX_LOG_CHARS || 2000));

function safeSnippet(s, max = LLM_MAX_LOG_CHARS) {
  if (!s) return '';
  const str = String(s);
  return str.length > max ? str.slice(0, max) + `…[+${str.length - max}]` : str;
}
```

### Inside `callGemini()`
- Log request meta (model, prompt length) before fetch.
- Log response meta (status, latency, response length) on success.
- Log retry/backoff info on non-2xx status.
- Respect preview flags for prompt/output.

```js
const started = Date.now();
const requestId = `llm_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
if (LLM_LOG) {
  logger.info({ scope: 'llm', event: 'request', requestId, model, prompt_len: JSON.stringify(contents || '').length }, 'llm_request');
  if (LLM_LOG_PROMPTS) logger.debug({ scope: 'llm', requestId, prompt_preview: safeSnippet(JSON.stringify(contents)) }, 'llm_prompt_preview');
}

let attempt = 0;
while (true) {
  attempt += 1;
  const t0 = Date.now();
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents }) });
  const ms = Date.now() - t0;

  if (res.ok) {
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    if (LLM_LOG) {
      logger.info({ scope: 'llm', event: 'response', requestId, model, status: res.status, ms, response_len: text.length }, 'llm_response');
      if (LLM_LOG_OUTPUTS) logger.debug({ scope: 'llm', requestId, output_preview: safeSnippet(text) }, 'llm_output_preview');
    }
    return { raw: data, text };
  }

  const bodyText = await res.text().catch(() => '');
  const retryable = res.status >= 500 || [429, 408, 503].includes(res.status);
  logger.warn({ scope: 'llm', event: 'error', requestId, model, status: res.status, ms, body_preview: safeSnippet(bodyText) }, 'llm_error');

  if (!retryable || attempt >= retries) throw new Error(`Gemini API error ${res.status}: ${bodyText}`);
  const delay = Math.min(15000, baseDelayMs * Math.pow(2, attempt - 1));
  logger.info({ scope: 'llm', event: 'retry', requestId, model, attempt, delay }, 'llm_retry');
  await new Promise(r => setTimeout(r, delay));
}
```

### Job SSE integration
At pipeline/fix call sites, emit concise logs via `appendJobLog(job.id, level, msg)`:
- Before request: `llm_request model=... prompt_len=...`
- On success: `llm_response status=... ms=... response_len=...`
- On retry: `llm_retry attempt=... delay=...`
- On error: `llm_error status=...`

Only include previews if `LOG_LLM_PROMPTS/LOG_LLM_OUTPUTS` is enabled (truncated with `safeSnippet`).

## Optional: Persist raw request/response
Behind `LOG_LLM_OUTPUTS=1`, write files per job:
- `tmp/jobs/<jobId>/llm/request.json`
- `tmp/jobs/<jobId>/llm/response.json`

## Pino redaction (server-wide)
Redact sensitive headers and values.
```js
// In api/server.js where logger is created/used
// Example redaction approach if you construct pino directly:
// const logger = pino({ redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], remove: true } });
```

## Rollout Steps
1. Add helpers and logging to `callGemini()` in `api/routes/ai.js`.
2. Emit SSE job logs at pipeline/fix call sites.
3. Introduce `.env` flags and set conservative defaults.
4. (Optional) Enable persistence and sampling once stable.

## Security & Privacy
- Never log API keys or secrets.
- Truncate previews; prefer summaries (lengths, hashes) for very large payloads.
- Avoid logging user-sensitive data unless explicitly allowed and scrubbed.
