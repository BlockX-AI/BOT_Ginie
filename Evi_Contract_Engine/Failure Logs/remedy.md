# Remedies for Pipeline Failures

This document summarizes causes and recommended fixes based on `Failure Logs/index.json`, `index.csv`, and `fail.json`, mapped to code paths in `api/routes/ai.js`.

## Constructor arguments mismatch (deploy_prep)

- Cause
  - The provided `constructorArgs` do not match the contract constructor schema (count and/or types).
  - Detected during deploy preparation in `api/routes/ai.js` around lines ~504–528.

- Remedies
  - Server-side validation (recommended):
    - Validate both count and TYPE before failing.
    - For ABI `address`: require valid `0x`-prefixed, checksum-validated addresses.
    - For `uint*`: require finite, non-negative integers.
    - For `bytes32`: require `0x` + 64 hex chars.
    - Improve error message to include `expectedConstructor` (name/type) and `providedConstructorArgs` (truncated), and append to logs via `appendJobLog(...)`.
  - Client-side validation:
    - Add UI checks before starting `/api/ai/pipeline` using a dry-run schema (see below).
    - Inline helpers for checksum/address and number formats.
  - Dry-run compile endpoint:
    - Add `POST /api/ai/dry-run` that runs generate+compile only and returns `{ contractName, abi, expectedConstructor }` to drive UI validation.

## Hardhat provider cannot resolve name (deploy)

- Cause
  - During deploy (lines ~546–569 in `api/routes/ai.js`), ethers attempts to coerce constructor args to ABI types. If an `address` param receives a non-address string, ethers tries name (ENS) resolution, but the Hardhat provider lacks `resolveName`, throwing:
  - `NotImplementedError: Method 'HardhatEthersProvider.resolveName' is not implemented`.

- Remedies
  - Pre-validate `address` params to be valid addresses and reject arbitrary strings.
  - Normalize/validate address format server-side and fail early with a clear message.
  - Ensure dependency alignment between `hardhat`, `@nomicfoundation/hardhat-ethers`, and `ethers` (v6). If name resolution is required, use a provider that supports it; otherwise, block ENS-like inputs.
  - Log the ABI param types and a redacted preview of values before deploy to simplify diagnosis.

## Hardhat compile failed (HH600) during fix loop

- Cause
  - Compile + auto-fix loop (lines ~409–439 in `api/routes/ai.js`) did not converge within `maxIters` (e.g., OpenZeppelin usage, pragma, abstract contracts, or hooks issues).

- Remedies
  - Strengthen prompt constraints in `enhancePipelinePrompt()` (lines ~80–160) to reduce invalid patterns (already includes OZ v4.9.x guidance; tighten wording where needed).
  - Slightly increase `maxIters` or make it adaptive with a safe cap.
  - Surface the last compilation errors in `appendJobLog(...)` and add them to `job.details.lastErrors` for UI display.
  - Keep plugin versions aligned (Hardhat, typechain, ethers) to avoid task override conflicts.

## Observability & UX improvements

- Add concise diagnostic logs for:
  - Expected vs provided constructor schema (truncate long values).
  - ABI types and sanitized values before deploy (with redaction).
- Optional: behind `LOG_PROMPTS=1`, store in `job.prompts` the truncated `sanitizedPrompt`, and lengths of `architected` and `enhancedPrompt` for traceability (do not log full prompts by default).

## Implementation checklist

- [ ] Add server-side constructor arg type validation in `api/routes/ai.js` deploy prep.
- [ ] Add address validation guard before deploy to prevent `resolveName` errors.
- [ ] Create `/api/ai/dry-run` to return ABI and constructor schema for client validation.
- [ ] Tighten `enhancePipelinePrompt()` and optionally increase `maxIters`.
- [ ] Ensure dependency versions are aligned (Hardhat, hardhat-ethers, ethers, typechain if used).
