
# Prompt Enhancement Guardrail

Path: `app/api/ai/enhance-prompt/route.ts`

This document explains the server-side route that normalizes user prompts into a strict, contract-oriented format before the main AI code generation pipeline runs. It enforces deterministic structure, reduces hallucinations, and prepares high‑quality inputs for code generation.


## Summary
- Converts freeform prompts into a strict format with clear rules.
- Multi-provider LLM strategy with graceful fallback: OpenAI → Gemini → Base guardrail.
- Ensures key constraints: `EMPTY CONSTRUCTOR`, `No constructor args.`, well-formed function/event lines.
- Used by the frontend client via `lib/api.ts` (`Api.enhancePrompt(...)`).


## Endpoint
- Method: `POST`
- Route: `/api/ai/enhance-prompt`
- Dynamic: `export const dynamic = 'force-dynamic'` (always dynamic in Next.js App Router)


## Request
Body shape:
```json
{
  "prompt": "string (required)",
  "provider": "openai" | "gemini" (optional),
  "model": "string (optional)"
}
```

- `prompt` is the raw user description (required).
- `provider` optionally pins the LLM provider. If omitted, the route auto-selects based on available keys (OpenAI preferred, then Gemini).
- `model` optionally pins the model for the selected provider.


## Responses
Success:
```json
{
  "ok": true,
  "data": {
    "prompt": "<enhanced_prompt>",
    "provider": "openai | gemini | base",
    "model": "<model-name | guardrail>"
  }
}
```

Failure:
```json
{
  "ok": false,
  "error": { "message": "<reason>" }
}
```

HTTP status codes:
- 200 for success (even if base guardrail fallback is used)
- 400 if the `prompt` is missing/invalid
- 500 for unexpected provider errors


## Provider selection and fallback
The route tries providers in this order, unless `provider` is explicitly specified:
1. OpenAI (if `OPENAI_API_KEY` or `NEXT_OPENAI_API_KEY` exists)
2. Gemini (if `GOOGLE_API_KEY` or `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` exists)
3. Base guardrail (no external call; returns the input `prompt` with metadata `provider: 'base', model: 'guardrail'`)

Default models:
- OpenAI: `gpt-4o-mini` (overridable via `OPENAI_MODEL` or request `model`)
- Gemini: `gemini-1.5-flash` (overridable via `GEMINI_MODEL` or request `model`)


## Output rules and guardrails
These rules are embedded in the `SYSTEM_PROMPT` and shape the enhanced output. Only the “Output rules (MUST)” should appear in the final text; the other sections guide the LLM but should not be echoed.

- Output rules (MUST):
  - Always begin with the contract label in the format: `ContractName:`
  - Always include a constructor line: `EMPTY CONSTRUCTOR. No constructor args.`
  - List functions as `functionName(type param, type param) [modifiers]` (e.g., `onlyOwner`, `payable`)
  - List events clearly, one per line when relevant
  - End the description with: `No constructor args.`
  - Keep the style concise, declarative, consistent with examples
  - If the user prompt is incomplete, infer missing elements in the style of the examples
  - Never add external explanations or prose – final output must be the formatted enhanced prompt only

- Guardrails (ENFORCE IN THE ENHANCED PROMPT; DO NOT OUTPUT THIS SECTION):
  - Decompose behavior into multiple small functions; avoid single mega-functions
  - Avoid name collisions between functions and variables
  - Do not call/mention functions that aren’t declared; add signatures explicitly when needed
  - Use correct ETH semantics: mark receivers as `payable`, use `address payable` when transferring ETH
  - Be explicit with token types (e.g., `IERC20`, `IERC721`); include safety/pull-payment patterns where implied
  - Prefer post-deploy configurability (`setXYZ()`) over constructor params
  - Emit events for all state-changing actions (Created/Updated/Withdrawn/Claimed/etc.)

- Validation checklist (INTERNAL; DO NOT OUTPUT):
  - Each line describes one action (single-responsibility)
  - No identifier reuse
  - No phantom calls (every referenced action appears as a function line)
  - ETH paths have correct `payable` and `address payable`
  - If using OZ patterns, ensure matching signatures; otherwise use custom names


## Template used by the route
The route provides an explicit template in the user message to the LLM to reinforce structure:
```text
Template
ContractLabel: EMPTY CONSTRUCTOR. [optional clarifying note e.g., "Use Ownable, ReentrancyGuard; post-deploy setXYZ()."]
functionOne(type param, type param) [modifiers/conditions].
functionTwo(type param) [modifiers/conditions].
functionThree() payable [if applicable].
[add more single-responsibility functions as needed, not a mega-function].
Events: EventOne(type,type), EventTwo(type,type)[, EventThree(type,...)].
No constructor args.
```


## Normalization step (post-processing)
Function: `normalizeOutput(out: string)`

- Ensures the result contains `EMPTY CONSTRUCTOR` and the closing `No constructor args.` line.
- If missing, it injects them (e.g., after the first label line).
- Trims and returns a clean, minimal string for downstream use.


## How the frontend uses this route
- `lib/api.ts` exposes `Api.enhancePrompt(prompt: string, provider?: 'openai' | 'gemini', model?: string)`.
- This function always calls the local Next.js route `/api/ai/enhance-prompt` (not the remote backend) to keep LLM keys server-side.
- The pipeline page (`app/pipeline/page.tsx`) uses this helper to improve user input before starting the remote pipeline.


## Example: Request/response
Request:
```bash
curl -X POST http://localhost:3000/api/ai/enhance-prompt \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt": "Simple whitelist with add/remove, onlyOwner, and an event for changes",
    "provider": "openai"
  }'
```

Response (example):
```json
{
  "ok": true,
  "data": {
    "prompt": "Whitelist: EMPTY CONSTRUCTOR.\nadd(address user) onlyOwner.\nremove(address user) onlyOwner.\nisWhitelisted(address user) view returns (bool).\nEvents: Added(address), Removed(address).\nNo constructor args.",
    "provider": "openai",
    "model": "gpt-4o-mini"
  }
}
```


## Environment variables
- OpenAI: `OPENAI_API_KEY` or `NEXT_OPENAI_API_KEY` (optional `OPENAI_MODEL`)
- Google/Gemini: `GOOGLE_API_KEY` or `GEMINI_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` (optional `GEMINI_MODEL`)

If no keys exist, the route returns the base prompt with `{ provider: 'base', model: 'guardrail' }`.


## Security notes
- API keys are only used on the server (this Next.js route). They are never exposed to the browser.
- The frontend always calls the local route for guardrailing, then uses the centralized client (`lib/api.ts`) to talk to the remote pipeline backend.


## Error handling
- Returns 400 if `prompt` is missing or invalid.
- Returns 500 if a provider call fails unexpectedly. The route attempts both providers (when available) before failing back to the base guardrail or returning an error.


## Testing checklist
- With OpenAI available: confirm provider=`openai` returns normalized enhanced prompt.
- With Gemini available only: confirm provider=`gemini` returns normalized enhanced prompt.
- With neither available: confirm base guardrail response (provider=`base`).
- Ensure the output always contains `EMPTY CONSTRUCTOR` and ends with `No constructor args.`


## Change log (excerpt)
- 2025‑09‑21
  - Expanded `SYSTEM_PROMPT` with structured sections: Output rules (MUST), Guardrails, Validation checklist.
  - Updated Template with clarifying note and single‑responsibility guidance.

