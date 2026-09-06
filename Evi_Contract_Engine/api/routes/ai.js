const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
// Use persistent job store (PostgreSQL-backed) for Railway redeployment durability
const jobStore = require('../lib/jobStore');
const { createJob, updateJob, appendJobLog, saveContract, saveDeployment } = jobStore;
const logger = require('../lib/logger');

const PROMPTS_ROOT = process.env.PROMPTS_DIR
  ? path.resolve(process.env.PROMPTS_DIR)
  : path.join(__dirname, '..', 'prompts', 'ai');

const __promptCache = new Map();

function readPromptFile(relPath) {
  const safeRel = String(relPath || '').replace(/^[\\/]+/g, '');
  const full = path.join(PROMPTS_ROOT, safeRel);
  const st = fs.statSync(full);
  const key = full;
  const cached = __promptCache.get(key);
  if (cached && cached.mtimeMs === st.mtimeMs) return cached.text;
  const text = fs.readFileSync(full, 'utf8');
  __promptCache.set(key, { mtimeMs: st.mtimeMs, text });
  return text;
}

function interpolateVars(template, vars) {
  let out = String(template || '');
  const v = vars && typeof vars === 'object' ? vars : {};
  for (const [k, val] of Object.entries(v)) {
    const re = new RegExp(`\\{\\{\\s*${k.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*\\}\\}`, 'g');
    out = out.replace(re, String(val));
  }
  return out;
}

function assemblePrompt(relPaths, vars) {
  const parts = [];
  for (const p of (Array.isArray(relPaths) ? relPaths : [])) {
    const txt = readPromptFile(p);
    parts.push(interpolateVars(txt, vars));
  }
  return parts.join('\n\n');
}

function parseJsonLenient(text) {
  try {
    return JSON.parse(String(text || ''));
  } catch (_) {
    try {
      const cleaned = String(text || '').replace(/```[\s\S]*?```/g, s => s.replace(/```/g, '')).trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1));
      }
    } catch (_) {}
    throw new Error('INVALID_JSON');
  }
}

// Configuration for iterations and logging verbosity
const MAX_ITERS_HARD_CAP = Math.max(1, Number(process.env.MAX_ITERS_HARD_CAP || 12) || 12);
const DEFAULT_FIX_MAX_ITERS = Math.max(1, Number(process.env.FIX_MAX_ITERS || process.env.AI_FIX_MAX_ITERS || 5) || 5);
const DEFAULT_PIPELINE_MAX_ITERS = Math.max(1, Number(process.env.PIPELINE_MAX_ITERS || 5) || 5);
const LOG_AI_PROMPTS = String(process.env.LOG_AI_PROMPTS || '') === '1';
const LOG_AI_OUTPUTS = String(process.env.LOG_AI_OUTPUTS || '') === '1';

// Simple per-network deployment queue to avoid nonce collisions across
// concurrent AI jobs using the same signer/account.
const __aiDeployQueues = new Map();
function enqueueDeployAi(key, task) {
  const prev = __aiDeployQueues.get(key) || Promise.resolve();
  const p = prev.then(() => task());
  __aiDeployQueues.set(key, p.catch(() => {}));
  return p;
}

// Minimal Gemini client using fetch; expects GEMINI_API_KEY in env
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-pro';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

// Determine which LLM provider to use (OpenAI preferred if key is set)
const USE_OPENAI = !!process.env.OPENAI_API_KEY;

async function callGemini({ model = DEFAULT_MODEL, contents, retries = 3, baseDelayMs = 1000 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let attempt = 0;
  while (true) {
    attempt += 1;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      return { raw: data, text };
    }
    const bodyText = await res.text().catch(() => '');
    const retryable = res.status >= 500 || res.status === 429 || res.status === 408 || res.status === 503;
    if (!retryable || attempt > retries) {
      throw new Error(`Gemini API error ${res.status}: ${bodyText}`);
    }
    const delay = Math.min(15000, baseDelayMs * Math.pow(2, attempt - 1));
    await new Promise(r => setTimeout(r, delay));
  }
}

// OpenAI GPT-4 client using fetch; expects OPENAI_API_KEY in env
async function callOpenAI({ model = OPENAI_MODEL, contents, retries = 3, baseDelayMs = 1000 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  
  // Convert Gemini contents format to OpenAI messages format
  const messages = contents.map(c => ({
    role: c.role === 'model' ? 'assistant' : (c.role || 'user'),
    content: (c.parts || []).map(p => p.text || '').join('')
  }));

  let attempt = 0;
  while (true) {
    attempt += 1;
    const res = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 4096
      })
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content || '';
      return { raw: data, text };
    }
    const bodyText = await res.text().catch(() => '');
    const retryable = res.status >= 500 || res.status === 429 || res.status === 408 || res.status === 503;
    if (!retryable || attempt > retries) {
      throw new Error(`OpenAI API error ${res.status}: ${bodyText}`);
    }
    const delay = Math.min(15000, baseDelayMs * Math.pow(2, attempt - 1));
    await new Promise(r => setTimeout(r, delay));
  }
}

// Unified LLM caller — routes to OpenAI GPT-4 if OPENAI_API_KEY is set, else Gemini
async function callLLM({ model, contents, retries = 3, baseDelayMs = 1000 }) {
  if (USE_OPENAI) {
    return callOpenAI({ model: OPENAI_MODEL, contents, retries, baseDelayMs });
  }
  return callGemini({ model: model || DEFAULT_MODEL, contents, retries, baseDelayMs });
}

function extractFirstCodeBlock(md) {
  const match = md.match(/```(solidity|javascript|js|ts|json)?\n([\s\S]*?)```/i);
  if (!match) return null;
  return { language: (match[1] || '').toLowerCase(), code: match[2] };
}

// Game Type Classification (from orchestrator/00_game_type_classifier.md)
function classifyGame(gameIdea) {
  const text = gameIdea.toLowerCase();
  const words = text.split(/\s+/);
  
  // Score each game type - expanded keywords for better recognition
  const scores = {
    PUZZLE: countMatches(words, ['grid', 'tiles', 'match', 'combine', 'merge', 'solve', 'clear', 'pattern', 'swap', 'cascade', 'tetris', 'blocks', '2048', 'sudoku', 'puzzle', 'sliding', 'connect', 'candy', 'bejeweled']),
    RUNNER: countMatches(words, ['run', 'runs', 'running', 'runner', 'jump', 'dodge', 'dodges', 'distance', 'obstacles', 'speed', 'endless', 'survive', 'platform', 'arcade', 'flappy', 'dino', 'subway', 'temple', 'score', 'highscore', 'high-score', 'leaderboard', 'coins', 'collect', 'energy', 'cooldown', 'submit']),
    PVP_TURN: countMatches(words, ['versus', 'turns', 'turn', 'opponent', 'strategy', 'compete', 'battle', 'chess', 'cards', 'tactics', 'board', 'players', 'player', 'win', 'winner', 'draw', 'tic', 'tac', 'toe', 'tictactoe', 'checkers', 'connect4', 'othello', 'reversi', 'gomoku', 'move', 'moves', '3x3', 'two', 'pvp', 'duel', 'match']),
    PVP_REALTIME: countMatches(words, ['race', 'fight', 'shoot', 'realtime', 'real-time', 'simultaneous', 'reaction', 'racing', 'fighting', 'fps', 'multiplayer', 'pvp', 'arena', 'duel']),
    IDLE: countMatches(words, ['idle', 'incremental', 'passive', 'upgrade', 'click', 'clicker', 'accumulate', 'farm', 'generator', 'offline', 'progress', 'prestige', 'tap']),
    RPG: countMatches(words, ['quest', 'character', 'level', 'stats', 'adventure', 'dungeon', 'loot', 'rpg', 'experience', 'skill', 'hero', 'monster', 'inventory', 'equipment']),
    BETTING: countMatches(words, ['bet', 'betting', 'wager', 'gamble', 'casino', 'dice', 'flip', 'lottery', 'raffle', 'prediction', 'odds', 'jackpot', 'slot', 'roulette', 'poker'])
  };
  
  // Select highest scoring type
  const gameType = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
  
  // Detect secondary mechanics
  const secondaryMechanics = [];
  if (hasKeywords(words, ['token', 'coin', 'currency', 'reward', 'earn'])) secondaryMechanics.push('economy_tokens');
  if (hasKeywords(words, ['nft', 'collectible', 'unique', 'character', 'item'])) secondaryMechanics.push('economy_nft');
  if (hasKeywords(words, ['guild', 'team', 'clan', 'alliance', 'group'])) secondaryMechanics.push('social_guilds');
  if (hasKeywords(words, ['pvp', 'versus', 'compete', 'battle', 'fight'])) secondaryMechanics.push('social_pvp');
  if (hasKeywords(words, ['level', 'unlock', 'progress', 'advance'])) secondaryMechanics.push('progression_linear');
  if (hasKeywords(words, ['skill', 'tree', 'branch', 'talent', 'ability'])) secondaryMechanics.push('progression_tree');
  if (hasKeywords(words, ['random', 'chance', 'luck', 'rng', 'fair'])) secondaryMechanics.push('randomness_vrf');
  if (hasKeywords(words, ['leaderboard', 'ranking', 'top', 'best', 'high', 'score'])) secondaryMechanics.push('leaderboard_global');
  if (hasKeywords(words, ['season', 'tournament', 'event', 'limited', 'time'])) secondaryMechanics.push('leaderboard_seasonal');
  if (hasKeywords(words, ['energy', 'stamina', 'cooldown', 'recharge', 'limit'])) secondaryMechanics.push('energy_system');
  if (hasKeywords(words, ['matchmaking', 'queue', 'pair', 'find', 'opponent', 'rating'])) secondaryMechanics.push('matchmaking');
  
  // Determine complexity
  let contractComplexity = 'simple';
  if (secondaryMechanics.length > 3) contractComplexity = 'complex';
  else if (gameType.includes('PVP') || gameType === 'RPG') contractComplexity = 'medium';
  
  // Determine gas profile
  const gasProfile = {
    'PUZZLE': 'medium',
    'RUNNER': 'low', 
    'PVP_TURN': 'high',
    'PVP_REALTIME': 'medium',
    'IDLE': 'low',
    'RPG': 'high',
    'BETTING': 'medium'
  }[gameType];
  
  // Determine anti-cheat level
  const antiCheatLevel = {
    'PUZZLE': 'standard',
    'RUNNER': 'advanced',
    'PVP_TURN': 'advanced', 
    'PVP_REALTIME': 'advanced',
    'IDLE': 'basic',
    'RPG': 'standard',
    'BETTING': 'advanced'
  }[gameType];
  
  // Calculate confidence as ratio of top score to total scores (how dominant is the classification)
  const maxScore = Math.max(...Object.values(scores));
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? (maxScore / totalScore) * 100 : 0;
  
  return {
    gameType,
    promptSuite: gameType.toLowerCase() + '_complete',
    secondaryMechanics,
    contractComplexity,
    gasProfile,
    antiCheatLevel,
    confidence,
    // Legacy compatibility
    game: true,
    compliance: /(compliance|verification|attest|attestation|artifact|oscal|registry|auditor|submitter)/.test(text)
  };
}

function countMatches(words, keywords) {
  return keywords.reduce((count, keyword) => {
    return count + words.filter(word => word.includes(keyword)).length;
  }, 0);
}

function hasKeywords(words, keywords) {
  return keywords.some(keyword => words.some(word => word.includes(keyword)));
}

// Legacy function for backward compatibility
function detectDomainsFromText(text) {
  const classification = classifyGame(text);
  return {
    compliance: classification.compliance,
    game: classification.game,
    gameType: classification.gameType?.toLowerCase(),
    mechanics: {
      energy: classification.secondaryMechanics.includes('energy_system'),
      matchmaking: classification.secondaryMechanics.includes('matchmaking'),
      progression: classification.secondaryMechanics.includes('progression_linear') || classification.secondaryMechanics.includes('progression_tree'),
      economy: classification.secondaryMechanics.includes('economy_tokens') || classification.secondaryMechanics.includes('economy_nft'),
      randomness: classification.secondaryMechanics.includes('randomness_vrf'),
      leaderboard: classification.secondaryMechanics.includes('leaderboard_global') || classification.secondaryMechanics.includes('leaderboard_seasonal')
    }
  };
}

// Prompt Suite Registry (from orchestrator/01_prompt_suite_registry.md)
// Updated with gas optimization, security, and non-custodial fund handling prompts
const PROMPT_SUITES = {
  puzzle_complete: [
    'shared/00_style.md',
    'shared/01_safety_and_integrity.md',
    'contracts/00_base_generate.md',
    'contracts/gas/modern_solidity.md',
    'contracts/security/non_custodial.md',
    'contracts/security/reentrancy_guards.md',
    'domains/games/puzzle/physics.md',
    'domains/games/puzzle/reference.md',
    'contracts/primitives/bounded_state.md',
    'contracts/verification/client_authority_budget.md',
    'contracts/gas/bitmap_techniques.md',
    'contracts/acceptance/gas_benchmarks.md',
    'contracts/acceptance/state_bounds.md'
  ],
  
  runner_complete: [
    'shared/00_style.md',
    'shared/01_safety_and_integrity.md',
    'contracts/00_base_generate.md',
    'contracts/gas/modern_solidity.md',
    'contracts/security/non_custodial.md',
    'contracts/security/reentrancy_guards.md',
    'contracts/operations/rate_limiting.md',
    'domains/games/security/anti_cheat.md',
    'domains/games/mechanics/session_finality.md',
    'domains/games/runner/physics.md',
    'domains/games/runner/reference.md',
    'contracts/verification/server_verification.md',
    'contracts/verification/replay_prevention.md',
    'contracts/acceptance/gas_benchmarks.md',
    'contracts/acceptance/edge_cases.md'
  ],
  
  pvp_turn_complete: [
    'shared/00_style.md',
    'shared/01_safety_and_integrity.md',
    'contracts/00_base_generate.md',
    'contracts/gas/modern_solidity.md',
    'contracts/security/non_custodial.md',
    'contracts/security/reentrancy_guards.md',
    'contracts/security/access_control.md',
    'contracts/operations/treasury_management.md',
    'domains/games/security/anti_cheat.md',
    'domains/games/mechanics/incentive_alignment.md',
    'domains/games/mechanics/griefing_resistance.md',
    'domains/games/pvp/physics.md',
    'domains/games/pvp/reference.md',
    'contracts/primitives/pvp_matchmaking.md',
    'contracts/verification/deterministic_randomness.md',
    'contracts/verification/replay_prevention.md',
    'contracts/acceptance/gas_benchmarks.md',
    'contracts/acceptance/state_bounds.md'
  ],
  
  pvp_realtime_complete: [
    'shared/00_style.md',
    'shared/01_safety_and_integrity.md',
    'contracts/00_base_generate.md',
    'contracts/gas/modern_solidity.md',
    'contracts/security/non_custodial.md',
    'contracts/security/reentrancy_guards.md',
    'domains/games/mechanics/session_finality.md',
    'domains/games/pvp/physics.md',
    'domains/games/pvp/reference.md',
    'contracts/primitives/checkpoint_state.md',
    'contracts/verification/server_verification.md',
    'contracts/acceptance/gas_benchmarks.md',
    'contracts/acceptance/edge_cases.md'
  ],
  
  idle_complete: [
    'shared/00_style.md',
    'shared/01_safety_and_integrity.md',
    'contracts/00_base_generate.md',
    'contracts/gas/modern_solidity.md',
    'contracts/security/non_custodial.md',
    'contracts/security/reentrancy_guards.md',
    'domains/games/mechanics/reward_curves.md',
    'domains/games/idle/physics.md',
    'domains/games/idle/reference.md',
    'contracts/primitives/energy_system.md',
    'contracts/primitives/economic_sinks.md',
    'contracts/gas/batch_operations.md',
    'contracts/acceptance/gas_benchmarks.md',
    'contracts/acceptance/state_bounds.md'
  ],
  
  rpg_complete: [
    'shared/00_style.md',
    'shared/01_safety_and_integrity.md',
    'contracts/00_base_generate.md',
    'contracts/gas/modern_solidity.md',
    'contracts/security/non_custodial.md',
    'contracts/security/reentrancy_guards.md',
    'domains/games/mechanics/reward_curves.md',
    'contracts/primitives/progression_trees.md',
    'contracts/verification/deterministic_randomness.md',
    'contracts/acceptance/gas_benchmarks.md',
    'contracts/acceptance/state_bounds.md',
    'contracts/acceptance/edge_cases.md'
  ],
  
  betting_complete: [
    'shared/00_style.md',
    'shared/01_safety_and_integrity.md',
    'contracts/00_base_generate.md',
    'contracts/gas/modern_solidity.md',
    'contracts/security/non_custodial.md',
    'contracts/security/reentrancy_guards.md',
    'contracts/security/access_control.md',
    'contracts/security/flash_loan_guards.md',
    'contracts/operations/treasury_management.md',
    'contracts/operations/rate_limiting.md',
    'contracts/verification/deterministic_randomness.md',
    'contracts/primitives/economic_sinks.md',
    'contracts/acceptance/gas_benchmarks.md',
    'contracts/acceptance/edge_cases.md'
  ]
};

const SECONDARY_MECHANICS_PROMPTS = {
  economy_tokens: ['contracts/primitives/economic_sinks.md', 'domains/games/mechanics/reward_curves.md'],
  economy_nft: ['contracts/primitives/progression_trees.md'],
  social_guilds: ['contracts/primitives/pvp_matchmaking.md'],
  social_pvp: ['domains/games/mechanics/griefing_resistance.md', 'contracts/verification/replay_prevention.md', 'domains/games/security/anti_cheat.md'],
  progression_linear: ['contracts/primitives/progression_trees.md'],
  progression_tree: ['contracts/primitives/progression_trees.md'],
  randomness_vrf: ['contracts/verification/deterministic_randomness.md', 'contracts/security/chainlink_vrf.md'],
  leaderboard_global: ['contracts/acceptance/state_bounds.md'],
  leaderboard_seasonal: ['domains/games/mechanics/session_finality.md'],
  energy_system: ['contracts/primitives/energy_system.md'],
  matchmaking: ['contracts/primitives/pvp_matchmaking.md', 'domains/games/security/anti_cheat.md'],
  // New security-focused mechanics
  staking: ['contracts/security/flash_loan_guards.md', 'contracts/operations/treasury_management.md'],
  betting: ['contracts/operations/treasury_management.md', 'contracts/operations/rate_limiting.md', 'contracts/security/chainlink_vrf.md'],
  treasury: ['contracts/operations/treasury_management.md', 'contracts/operations/emergency_controls.md'],
  access_control: ['contracts/security/access_control.md', 'contracts/operations/emergency_controls.md']
};

function loadPromptSuite(classification) {
  const basePrompts = PROMPT_SUITES[classification.promptSuite] || [];
  const secondaryPrompts = [];
  
  // Add secondary mechanic prompts
  for (const mechanic of classification.secondaryMechanics || []) {
    const mechanicPrompts = SECONDARY_MECHANICS_PROMPTS[mechanic] || [];
    for (const prompt of mechanicPrompts) {
      if (!basePrompts.includes(prompt) && !secondaryPrompts.includes(prompt)) {
        secondaryPrompts.push(prompt);
      }
    }
  }
  
  return {
    prompts: [...basePrompts, ...secondaryPrompts],
    gameType: classification.gameType,
    complexity: classification.contractComplexity,
    gasProfile: classification.gasProfile,
    antiCheatLevel: classification.antiCheatLevel,
    confidence: classification.confidence
  };
}

// Legacy function for backward compatibility
function assembleGamePrompts(domains) {
  if (!domains.game) return [];
  
  // Convert legacy format to new classification format
  const legacyClassification = {
    gameType: domains.gameType?.toUpperCase() || 'PUZZLE',
    promptSuite: (domains.gameType || 'puzzle') + '_complete',
    secondaryMechanics: [],
    contractComplexity: 'medium',
    gasProfile: 'medium',
    antiCheatLevel: 'standard',
    confidence: 50
  };
  
  // Map legacy mechanics to secondary mechanics
  const m = domains.mechanics || {};
  if (m.energy) legacyClassification.secondaryMechanics.push('energy_system');
  if (m.matchmaking) legacyClassification.secondaryMechanics.push('matchmaking');
  if (m.progression) legacyClassification.secondaryMechanics.push('progression_linear');
  if (m.economy) legacyClassification.secondaryMechanics.push('economy_tokens');
  if (m.randomness) legacyClassification.secondaryMechanics.push('randomness_vrf');
  if (m.leaderboard) legacyClassification.secondaryMechanics.push('leaderboard_global');
  
  const promptSuite = loadPromptSuite(legacyClassification);
  return promptSuite.prompts;
}

// Safe prompt assembly that skips missing files
function safeAssemblePrompt(relPaths, vars) {
  const parts = [];
  for (const p of (Array.isArray(relPaths) ? relPaths : [])) {
    try {
      const txt = readPromptFile(p);
      parts.push(interpolateVars(txt, vars));
    } catch (e) {
      // Skip missing files silently
    }
  }
  return parts.join('\n\n');
}

// Heuristic sanitizer to remove non-Solidity tails and ensure the file starts at pragma
function sanitizeSolidity(input) {
  try {
    let code = String(input || '');
    // Strip stray Markdown fences just in case
    code = code.replace(/```/g, '');
    // Ensure we start from the first pragma solidity occurrence
    const pIdx = code.toLowerCase().indexOf('pragma solidity');
    if (pIdx !== -1) code = code.slice(pIdx);
    // Cut off anything after the last closing brace to drop trailing notes/comments
    const lastBrace = code.lastIndexOf('}');
    if (lastBrace !== -1) code = code.slice(0, lastBrace + 1);
    return injectBannerSolidity((code || '').trim() + '\n');
  } catch (_) {
    return injectBannerSolidity(String(input || ''));
  }
}

// Ensure banner comment is present in Solidity sources (idempotent)
function injectBannerSolidity(src) {
  try {
    const banner = [
      '/**',
      ' * This game contract is deployed and made by Ginie',
      ' * https://ginie.xyz',
      ' */',
      ''
    ].join('\n');
    let code = String(src || '');
    if (code.includes('This game contract is deployed and made by Ginie')) return code;
    // Preserve SPDX header at very top if present; insert banner after it
    const spdx = code.match(/^\s*\/\/\s*SPDX-License-Identifier:[^\n]*\n/);
    if (spdx) {
      const head = spdx[0];
      const rest = code.slice(head.length);
      return head + banner + rest;
    }
    // Otherwise, prepend banner before pragma (comments are allowed before pragma)
    return banner + code;
  } catch (_) {
    return String(src || '');
  }
}

// Optional: use Gemini to architect a richer prompt from the raw user request
async function maybeAugmentPromptWithGemini(raw) {
  try {
    if (String(process.env.ENABLE_GEMINI_PROMPT_AUGMENT) !== '1') return raw;
    const model = process.env.GEMINI_PROMPT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-pro';
    const architect = [
      'You are a Prompt Architect for gas-efficient, secure Solidity smart-contract generation.',
      'Transform the user request into a single, high-quality prompt that yields compiler-safe, OpenZeppelin v4.9.x compatible code (solc ^0.8.20).',
      'Output plain text only (no code). Include:',
      '- Clear Task title',
      '- Data model and fields (with storage packing considerations)',
      '- Roles & permissions (AccessControl/Ownable as relevant)',
      '- Core functions, events, and custom errors',
      '- GAS OPTIMIZATION: unchecked loops, calldata params, immutable/constant, packed storage, cached reads',
      '- NON-CUSTODIAL FUNDS: pull-over-push pattern, pendingWithdrawals mapping, user-initiated withdraw()',
      '- SECURITY: ReentrancyGuard, CEI pattern, input validation, no tx.origin',
      '- Constraints: no override of non-virtual modifiers; no Pausable in override lists; empty constructor only',
      'End with: Return ONLY Solidity code inside a single triple-backticked block.'
    ].join('\n');
    const { text } = await callLLM({
      model,
      retries: 11,
      baseDelayMs: 800,
      contents: [
        { role: 'user', parts: [{ text: architect + '\n\nRequest: ' + String(raw || '') }] }
      ]
    });
    const out = (text || '').trim();
    // Heuristic: only accept if non-empty and meaningfully longer than raw
    if (out && out.length > Math.max(120, String(raw || '').length)) return out;
    return raw;
  } catch (e) {
    try { logger.warn({ err: e }, 'prompt_augment_gemini_failed'); } catch (_) {}
    return raw;
  }
}

// Secondary layer: enhance prompts for the pipeline
function enhancePipelinePrompt(prompt, { contractName, filename, network } = {}) {
  // Further cleanse risky shells and formatting that could leak into Solidity
  let p = String(prompt || '');
  // remove simple $VAR patterns
  p = p.replace(/\$[A-Za-z_][A-Za-z0-9_]*/g, '');
  // strip backticks and code fences
  p = p.replace(/```[\s\S]*?```/g, ' ').replace(/[`]/g, '');
  // normalize whitespace
  p = p.replace(/[\u2018\u2019\u201C\u201D]/g, '"').replace(/[\n\r\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  const reqs = [
    // === COMPILER & COMPATIBILITY ===
    'Target solc ^0.8.20 only (use latest features like custom errors).',
    'Prefer OpenZeppelin v4.9.x APIs where applicable.',
    'At least one contract must be concrete (deployable), not abstract.',
    'CRITICAL: Constructor MUST be empty with NO parameters - constructor() { ... } only.',
    'For ERC20/ERC721/ERC1155: Hard-code NAME, SYMBOL, DECIMALS, and initial supply directly in constructor body.',
    
    // === GAS OPTIMIZATION (CRITICAL) ===
    'GAS: Use `unchecked { ++i; }` for ALL loop counters where overflow is impossible.',
    'GAS: Use `calldata` instead of `memory` for read-only array/struct function parameters.',
    'GAS: Use custom errors instead of require strings: `error MyError(); if(cond) revert MyError();`',
    'GAS: Use `immutable` for values set once in constructor and never changed.',
    'GAS: Use `constant` for compile-time known values.',
    'GAS: Pack storage variables - group uint8/uint16/bool/address in same 32-byte slot.',
    'GAS: Cache storage reads in local variables before multiple uses.',
    'GAS: Prefer mappings over arrays for large collections.',
    'GAS: Use `delete` to clear storage and get gas refund.',
    'GAS: Name return values to avoid extra local variables.',
    
    // === NON-CUSTODIAL FUND HANDLING (CRITICAL) ===
    'FUNDS: Use PULL-OVER-PUSH pattern - credit balances, let users withdraw themselves.',
    'FUNDS: NEVER push funds to multiple users in one transaction (can fail and block all).',
    'FUNDS: Store pending withdrawals in mapping, users call withdraw() to claim.',
    'FUNDS: For games with stakes/rewards, isolate each user/match funds separately.',
    
    // === SECURITY (CRITICAL) ===
    'SECURITY: Import and use ReentrancyGuard for ALL functions with ETH/token transfers.',
    'SECURITY: Follow Checks-Effects-Interactions (CEI) pattern: validate → update state → external calls.',
    'SECURITY: Use SafeERC20 for token transfers.',
    'SECURITY: NEVER use tx.origin for authorization - always use msg.sender.',
    'SECURITY: Validate ALL inputs: non-zero addresses, array bounds, valid ranges.',
    'SECURITY: Always check return values of low-level calls: (bool success,) = addr.call{value: x}("");',
    
    // === CODE QUALITY ===
    'QUALITY: Add NatSpec documentation: @title, @notice, @param, @return for public functions.',
    'QUALITY: Use explicit visibility (public/private/internal) for ALL state variables.',
    'QUALITY: Order: errors → events → state → constructor → external → public → internal → private.',
    'QUALITY: Add SPDX-License-Identifier: MIT at the top.',
    
    // === OPERATIONS (CRITICAL) ===
    'OPS: Add `receive() external payable {}` for treasury funding in betting/staking games.',
    'OPS: Add MAX_BET limit (e.g., 1% of treasury) to prevent single-bet drain.',
    'OPS: For betting games, add warning comment that block.prevrandao is insecure for high-stakes.',
    'OPS: Emit events for suspicious activity and treasury threshold warnings.',
    'OPS: Add rate limiting: cooldown between actions (10s minimum).',
    
    // === ANTI-CHEAT ===
    'ANTICHEAT: Use commit-reveal pattern for player choices that could be front-run.',
    'ANTICHEAT: For games with stakes, consider minimum holding periods.',
    'ANTICHEAT: Server-signed score verification for off-chain games (runners, puzzles).',
    
    // === EXISTING RULES ===
    'Do NOT override non-virtual modifiers (e.g., whenNotPaused/whenPaused).',
    'Do NOT include Pausable in override lists.',
    'For ERC tokens, use _beforeTokenTransfer hooks (not _update/_afterTokenTransfer).',
    'Only mark functions as override when actually overriding a virtual base function.',
    'Return ONLY Solidity code inside a single triple-backticked block.',
  ];
  

  if (contractName && typeof contractName === 'string' && contractName.trim()) {
    reqs.unshift(`Name the primary deployable contract exactly: ${contractName.trim()}.`);
  }
  if (filename && typeof filename === 'string' && filename.trim()) {
    reqs.push(`Ensure the code fits a single file compatible with ${filename.trim()} (no multi-file deps beyond OZ).`);
  }
  if (network && typeof network === 'string' && network.trim()) {
    reqs.push(`Generated code must be generic EVM and deployable on network: ${network.trim()}.`);
  }

  const enhanced = [
    'Request:',
    p,
    '',
    'Additional pipeline requirements:',
    '- ' + reqs.join('\n- ')
  ].join('\n');

  return enhanced;
}

module.exports = () => {
  const router = express.Router();

  /**
   * @swagger
   * tags:
   *   - name: AI
   *     description: AI-powered code generation, fixing, compilation, and deployment
   */

  // POST /api/ai/generate
  // body: { prompt: string, model?: string }
  /**
   * @swagger
   * /api/ai/generate:
   *   post:
   *     tags: [AI]
   *     summary: Generate Solidity code from a natural language prompt using the configured LLM
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               prompt:
   *                 type: string
   *                 description: Natural language instructions for the contract to generate
   *               model:
   *                 type: string
   *                 description: Optional model name override
   *     responses:
   *       200:
   *         description: Generated output including text and the first code block if present
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ok: { type: boolean }
   *                 text: { type: string }
   *                 codeBlock:
   *                   type: object
   *                   properties:
   *                     language: { type: string }
   *                     code: { type: string }
   *       400:
   *         description: Missing prompt
   *       500:
   *         description: Internal error or upstream LLM error
   */
  router.post('/generate', async (req, res) => {
    try {
      const { prompt = '', model } = req.body || {};
      if (!prompt.trim()) return res.status(400).json({ ok: false, error: 'PROMPT_REQUIRED' });
      const system = `You are an expert Solidity engineer specialized in gas-efficient, secure smart contracts.

COMPILER: Use solc ^0.8.20, OpenZeppelin v4.9.x APIs.

GAS OPTIMIZATION (MANDATORY):
- Use \`unchecked { ++i; }\` for loop counters
- Use \`calldata\` instead of \`memory\` for read-only params
- Use custom errors: \`error MyError(); revert MyError();\`
- Use \`immutable\` for constructor-set values, \`constant\` for compile-time values
- Pack storage: group uint8/bool/address in same 32-byte slot
- Cache storage reads in local variables

NON-CUSTODIAL FUNDS (MANDATORY):
- Use PULL-OVER-PUSH: credit balances, let users withdraw()
- NEVER push funds to multiple users in loops
- Isolate funds per user/match

SECURITY (MANDATORY):
- Use ReentrancyGuard for functions with ETH/token transfers
- Follow CEI pattern: Checks → Effects → Interactions
- Validate all inputs, never use tx.origin

CONSTRAINTS:
- Do NOT override non-virtual modifiers (whenNotPaused/whenPaused)
- Do NOT include Pausable in override lists
- Constructor MUST be empty (no parameters)
- Add NatSpec documentation

Return code inside triple backticks with solidity language tag.`;
      const { text, raw } = await callLLM({
        model,
        retries: 11,
        baseDelayMs: 1500,
        contents: [
          { role: 'user', parts: [{ text: system + '\n\nRequest: ' + prompt }] }
        ]
      });
      const block = extractFirstCodeBlock(text);
      return res.json({ ok: true, text, codeBlock: block, raw });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/ai/fix
  // body: {
  //   code: string,
  //   errors?: string,
  //   context?: string,
  //   model?: string,
  //   network?: string,            // target network to deploy to (defaults like pipeline)
  //   filename?: string,           // optional filename hint
  //   constructorArgs?: any[],     // args for deployment
  //   contractName?: string        // optional explicit contract to deploy (no mocks by default)
  // }
  // Behavior: launches a background job that attempts to fix the provided Solidity,
  // compiles in an isolated sandbox with iterative AI fixes (same logic as pipeline),
  // and if compilation succeeds, deploys to the requested network. Poll /api/job/:id/status and /api/job/:id/logs
  /**
   * @swagger
   * /api/ai/fix:
   *   post:
   *     tags: [AI]
   *     summary: Fix provided Solidity code via AI, compile, and deploy on a target network
   *     description: Launches a background job. Poll job status and logs to follow progress.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               code: { type: string }
   *               errors: { type: string }
   *               context: { type: string }
   *               model: { type: string }
   *               network: { type: string, example: "basecamp-testnet" }
   *               filename: { type: string, example: "AIFix.sol" }
   *               constructorArgs: { type: array, items: { type: string } }
   *               contractName: { type: string }
   *               maxIters: { type: integer, minimum: 1 }
   *     responses:
   *       202:
   *         description: Job accepted; use the returned id to poll status and logs
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ok: { type: boolean }
   *                 job:
   *                   type: object
   *                   properties:
   *                     id: { type: string }
   *                     type: { type: string }
   *                     payload: { type: object }
   *       400:
   *         description: Missing code
   *       500:
   *         description: Internal error
   */
  router.post('/fix', async (req, res) => {
    try {
      const {
        code: initialCode = '',
        errors: initialErrors = '',
        context = '',
        model,
        network = 'basecamp',
        filename = 'AIFix.sol',
        constructorArgs = [],
        contractName: requestedContractName = '',
        maxIters: reqMaxIters
      } = req.body || {};

      if (!initialCode.trim()) return res.status(400).json({ ok: false, error: 'CODE_REQUIRED' });
      // Normalize maxIters with env defaults and hard cap
      const parsed = Number(reqMaxIters);
      const requestedIters = (Number.isFinite(parsed) && parsed > 0) ? Math.floor(parsed) : DEFAULT_FIX_MAX_ITERS;
      const chosenMaxIters = Math.max(1, Math.min(MAX_ITERS_HARD_CAP, requestedIters));

      // Use the same job ID prefix/pattern as the pipeline by setting the job type to 'ai_pipeline'.
      // Add a discriminator in payload so consumers can still identify this as a fix job.
      const job = await createJob('ai_pipeline', { network, filename, constructorArgs, jobKind: 'fix', maxIters: chosenMaxIters });
      updateJob(job.id, { state: 'running', progress: 5, step: 'init' });
      appendJobLog(job.id, 'info', `Fix job started. Network=${network}, file=${filename}`);
      appendJobLog(job.id, 'debug', `config: maxIters=${chosenMaxIters} (hardCap=${MAX_ITERS_HARD_CAP})`);
      res.status(202).json({ ok: true, job });

      // Background processing
      setImmediate(async () => {
        const projectRoot = path.join(__dirname, '..', '..');
        const sandboxDir = path.join(projectRoot, 'tmp', 'jobs', job.id);
        const sandboxContractsDir = path.join(sandboxDir, 'contracts');
        const sandboxScriptsDir = path.join(sandboxDir, 'scripts');
        const sandboxConfigPath = path.join(sandboxDir, 'hardhat.config.js');
        try {
          // 1) Prepare sandbox and write initial code
          updateJob(job.id, { progress: 15, step: 'write' });
          if (!fs.existsSync(sandboxContractsDir)) fs.mkdirSync(sandboxContractsDir, { recursive: true });
          if (!fs.existsSync(sandboxScriptsDir)) fs.mkdirSync(sandboxScriptsDir, { recursive: true });

          // Isolated Hardhat config that imports networks from root
          const sandboxConfig = `require("@nomicfoundation/hardhat-toolbox");\nrequire("dotenv").config();\nconst path = require('path');\n\nlet rootNetworks = {};\ntry {\n  const rootCfg = require(path.join(__dirname, '..', '..', '..', 'hardhat.config.js'));\n  if (rootCfg && rootCfg.networks) rootNetworks = rootCfg.networks;\n} catch (e) { rootNetworks = {}; }\n\nmodule.exports = {\n  solidity: {\n    compilers: [\n      { version: "0.8.19", settings: { optimizer: { enabled: true, runs: 200 } } },\n      { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 200 } } },\n    ],\n  },\n  networks: { hardhat: {}, ...rootNetworks },\n  paths: {\n    sources: path.join(__dirname, 'contracts'),\n    tests: path.join(__dirname, 'test'),\n    cache: path.join(__dirname, 'cache'),\n    artifacts: path.join(__dirname, 'artifacts'),\n  },\n};\n`;
          fs.mkdirSync(sandboxDir, { recursive: true });
          fs.writeFileSync(sandboxConfigPath, sandboxConfig, 'utf8');

          const base = path.basename(filename).replace(/[^A-Za-z0-9_.-]/g, '');
          const unique = `AI_${job.id}_${base.endsWith('.sol') ? base : base + '.sol'}`;
          const filePath = path.join(sandboxContractsDir, unique);

          let code = sanitizeSolidity(String(initialCode));
          fs.writeFileSync(filePath, code, 'utf8');

          const compileOnce = () => new Promise((resolve) => {
            const args = ['hardhat', 'compile', '--config', sandboxConfigPath];
            const child = spawn('npx', args, { cwd: sandboxDir, env: { ...process.env }, shell: true });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (d) => { const s = d.toString(); stdout += s; appendJobLog(job.id, 'info', s); });
            child.stderr.on('data', (d) => { const s = d.toString(); stderr += s; appendJobLog(job.id, 'error', s); });
            child.on('error', (err) => { const s = `spawn error: ${err.message}`; stderr += `\n${s}`; appendJobLog(job.id, 'error', s); });
            child.on('close', (code) => {
              const ok = code === 0;
              resolve({ ok, stdout, stderr, error: ok ? null : new Error(`exit ${code}`) });
            });
          });

          // 2) Compile + AI fix loop (seed with provided errors/context if any)
          updateJob(job.id, { progress: 25, step: 'compile' });
          appendJobLog(job.id, 'info', 'Starting compile/fix loop');
          let it = 0; const maxIters = chosenMaxIters; let compiled = null; let lastErrors = initialErrors || '';
          while (it < maxIters) {
            const t0c = Date.now();
            compiled = await compileOnce();
            const compileMs = Date.now() - t0c;
            appendJobLog(job.id, 'debug', `iter ${it + 1}/${maxIters}: compile ${compiled.ok ? 'ok' : 'failed'} in ${compileMs}ms`);
            if (compiled.ok) break;
            lastErrors = ((compiled.stderr || '') + '\n' + (compiled.stdout || '') + (lastErrors ? ('\nSeed errors:\n' + lastErrors) : '')).trim();
            updateJob(job.id, { progress: 25 + Math.min(20, it * 5), step: 'fix', lastErrors });
            appendJobLog(job.id, 'warn', `Compile failed (iter ${it}). Running AI fix. Error length=${lastErrors.length}`);
            const instruction = `You are a Solidity fixer bot. Given the code and compiler errors, produce a corrected version that compiles with OpenZeppelin v4.9.x and solc ^0.8.19/^0.8.20.
Rules:
- Do NOT override non-virtual modifiers (e.g., whenNotPaused/whenPaused).
- Do NOT include Pausable in override lists anywhere.
- For ERC20/721/1155, use _beforeTokenTransfer hooks (not _update/_afterTokenTransfer) compatible with OZ v4.x.
- Only mark functions as override when actually overriding a virtual function from a base contract/interface.
- Keep pragmas and imports consistent and minimal.
Output only the corrected code in a single code block.`;
            const prompt = `${instruction}\n\nContext:\n${context}\n\nErrors:\n${lastErrors}\n\nCode to fix:\n\n${code}`;
            const promptLen = (prompt || '').length;
            if (LOG_AI_PROMPTS) appendJobLog(job.id, 'debug', `fix_prompt_iter_${it + 1}: ${prompt}`);
            else appendJobLog(job.id, 'debug', `fix_prompt_len=${promptLen}`);
            const t0ai = Date.now();
            const { text: fixText } = await callLLM({ model, retries: 11, baseDelayMs: 1500, contents: [{ role: 'user', parts: [{ text: prompt }] }] });
            const aiMs = Date.now() - t0ai;
            appendJobLog(job.id, 'debug', `ai_fix_response_len=${(fixText || '').length} ai_ms=${aiMs}`);
            if (LOG_AI_OUTPUTS) appendJobLog(job.id, 'debug', `fix_response_iter_${it + 1}: ${fixText}`);
            const fixed = extractFirstCodeBlock(fixText) || { language: 'solidity', code: fixText };
            code = sanitizeSolidity(fixed.code || code);
            fs.writeFileSync(filePath, code, 'utf8');
            it += 1;
          }

          if (!compiled || !compiled.ok) {
            updateJob(job.id, { state: 'failed', progress: 100, error: 'COMPILE_FAILED', details: compiled });
            return;
          }
          appendJobLog(job.id, 'info', `Compile success after ${it} fix iterations.`);

          // 3) Resolve deployable contract name from artifacts (avoid mocks)
          let contractName = 'AIFixedContract';
          try {
            const artifactsDir = path.join(sandboxDir, 'artifacts', 'contracts', unique);
            if (fs.existsSync(artifactsDir)) {
              const files = fs.readdirSync(artifactsDir).filter(f => f.endsWith('.json') && !f.endsWith('.dbg.json'));
              const readArtifact = (fname) => {
                try { return JSON.parse(fs.readFileSync(path.join(artifactsDir, fname), 'utf8')); } catch (_) { return null; }
              };
              const candidates = files
                .map(f => ({ name: f.replace(/\.json$/, ''), file: f, art: readArtifact(f) }))
                .filter(x => x.art && typeof x.art.bytecode === 'string' && x.art.bytecode !== '0x');

              // If user explicitly requested a contract, honor it if present
              const explicit = (requestedContractName || '').trim();
              if (explicit) {
                const match = candidates.find(c => c.name === explicit);
                if (match) contractName = match.name;
              }

              if (contractName === 'AIFixedContract') {
                // Prefer contract whose name matches filename (no extension)
                const baseName = path.basename(unique).replace(/\.sol$/, '');
                const byFile = candidates.find(c => c.name === baseName);
                if (byFile) contractName = byFile.name;
              }

              if (contractName === 'AIFixedContract') {
                // Filter out mocks by name
                const nonMocks = candidates.filter(c => !/^mock/i.test(c.name) && !/mock/i.test(c.name));
                const pool = nonMocks.length ? nonMocks : candidates;
                // Choose the one with the largest bytecode length (likely main contract)
                const best = pool.sort((a,b) => (a.art.bytecode.length||0) < (b.art.bytecode.length||0) ? 1 : -1)[0];
                if (best) contractName = best.name;
              }
            }
          } catch (_) {}

          // 4) Validate constructor args and generate deploy script
          updateJob(job.id, { progress: 70, step: 'deploy_script', contractName });
          appendJobLog(job.id, 'info', `Contract chosen for deploy: ${contractName}`);

          // Persist contract data to PostgreSQL for Railway redeployment durability
          try {
            const artPathFix = path.join(sandboxDir, 'artifacts', 'contracts', unique, `${contractName}.json`);
            if (fs.existsSync(artPathFix)) {
              const artFix = JSON.parse(fs.readFileSync(artPathFix, 'utf8'));
              await saveContract(job.id, {
                name: contractName,
                filename: unique,
                source: code,
                abi: artFix.abi,
                bytecode: artFix.bytecode,
                metadata: { compiler: '0.8.20', optimizer: { enabled: true, runs: 200 } },
              });
              appendJobLog(job.id, 'info', `Contract persisted to database: ${contractName}`);
            }
          } catch (persistErr) {
            appendJobLog(job.id, 'warn', `Failed to persist contract to DB: ${persistErr.message}`);
          }
          if (!fs.existsSync(sandboxScriptsDir)) fs.mkdirSync(sandboxScriptsDir, { recursive: true });
          const deployScript = path.join(sandboxScriptsDir, `deploy-${job.id}.js`);
          const argsLiteral = JSON.stringify(constructorArgs ?? []);
          const fqName = `contracts/${unique}:${contractName}`;
          const scriptCode = `// Auto-generated by AI fix job ${job.id}\nconst hre = require('hardhat');\n\nasync function main() {\n  const [deployer] = await hre.ethers.getSigners();\n  const Factory = await hre.ethers.getContractFactory(${JSON.stringify(fqName)});\n  const args = ${argsLiteral};\n  const c = await Factory.connect(deployer).deploy(...args);\n  await c.waitForDeployment();\n  const address = await c.getAddress();\n  const result = { network: hre.network.name, deployer: deployer.address, contract: ${JSON.stringify(contractName)}, fqName: ${JSON.stringify(fqName)}, address, params: { args } };\n  console.log('DEPLOY_RESULT ' + JSON.stringify(result));\n}\n\nmain().catch((e) => { console.error(e); process.exit(1); });\n`;
          fs.writeFileSync(deployScript, scriptCode, 'utf8');

          try {
            const artPath = path.join(sandboxDir, 'artifacts', 'contracts', unique, `${contractName}.json`);
            if (fs.existsSync(artPath)) {
              const art = JSON.parse(fs.readFileSync(artPath, 'utf8'));
              const cons = Array.isArray(art.abi) ? art.abi.find((x) => x && x.type === 'constructor') : null;
              const expected = cons && Array.isArray(cons.inputs) ? cons.inputs : [];
              const provided = Array.isArray(constructorArgs) ? constructorArgs : [];
              if (expected.length !== provided.length) {
                updateJob(job.id, {
                  state: 'failed',
                  progress: 100,
                  step: 'deploy_prep',
                  error: 'CONSTRUCTOR_ARGS_MISMATCH',
                  details: { contractName, expectedConstructor: expected.map(i => ({ name: i.name, type: i.type })), providedConstructorArgs: provided }
                });
                appendJobLog(job.id, 'error', `Constructor args mismatch. Expected ${expected.length}, provided ${provided.length}.`);
                return;
              }
            }
          } catch (_) {}

          // 5) Deploy
          updateJob(job.id, { progress: 80, step: 'deploy' });
          const requested = (typeof network === 'string' && network.trim()) ? network.trim() : 'basecamp';
          const netAliasMap = {
            'camp': 'basecamp',
            'fuji': 'avalanche-fuji',
            'avax-fuji': 'avalanche-fuji',
            // Boba Sepolia aliases
            'boba': 'boba-sepolia',
            'boba-sepolia': 'boba-sepolia',
            // BSC Testnet aliases
            'bsc': 'bsc-testnet',
            'bsc-testnet': 'bsc-testnet',
            'bsctestnet': 'bsc-testnet',
            'bnb': 'bsc-testnet',
            'bnb-testnet': 'bsc-testnet',
            'bnbchain-testnet': 'bsc-testnet',
            'bnb-chain-testnet': 'bsc-testnet',
            'binance': 'bsc-testnet',
            'binance-testnet': 'bsc-testnet',
            'binance-smart-chain': 'bsc-testnet',
            'binance-smart-chain-testnet': 'bsc-testnet',
            'chapel': 'bsc-testnet',
          };
          const normalized = requested.replace(/_/g, '-').toLowerCase();
          const net = netAliasMap[normalized] || normalized;
          appendJobLog(job.id, 'info', `Deploying to network ${net}`);
          const args = ['hardhat', 'run', path.relative(sandboxDir, deployScript), '--network', net, '--config', sandboxConfigPath];
          const t0deploy = Date.now();
          await enqueueDeployAi(`ai:${net}`, () => new Promise((resolve) => {
            const child = spawn('npx', args, { cwd: sandboxDir, env: { ...process.env }, shell: true });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (d) => { const s = d.toString(); stdout += s; appendJobLog(job.id, 'info', s); });
            child.stderr.on('data', (d) => { const s = d.toString(); stderr += s; appendJobLog(job.id, 'error', s); });
            child.on('error', (err) => { const s = `spawn error: ${err.message}`; stderr += `\n${s}`; appendJobLog(job.id, 'error', s); });
            child.on('close', async (code) => {
              if (code !== 0) {
                updateJob(job.id, { state: 'failed', progress: 100, error: `exit ${code}`, stdout, stderr });
                return resolve();
              }
              const line = (stdout || '').split('\n').find((l) => l.startsWith('DEPLOY_RESULT '));
              let result = null;
              if (line) {
                try { result = JSON.parse(line.replace('DEPLOY_RESULT ', '')); } catch (_) {}
              }
              if (result && result.address) {
                appendJobLog(job.id, 'info', `Deploy success. Address=${result.address}`);
                
                // Persist deployment result to PostgreSQL for Railway redeployment durability
                try {
                  await saveDeployment(job.id, {
                    network: result.network,
                    chainId: null,
                    address: result.address,
                    deployer: result.deployer,
                    txHash: null,
                    blockNumber: null,
                    constructorArgs: result.params?.args || [],
                  });
                  appendJobLog(job.id, 'info', `Deployment persisted to database: ${result.address}`);
                } catch (persistErr) {
                  appendJobLog(job.id, 'warn', `Failed to persist deployment to DB: ${persistErr.message}`);
                }
              }
              const deployMs = Date.now() - t0deploy;
              appendJobLog(job.id, 'info', `deploy_duration_ms=${deployMs}`);
              updateJob(job.id, { state: 'completed', progress: 100, result, stdout, stderr });
              // Persist deploy result and logs to disk for durability across restarts
              try {
                const deployDir = path.join(sandboxDir, 'deploy');
                fs.mkdirSync(deployDir, { recursive: true });
                const resultPath = path.join(deployDir, 'result.json');
                const stdoutPath = path.join(deployDir, 'stdout.txt');
                const stderrPath = path.join(deployDir, 'stderr.txt');
                fs.writeFileSync(resultPath, JSON.stringify(result || {}, null, 2), 'utf8');
                fs.writeFileSync(stdoutPath, String(stdout || ''), 'utf8');
                fs.writeFileSync(stderrPath, String(stderr || ''), 'utf8');
                appendJobLog(job.id, 'info', `Saved deploy result: ${path.relative(path.join(__dirname, '..', '..'), resultPath)}`);
              } catch (_) {}
              return resolve();
            });
          }));
        } catch (e) {
          appendJobLog(job.id, 'error', `Fix job failed: ${e.message}`);
          updateJob(job.id, { state: 'failed', progress: 100, error: e.message });
        }
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/ai/compile
  // body: { filename?: string, code: string }
  // Writes code to contracts/AI_<timestamp>_<safeFilename>.sol and runs `npx hardhat compile` in the project root.
  /**
   * @swagger
   * /api/ai/compile:
   *   post:
   *     tags: [AI]
   *     summary: Compile provided Solidity code in an isolated sandbox
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               filename: { type: string }
   *               code: { type: string }
   *     responses:
   *       200:
   *         description: Compilation result
   *       400:
   *         description: Missing code
   *       500:
   *         description: Internal error
   */
  router.post('/compile', async (req, res) => {
    try {
      const { filename = 'AIGenerated.sol', code: source = '' } = req.body || {};
      if (!source.trim()) return res.status(400).json({ ok: false, error: 'CODE_REQUIRED' });

      // Create isolated per-request sandbox (no repo contracts included)
      const projectRoot = path.join(__dirname, '..', '..');
      const compileId = `compile_${Date.now()}`;
      const sandboxDir = path.join(projectRoot, 'tmp', 'jobs', compileId);
      const sandboxContractsDir = path.join(sandboxDir, 'contracts');
      const sandboxConfigPath = path.join(sandboxDir, 'hardhat.config.js');

      fs.mkdirSync(sandboxContractsDir, { recursive: true });

      // Minimal isolated Hardhat config (same as pipeline)
      const sandboxConfig = `require("@nomicfoundation/hardhat-toolbox");\nrequire("dotenv").config();\nconst path = require('path');\n\n/** @type import('hardhat/config').HardhatUserConfig */\nmodule.exports = {\n  solidity: {\n    compilers: [\n      { version: "0.8.19", settings: { optimizer: { enabled: true, runs: 200 } } },\n      { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 200 } } },\n    ],\n  },\n  networks: {\n    hardhat: {},\n  },\n  paths: {\n    sources: path.join(__dirname, 'contracts'),\n    tests: path.join(__dirname, 'test'),\n    cache: path.join(__dirname, 'cache'),\n    artifacts: path.join(__dirname, 'artifacts'),\n  },\n};\n`;
      fs.writeFileSync(sandboxConfigPath, sandboxConfig, 'utf8');

      // Write the source file inside sandbox
      const base = path.basename(filename).replace(/[^A-Za-z0-9_.-]/g, '');
      const unique = `AI_${Date.now()}_${base.endsWith('.sol') ? base : base + '.sol'}`;
      const filePath = path.join(sandboxContractsDir, unique);
      const sanitized = sanitizeSolidity(source);
      fs.writeFileSync(filePath, sanitized, 'utf8');

      // Compile in sandbox
      const args = ['hardhat', 'compile', '--config', sandboxConfigPath];
      const child = spawn('npx', args, { cwd: sandboxDir, env: { ...process.env }, shell: true });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      child.stderr.on('data', (d) => { stderr += d.toString(); });
      child.on('error', (err) => { stderr += `\nspawn error: ${err.message}`; });
      child.on('close', (exitCode) => {
        const compiled = exitCode === 0;
        // Inspect sandbox artifacts to discover compiled contract names for this file
        let compiledContracts = [];
        try {
          const artifactsDir = path.join(sandboxDir, 'artifacts', 'contracts', unique);
          if (fs.existsSync(artifactsDir)) {
            const files = fs.readdirSync(artifactsDir).filter(f => f.endsWith('.json') && !f.endsWith('.dbg.json'));
            compiledContracts = files.map(f => f.replace(/\.json$/, ''));
          }
        } catch (_) {}

        const payload = {
          ok: compiled,
          file: {
            relativePath: path.join('tmp', 'jobs', compileId, 'contracts', unique),
            absolutePath: filePath,
            size: Buffer.byteLength(source, 'utf8')
          },
          compiledContracts,
          stdout,
          stderr,
          error: compiled ? null : `exit ${exitCode}`
        };
        return res.status(200).json(payload);
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  });

  // POST /api/ai/pipeline
  // body: { prompt: string, network?: string, maxIters?: number, contractName?: string, filename?: string, constructorArgs?: any[] }
  // Returns 202 with job immediately; processing continues in background. Poll /api/job/:id/status
  /**
   * @swagger
   * /api/ai/pipeline:
   *   post:
   *     tags: [AI]
   *     summary: End-to-end AI pipeline to generate, fix, compile, and deploy a contract from a prompt
   *     description: Launches a background job. Poll job status and logs to follow progress.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               prompt: { type: string }
   *               network: { type: string, example: "basecamp-testnet" }
   *               maxIters: { type: integer, minimum: 1 }
   *               contractName: { type: string }
   *               filename: { type: string }
   *               constructorArgs: { type: array, items: { type: string } }
   *               strictArgs: { type: boolean }
   *               context: { type: string }
   *     responses:
   *       202:
   *         description: Job accepted; use the returned id to poll status and logs
   *       400:
   *         description: Missing prompt
   *       500:
   *         description: Internal error
   */
  router.post('/pipeline', async (req, res) => {
    const {
      prompt = '',
      network = 'basecamp',
      maxIters: reqMaxIters = DEFAULT_PIPELINE_MAX_ITERS,
      contractName: providedName = '',
      filename = 'AIGenerated.sol',
      constructorArgs = [],
      strictArgs,
      context = ''
    } = req.body || {};

    if (!prompt.trim()) return res.status(400).json({ ok: false, error: 'PROMPT_REQUIRED' });
    // Sanitize prompt to remove shell placeholders that can leak into code and break identifiers
    const sanitizedPrompt = String(prompt)
      .replace(/\$\{[^}]+\}/g, '')  // remove ${...}
      .replace(/\$\([^)]*\)/g, '')  // remove $(...)
      .replace(/[\r\t]/g, ' ')
      .trim();

    // strictArgs default: FALSE to allow auto-filling constructor args. Set PIPELINE_STRICT_ARGS=1 or strictArgs=true to enable strict mode
    const strictEnv = process.env.PIPELINE_STRICT_ARGS;
    const strictDefault = (strictEnv === undefined || strictEnv === '') ? false : (String(strictEnv) === '1');
    const strict = (typeof strictArgs === 'boolean') ? strictArgs : strictDefault;
    // Normalize maxIters with env defaults and hard cap
    const parsedIters = Number(reqMaxIters);
    const requestedIters = (Number.isFinite(parsedIters) && parsedIters > 0) ? Math.floor(parsedIters) : DEFAULT_PIPELINE_MAX_ITERS;
    const chosenMaxIters = Math.max(1, Math.min(MAX_ITERS_HARD_CAP, requestedIters));

    const job = await createJob('ai_pipeline', { prompt, network, maxIters: chosenMaxIters, providedName, filename, constructorArgs, strictArgs: strict, jobKind: 'pipeline' });
    updateJob(job.id, { state: 'running', progress: 5, step: 'init' });
    try { logger.info({ jobId: job.id, network, maxIters: chosenMaxIters, filename, strictArgs: strict }, 'pipeline_start'); } catch (_) {}
    appendJobLog(job.id, 'info', `Pipeline started. Network=${network}, maxIters=${chosenMaxIters}, file=${filename}, strictArgs=${strict}`);
    appendJobLog(job.id, 'debug', `config: maxIters=${chosenMaxIters} (hardCap=${MAX_ITERS_HARD_CAP})`);
    res.status(202).json({ ok: true, job });

    // Background processing
    setImmediate(async () => {
      const projectRoot = path.join(__dirname, '..', '..');
      // Per-job sandbox under project root to isolate builds from repo state
      const sandboxDir = path.join(projectRoot, 'tmp', 'jobs', job.id);
      const sandboxContractsDir = path.join(sandboxDir, 'contracts');
      const sandboxScriptsDir = path.join(sandboxDir, 'scripts');
      const sandboxConfigPath = path.join(sandboxDir, 'hardhat.config.js');
      try {
        // 1) Generate code
        updateJob(job.id, { progress: 10, step: 'generate' });
        const t0Gen = Date.now();
        appendJobLog(job.id, 'info', 'Stage: generate -> prompt preparation');
        try { logger.debug({ jobId: job.id }, 'augment_prompt_start'); } catch (_) {}
        // Optionally ask Gemini to architect a richer prompt, then run local enhancer
        const architected = await maybeAugmentPromptWithGemini(sanitizedPrompt);
        try { logger.debug({ jobId: job.id, rawLen: sanitizedPrompt.length, archLen: (architected||'').length }, 'augment_prompt_done'); } catch (_) {}
        const effectivePrompt = architected || sanitizedPrompt;
        // Use new game classification system
        const gameClassification = classifyGame(effectivePrompt);
        const domains = detectDomainsFromText(effectivePrompt); // Legacy compatibility
        const specFirst = String(process.env.AI_SPEC_FIRST || '') === '1';
        let specJson = null;
        let validationResult = null;
        if (specFirst && domains.game) {
          try {
            // Step 1: Generate GameSpec using schema
            const specPromptFiles = [
              'orchestrator/00_plan_from_idea.md',
              'orchestrator/schemas/game_spec_schema.md'
            ];
            const specPrompt = safeAssemblePrompt(specPromptFiles, { gameType: domains.gameType || 'generic' });
            appendJobLog(job.id, 'debug', `spec_first: generating GameSpec for type=${domains.gameType || 'generic'}`);
            
            const { text: specText } = await callLLM({
              retries: 7,
              baseDelayMs: 1200,
              contents: [{ role: 'user', parts: [{ text: specPrompt + '\n\nIdea:\n' + effectivePrompt }] }]
            });
            specJson = parseJsonLenient(specText);
            appendJobLog(job.id, 'debug', `spec_first_ok keys=${Object.keys(specJson || {}).length}`);
            
            // Step 2: Validate GameSpec for exploits
            try {
              const validatorPrompt = safeAssemblePrompt(['orchestrator/game_balance_validator.md'], {});
              if (validatorPrompt) {
                const { text: validateText } = await callLLM({
                  retries: 3,
                  baseDelayMs: 1000,
                  contents: [{ role: 'user', parts: [{ text: validatorPrompt + '\n\nGameSpec to validate:\n' + JSON.stringify(specJson, null, 2) }] }]
                });
                validationResult = parseJsonLenient(validateText);
                appendJobLog(job.id, 'debug', `spec_validation: ${validationResult?.validationResult || 'unknown'} issues=${(validationResult?.issues || []).length}`);
                
                // If critical issues, log them but continue (don't block)
                if (validationResult?.issues?.length > 0) {
                  const critical = validationResult.issues.filter(i => i.severity === 'critical');
                  if (critical.length > 0) {
                    appendJobLog(job.id, 'warn', `spec_validation_critical: ${critical.map(i => i.description).join('; ')}`);
                  }
                }
              }
            } catch (ve) {
              appendJobLog(job.id, 'debug', `spec_validation_skipped: ${ve.message}`);
            }
          } catch (e) {
            appendJobLog(job.id, 'warn', `spec_first_failed: ${e.message}`);
            specJson = null;
          }
        }
        const enhancedPrompt = enhancePipelinePrompt(
          specJson ? (effectivePrompt + `\n\nGameSpec:\n${JSON.stringify(specJson)}`) : effectivePrompt,
          { contractName: providedName, filename, network }
        );
        appendJobLog(job.id, 'debug', `Enhanced prompt length=${enhancedPrompt.length}`);
        try { logger.debug({ jobId: job.id, len: enhancedPrompt.length }, 'gemini_generate_start'); } catch (_) {}
        let genPrompt = '';
        try {
          // Use new intelligent prompt selection system
          if (gameClassification.game && gameClassification.confidence > 30) {
            // High confidence - use targeted prompt suite
            const promptSuite = loadPromptSuite(gameClassification);
            
            appendJobLog(job.id, 'info', `game_classified: ${gameClassification.gameType} (${gameClassification.confidence.toFixed(1)}% confidence)`);
            appendJobLog(job.id, 'debug', `prompt_suite: ${gameClassification.promptSuite} with ${promptSuite.prompts.length} prompts`);
            appendJobLog(job.id, 'debug', `mechanics: [${gameClassification.secondaryMechanics.join(', ')}]`);
            appendJobLog(job.id, 'debug', `complexity: ${gameClassification.contractComplexity}, gas: ${gameClassification.gasProfile}, security: ${gameClassification.antiCheatLevel}`);
            
            genPrompt = safeAssemblePrompt(promptSuite.prompts, { 
              network, 
              filename, 
              contractName: providedName || '',
              gameType: gameClassification.gameType,
              gasProfile: gameClassification.gasProfile,
              antiCheatLevel: gameClassification.antiCheatLevel
            }) + '\n\n' + enhancedPrompt;
          } else if (domains.game) {
            // Low confidence or legacy fallback
            appendJobLog(job.id, 'warn', `game_classification_low_confidence: ${gameClassification.confidence.toFixed(1)}% - using legacy prompts`);
            const baseRels = [
              'shared/00_style.md',
              'shared/01_safety_and_integrity.md',
              'shared/02_output_formats.md',
              'contracts/00_base_generate.md'
            ];
            const gamePrompts = assembleGamePrompts(domains);
            const allRels = [...baseRels, ...gamePrompts];
            
            genPrompt = safeAssemblePrompt(allRels, { network, filename, contractName: providedName || '' }) + '\n\n' + enhancedPrompt;
          } else {
            // Non-game contract
            const baseRels = [
              'shared/00_style.md',
              'shared/01_safety_and_integrity.md',
              'shared/02_output_formats.md',
              'contracts/00_base_generate.md'
            ];
            if (domains.compliance) baseRels.push('domains/compliance/compliance_framework.md');
            
            genPrompt = safeAssemblePrompt(baseRels, { network, filename, contractName: providedName || '' }) + '\n\n' + enhancedPrompt;
          }
        } catch (e) {
          appendJobLog(job.id, 'warn', `prompt_pack_failed_fallback: ${e.message}`);
          genPrompt = enhancedPrompt;
        }
        if (LOG_AI_PROMPTS) appendJobLog(job.id, 'debug', `generate_prompt_len=${genPrompt.length}`);
        const t0aiGen = Date.now();
        const { text } = await callLLM({
          retries: 11,
          baseDelayMs: 1500,
          contents: [{ role: 'user', parts: [{ text: genPrompt }] }]
        });
        const aiGenMs = Date.now() - t0aiGen;
        appendJobLog(job.id, 'debug', `generate_ai_response_len=${(text || '').length} ai_ms=${aiGenMs}`);
        if (LOG_AI_OUTPUTS) appendJobLog(job.id, 'debug', `generate_response: ${text}`);
        let block = extractFirstCodeBlock(text) || { language: 'solidity', code: text };
        let code = sanitizeSolidity(block.code || '');
        if (!code.trim()) throw new Error('AI_GENERATION_EMPTY_CODE');
        const t1Gen = Date.now();
        appendJobLog(job.id, 'info', `Generation done in ${t1Gen - t0Gen}ms. Code size=${code.length}`);
        try { logger.info({ jobId: job.id, ms: t1Gen - t0Gen, size: code.length }, 'gemini_generate_done'); } catch (_) {}

        // Infer contract name if not provided. Prefer non-abstract declared contracts in the generated code.
        const declaredContracts = [];
        const nonAbstractDeclared = [];
        try {
          const re = /^\s*(abstract\s+)?contract\s+([A-Za-z0-9_]+)\b/mg;
          let m;
          while ((m = re.exec(code)) !== null) {
            const isAbstract = !!m[1];
            const name = m[2];
            declaredContracts.push(name);
            if (!isAbstract) nonAbstractDeclared.push(name);
          }
        } catch (_) {}

        const inferName = () => {
          if (nonAbstractDeclared.length > 0) return nonAbstractDeclared[0];
          if (declaredContracts.length > 0) return declaredContracts[0];
          const m = code.match(/contract\s+([A-Za-z0-9_]+)/);
          return m ? m[1] : 'AIGeneratedContract';
        };
        let contractName = providedName && providedName.trim() ? providedName.trim() : inferName();

        // 2) Prepare sandbox and write files there
        updateJob(job.id, { progress: 20, step: 'write' });
        appendJobLog(job.id, 'info', 'Stage: write -> preparing sandbox and files');
        if (!fs.existsSync(sandboxContractsDir)) fs.mkdirSync(sandboxContractsDir, { recursive: true });
        if (!fs.existsSync(sandboxScriptsDir)) fs.mkdirSync(sandboxScriptsDir, { recursive: true });

        // Create a sandbox Hardhat config that is fully isolated from the repo
        // to ensure only the sandbox contracts are compiled. Import networks
        // from the project root hardhat.config.js so any chain added there is
        // automatically supported by the AI pipeline sandbox.
        const sandboxConfig = `require("@nomicfoundation/hardhat-toolbox");\nrequire("dotenv").config();\nconst path = require('path');\n\n// Load networks from project root for multi-chain support\nlet rootNetworks = {};\ntry {\n  // __dirname is the sandbox dir: <projectRoot>/tmp/jobs/<jobId>\n  // Go up three levels to reach the project root (../../..)\n  const rootCfg = require(path.join(__dirname, '..', '..', '..', 'hardhat.config.js'));\n  if (rootCfg && rootCfg.networks) rootNetworks = rootCfg.networks;\n} catch (e) {\n  rootNetworks = {};\n}\n\n/** @type import('hardhat/config').HardhatUserConfig */\nmodule.exports = {\n  solidity: {\n    compilers: [\n      { version: "0.8.19", settings: { optimizer: { enabled: true, runs: 200 } } },\n      { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 200 } } },\n    ],\n  },\n  networks: {\n    hardhat: {},\n    ...rootNetworks,\n  },\n  paths: {\n    sources: path.join(__dirname, 'contracts'),\n    tests: path.join(__dirname, 'test'),\n    cache: path.join(__dirname, 'cache'),\n    artifacts: path.join(__dirname, 'artifacts'),\n  },\n};\n`;
        fs.mkdirSync(sandboxDir, { recursive: true });
        fs.writeFileSync(sandboxConfigPath, sandboxConfig, 'utf8');

        const base = path.basename(filename).replace(/[^A-Za-z0-9_.-]/g, '');
        const unique = `AI_${job.id}_${base.endsWith('.sol') ? base : base + '.sol'}`;
        const filePath = path.join(sandboxContractsDir, unique);
        fs.writeFileSync(filePath, code, 'utf8');

        const compileOnce = () => new Promise((resolve) => {
          try { logger.debug({ jobId: job.id }, 'compile_start'); } catch (_) {}
          const args = ['hardhat', 'compile', '--config', sandboxConfigPath];
          const child = spawn('npx', args, { cwd: sandboxDir, env: { ...process.env }, shell: true });
          let stdout = '';
          let stderr = '';
          child.stdout.on('data', (d) => { const s = d.toString(); stdout += s; appendJobLog(job.id, 'info', s); });
          child.stderr.on('data', (d) => { const s = d.toString(); stderr += s; appendJobLog(job.id, 'error', s); });
          child.on('error', (err) => { const s = `spawn error: ${err.message}`; stderr += `\n${s}`; appendJobLog(job.id, 'error', s); });
          child.on('close', (code) => {
            const ok = code === 0;
            try { logger.debug({ jobId: job.id, ok }, 'compile_close'); } catch (_) {}
            resolve({ ok, stdout, stderr, error: ok ? null : new Error(`exit ${code}`) });
          });
        });

        // 3) Compile + auto-fix loop
        updateJob(job.id, { progress: 30, step: 'compile' });
        appendJobLog(job.id, 'info', 'Stage: compile -> starting compile/fix loop');
        let it = 0; let compiled = null; let lastErrors = '';
        while (it < Number(chosenMaxIters)) {
          const t0c = Date.now();
          compiled = await compileOnce();
          const compileMs = Date.now() - t0c;
          appendJobLog(job.id, 'debug', `iter ${it + 1}/${chosenMaxIters}: compile ${compiled.ok ? 'ok' : 'failed'} in ${compileMs}ms`);
          if (compiled.ok) break;
          // Collect errors
          lastErrors = (compiled.stderr || '') + '\n' + (compiled.stdout || '');
          updateJob(job.id, { progress: 30 + Math.min(20, it * 5), step: 'fix', lastErrors });
          appendJobLog(job.id, 'warn', `Compile failed (iter ${it}). Running AI fix. Error length=${lastErrors.length}`);
          let fixPrompt = '';
          try {
            const baseRels = [
              'shared/00_style.md',
              'shared/01_safety_and_integrity.md',
              'shared/02_output_formats.md',
              'contracts/02_base_fix.md'
            ];
            // Add game-specific prompts for fix context (subset - focus on core patterns)
            const gameFixPrompts = [];
            if (domains && domains.game) {
              gameFixPrompts.push('domains/games/game_framework.md');
              if (domains.gameType) {
                gameFixPrompts.push(`domains/games/${domains.gameType}/reference.md`);
              }
              gameFixPrompts.push('contracts/acceptance/gas_benchmarks.md');
              gameFixPrompts.push('contracts/acceptance/edge_cases.md');
            }
            const allRels = [...baseRels, ...gameFixPrompts];
            const head = safeAssemblePrompt(allRels, { network, filename, contractName: providedName || '' });
            fixPrompt = `${head}\n\nContext:\n${context}\n\nErrors:\n${lastErrors}\n\nCode to fix:\n\n${code}`;
          } catch (e) {
            appendJobLog(job.id, 'warn', `fix_prompt_pack_failed_fallback: ${e.message}`);
            fixPrompt = `Errors:\n${lastErrors}\n\nCode to fix:\n\n${code}`;
          }
        if (LOG_AI_PROMPTS) appendJobLog(job.id, 'debug', `pipeline_fix_prompt_iter_${it + 1}: ${fixPrompt}`);
        else appendJobLog(job.id, 'debug', `pipeline_fix_prompt_len=${fixPrompt.length}`);
        const t0aiFix = Date.now();
        const { text: fixText } = await callLLM({ retries: 11, baseDelayMs: 1500, contents: [{ role: 'user', parts: [{ text: fixPrompt }] }] });
        const aiFixMs = Date.now() - t0aiFix;
        appendJobLog(job.id, 'debug', `pipeline_ai_fix_response_len=${(fixText || '').length} ai_ms=${aiFixMs}`);
        if (LOG_AI_OUTPUTS) appendJobLog(job.id, 'debug', `pipeline_fix_response_iter_${it + 1}: ${fixText}`);
        const fixed = extractFirstCodeBlock(fixText) || { language: 'solidity', code: fixText };
        code = sanitizeSolidity(fixed.code || code);
        // Re-infer contract name if changed
        const maybeNewName = code.match(/contract\s+([A-Za-z0-9_]+)/);
        if (maybeNewName && maybeNewName[1]) contractName = providedName || maybeNewName[1];
        // Overwrite file in sandbox
        fs.writeFileSync(filePath, code, 'utf8');
        it += 1;
      }
 

        if (!compiled || !compiled.ok) {
          updateJob(job.id, { state: 'failed', progress: 100, error: 'COMPILE_FAILED', details: compiled });
          try { logger.error({ jobId: job.id }, 'compile_failed'); } catch (_) {}
          return;
        }
        appendJobLog(job.id, 'info', `Compile success after ${it} fix iterations.`);

        // 4) Resolve actual compiled contract name from artifacts for this file
        try {
          const artifactsDir = path.join(sandboxDir, 'artifacts', 'contracts', unique);
          if (fs.existsSync(artifactsDir)) {
            const files = fs.readdirSync(artifactsDir).filter(f => f.endsWith('.json') && !f.endsWith('.dbg.json'));
            if (files.length > 0) {
              // Load artifact metadata to check deployable bytecode
              const readArtifact = (fname) => {
                try {
                  const p = path.join(artifactsDir, fname);
                  return JSON.parse(fs.readFileSync(p, 'utf8'));
                } catch (_) { return null; }
              };
              const hasDeployableBytecode = (fname) => {
                const art = readArtifact(fname);
                // Hardhat uses bytecode === '0x' for abstract/interfaces
                return !!art && typeof art.bytecode === 'string' && art.bytecode !== '0x';
              };

              // Prefer a file that matches the currently inferred name and is deployable
              let preferred = files.find(f => f.replace(/\.json$/, '') === contractName && hasDeployableBytecode(f));
              // Next, prefer non-abstract contracts declared in the generated code (deployable only)
              let byDeclared = files.find(f => nonAbstractDeclared.includes(f.replace(/\.json$/, '')) && hasDeployableBytecode(f));
              // Avoid common abstract/base names like Context if possible, and ensure deployable
              const avoidSet = new Set(['Context', 'Strings', 'Address', 'Ownable', 'Initializable']);
              let nonAvoid = files.find(f => !avoidSet.has(f.replace(/\.json$/, '')) && hasDeployableBytecode(f));
              // Finally any deployable artifact
              let anyDeployable = files.find(f => hasDeployableBytecode(f));
              const chosen = preferred || byDeclared || nonAvoid || anyDeployable || files[0];
              contractName = chosen.replace(/\.json$/, '');
              appendJobLog(job.id, 'debug', `Artifact chosen for deploy: ${contractName}`);
            } else {
              // Fallback to stricter regex if no artifact json found
              const m = code.match(/^\s*contract\s+([A-Za-z0-9_]+)\b/m);
              if (m && m[1]) contractName = m[1];
            }
          } else {
            // Fallback to stricter regex when artifacts subdir isn't present
            const m = code.match(/^\s*contract\s+([A-Za-z0-9_]+)\b/m);
            if (m && m[1]) contractName = m[1];
          }
        } catch (_) {
          // Keep existing contractName if resolution fails
        }

        // 5) Validate constructor args (no auto-fill) and generate deploy script in sandbox
        updateJob(job.id, { progress: 70, step: 'deploy_script', contractName });
        appendJobLog(job.id, 'info', `Stage: deploy_script -> contract ${contractName}`);
        appendJobLog(job.id, 'info', `Contract chosen for deploy: ${contractName}`);

        // Persist contract data to PostgreSQL for Railway redeployment durability
        try {
          const artPath = path.join(sandboxDir, 'artifacts', 'contracts', unique, `${contractName}.json`);
          if (fs.existsSync(artPath)) {
            const art = JSON.parse(fs.readFileSync(artPath, 'utf8'));
            await saveContract(job.id, {
              name: contractName,
              filename: unique,
              source: code,
              abi: art.abi,
              bytecode: art.bytecode,
              metadata: { compiler: '0.8.20', optimizer: { enabled: true, runs: 200 } },
            });
            appendJobLog(job.id, 'info', `Contract persisted to database: ${contractName}`);
          }
        } catch (persistErr) {
          appendJobLog(job.id, 'warn', `Failed to persist contract to DB: ${persistErr.message}`);
        }
        // Determine final constructor args from ABI; if user-provided args do not match arity, fail fast.
        let finalConstructorArgs = Array.isArray(constructorArgs) ? constructorArgs : [];
        try {
          const artPath = path.join(sandboxDir, 'artifacts', 'contracts', unique, `${contractName}.json`);
          if (fs.existsSync(artPath)) {
            const art = JSON.parse(fs.readFileSync(artPath, 'utf8'));
            const cons = Array.isArray(art.abi) ? art.abi.find((x) => x && x.type === 'constructor') : null;
            const expected = cons && Array.isArray(cons.inputs) ? cons.inputs : [];
            const provided = Array.isArray(constructorArgs) ? constructorArgs : [];
            if (expected.length !== provided.length) {
              const expectedTypes = expected.map(i => ({ name: i.name, type: i.type }));
              if (strict) {
                updateJob(job.id, {
                  state: 'failed',
                  progress: 100,
                  step: 'deploy_prep',
                  error: 'CONSTRUCTOR_ARGS_REQUIRED',
                  details: { contractName, expectedConstructor: expectedTypes, providedConstructorArgs: provided }
                });
                appendJobLog(job.id, 'error', `Constructor args required for ${contractName}. Expected ${expected.length}, provided ${provided.length}.`);
                try { logger.warn({ jobId: job.id, contractName, expected: expectedTypes, provided }, 'constructor_args_required'); } catch (_) {}
                return;
              } else {
                // strictArgs=false: auto-fill defaults for missing args and truncate extras
                const zeroAddress = '0x0000000000000000000000000000000000000000';
                const defaultForType = (t) => {
                  try {
                    if (!t || typeof t !== 'string') return '0';
                    const type = t.trim();
                    if (type.endsWith('[]')) return [];
                    if (type === 'address') return zeroAddress;
                    if (type === 'bool') return false;
                    if (type === 'string') return '';
                    if (type === 'bytes') return '0x';
                    const bytesN = type.match(/^bytes(\d{1,2})$/);
                    if (bytesN) {
                      const n = Math.max(1, Math.min(32, parseInt(bytesN[1], 10)));
                      return '0x' + '00'.repeat(n);
                    }
                    if (/^u?int(\d{0,3})$/.test(type)) return '0';
                    if (type.startsWith('tuple')) return [];
                  } catch (_) {}
                  return '0';
                };
                const next = expected.map((inp, i) => (i < provided.length && provided[i] !== undefined) ? provided[i] : defaultForType(inp.type));
                finalConstructorArgs = next;
                appendJobLog(job.id, 'warn', `constructor_args_autofill: strictArgs=false -> filled defaults. expected=${expected.length} provided=${provided.length}`);
                try { logger.info({ jobId: job.id, contractName, expected: expectedTypes, provided, final: next }, 'constructor_args_autofilled'); } catch (_) {}
              }
            }
          }
        } catch (e) {
          // Non-fatal; continue and let Hardhat surface any errors
        }
        if (!fs.existsSync(sandboxScriptsDir)) fs.mkdirSync(sandboxScriptsDir, { recursive: true });
        const deployScript = path.join(sandboxScriptsDir, `deploy-${job.id}.js`);
        const argsLiteral = JSON.stringify(finalConstructorArgs ?? []);
        // Use fully-qualified name to avoid HH701 when multiple artifacts exist
        const fqName = `contracts/${unique}:${contractName}`;
        const scriptCode = `// Auto-generated by AI pipeline for job ${job.id}\nconst hre = require('hardhat');\n\nasync function main() {\n  const [deployer] = await hre.ethers.getSigners();\n  const Factory = await hre.ethers.getContractFactory(${JSON.stringify(fqName)});\n  const args = ${argsLiteral};\n  const c = await Factory.connect(deployer).deploy(...args);\n  await c.waitForDeployment();\n  const address = await c.getAddress();\n  const result = { network: hre.network.name, deployer: deployer.address, contract: ${JSON.stringify(contractName)}, fqName: ${JSON.stringify(fqName)}, address, params: { args } };\n  console.log('DEPLOY_RESULT ' + JSON.stringify(result));\n}\n\nmain().catch((e) => { console.error(e); process.exit(1); });\n`;
        fs.writeFileSync(deployScript, scriptCode, 'utf8');

        // 6) Deploy
        updateJob(job.id, { progress: 80, step: 'deploy' });
        const requested = (typeof network === 'string' && network.trim()) ? network.trim() : 'basecamp';
        // Normalize and alias common variants to match root hardhat.config.js keys
        const netAliasMap = {
          'camp': 'basecamp',
          // Avalanche Fuji common aliases
          'fuji': 'avalanche-fuji',
          'avax-fuji': 'avalanche-fuji',
          // Boba Sepolia aliases
          'boba': 'boba-sepolia',
          'boba-sepolia': 'boba-sepolia',
          // Base Sepolia aliases
          'base-sepolia': 'basecamp-testnet',
          'basesepolia': 'basecamp-testnet',
          'base-sepolia-testnet': 'basecamp-testnet',
          'base': 'basecamp-testnet',
          // BSC Testnet aliases
          'bsc': 'bsc-testnet',
          'bsc-testnet': 'bsc-testnet',
          'bnb': 'bsc-testnet',
          'bnb-testnet': 'bsc-testnet',
          'binance': 'bsc-testnet',
          'binance-testnet': 'bsc-testnet',
          'binance-smart-chain': 'bsc-testnet',
          'chapel': 'bsc-testnet',
        };
        const normalized = requested.replace(/_/g, '-').toLowerCase();
        const net = netAliasMap[normalized] || normalized;
        appendJobLog(job.id, 'info', `Stage: deploy -> network ${net}`);
        const args = ['hardhat', 'run', path.relative(sandboxDir, deployScript), '--network', net, '--config', sandboxConfigPath];
        const child = spawn('npx', args, { cwd: sandboxDir, env: { ...process.env }, shell: true });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => { const s = d.toString(); stdout += s; appendJobLog(job.id, 'info', s); });
        child.stderr.on('data', (d) => { const s = d.toString(); stderr += s; appendJobLog(job.id, 'error', s); });
        child.on('error', (err) => { const s = `spawn error: ${err.message}`; stderr += `\n${s}`; appendJobLog(job.id, 'error', s); });
        child.on('close', async (code) => {
          if (code !== 0) {
            updateJob(job.id, { state: 'failed', progress: 100, error: `exit ${code}`, stdout, stderr });
            try { logger.error({ jobId: job.id, code }, 'deploy_failed'); } catch (_) {}
            return;
          }
          const line = (stdout || '').split('\n').find((l) => l.startsWith('DEPLOY_RESULT '));
          let result = null;
          if (line) {
            try { result = JSON.parse(line.replace('DEPLOY_RESULT ', '')); } catch (_) {}
          }
          if (result && result.address) {
            appendJobLog(job.id, 'info', `Deploy success. Address=${result.address}`);
            try { logger.info({ jobId: job.id, address: result.address, network: result.network }, 'deploy_done'); } catch (_) {}
            
            // Persist deployment result to PostgreSQL for Railway redeployment durability
            try {
              await saveDeployment(job.id, {
                network: result.network,
                chainId: null, // Will be populated from network config if available
                address: result.address,
                deployer: result.deployer,
                txHash: null, // Not captured in current deploy script output
                blockNumber: null,
                constructorArgs: result.params?.args || [],
              });
              appendJobLog(job.id, 'info', `Deployment persisted to database: ${result.address}`);
            } catch (persistErr) {
              appendJobLog(job.id, 'warn', `Failed to persist deployment to DB: ${persistErr.message}`);
            }
          }
          updateJob(job.id, { state: 'completed', progress: 100, result, stdout, stderr });
        });
      } catch (e) {
        logger.error({ err: e, jobId: job.id }, 'Pipeline failed');
        appendJobLog(job.id, 'error', `Pipeline failed: ${e.message}`);
        updateJob(job.id, { state: 'failed', progress: 100, error: e.message });
      }
    });
  });

  return router;
};
