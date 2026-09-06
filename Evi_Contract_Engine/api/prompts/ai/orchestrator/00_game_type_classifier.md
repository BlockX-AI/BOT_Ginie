# Game Type Classification & Prompt Suite Selection

## INPUT: Game idea (text)

## OUTPUT: JSON with selected prompt suites

## Classification Logic

Analyze the game idea and determine the PRIMARY game type. Select ONE:

### PUZZLE (match-3, 2048, sudoku, tile-matching)
**Indicators:** grid, tiles, match, combine, merge, solve, clear, pattern, swap, cascade, tetris, blocks
**Prompt Suite:** `puzzle_complete` 
**Contract Pattern:** Deterministic grid state + move validation
**Gas Profile:** Medium (grid operations)
**Anti-Cheat Level:** Standard (server verification)

### RUNNER (endless runner, platformer, dodge)
**Indicators:** run, jump, dodge, distance, obstacles, speed, endless, survive, platform, arcade, score submit
**Prompt Suite:** `runner_complete` 
**Contract Pattern:** Score accumulation + physics verification
**Gas Profile:** Low (score claims only)
**Anti-Cheat Level:** Advanced (physics simulation)

### PVP_TURN (chess, card battler, tactics)
**Indicators:** versus, turns, opponent, strategy, compete, battle, match, chess, cards, tactics, board game
**Prompt Suite:** `pvp_turn_complete` 
**Contract Pattern:** Commitment scheme + turn validation
**Gas Profile:** High (state transitions)
**Anti-Cheat Level:** Advanced (commitment-reveal)

### PVP_REALTIME (racing, fighting, shooter)
**Indicators:** race, fight, shoot, real-time, simultaneous, reaction, racing, fighting, fps, multiplayer
**Prompt Suite:** `pvp_realtime_complete` 
**Contract Pattern:** State channel + periodic settlement
**Gas Profile:** Medium (checkpoint settlement)
**Anti-Cheat Level:** Advanced (state channels)

### IDLE (clicker, incremental, farm)
**Indicators:** idle, incremental, passive, upgrade, click, accumulate, farm, generator, offline progress
**Prompt Suite:** `idle_complete` 
**Contract Pattern:** Time-based accumulation + claim
**Gas Profile:** Low (periodic claims)
**Anti-Cheat Level:** Basic (time validation)

### RPG (adventure, dungeon, character progression)
**Indicators:** quest, character, level, stats, adventure, dungeon, loot, rpg, experience, skill tree
**Prompt Suite:** `rpg_complete` 
**Contract Pattern:** NFT character + stat progression
**Gas Profile:** High (complex state)
**Anti-Cheat Level:** Standard (VRF randomness)

### BETTING (dice, lottery, prediction)
**Indicators:** bet, betting, wager, gamble, casino, dice, coin flip, lottery, raffle, prediction, odds
**Prompt Suite:** `betting_complete`
**Contract Pattern:** Randomness + escrow
**Gas Profile:** Medium (VRF + transfers)
**Anti-Cheat Level:** Advanced (VRF + commitment)

## Secondary Mechanics Detection

Detect additional mechanics that require specific prompts:

- `economy_tokens` - Uses fungible tokens (token, coin, currency, reward, earn)
- `economy_nft` - Uses NFT items/characters (nft, collectible, unique, character, item)
- `social_guilds` - Guild/team mechanics (guild, team, clan, alliance, group)
- `social_pvp` - Player competition (pvp, versus, compete, battle, fight)
- `progression_linear` - Level-based unlocks (level, unlock, progress, advance)
- `progression_tree` - Skill tree (skill, tree, branch, talent, ability)
- `randomness_vrf` - Needs verifiable randomness (random, chance, luck, rng, fair)
- `leaderboard_global` - Top N tracking (leaderboard, ranking, top, best, high score)
- `leaderboard_seasonal` - Time-boxed competition (season, tournament, event, limited time)
- `energy_system` - Stamina/cooldowns (energy, stamina, cooldown, recharge, limit)
- `matchmaking` - Player pairing (matchmaking, queue, pair, find opponent, rating)

## Classification Algorithm

```javascript
function classifyGame(gameIdea) {
  const text = gameIdea.toLowerCase();
  const words = text.split(/\s+/);
  
  // Score each game type
  const scores = {
    PUZZLE: countMatches(words, ['grid', 'tiles', 'match', 'combine', 'merge', 'solve', 'clear', 'pattern', 'swap', 'cascade', 'tetris', 'blocks', '2048', 'sudoku']),
    RUNNER: countMatches(words, ['run', 'jump', 'dodge', 'distance', 'obstacles', 'speed', 'endless', 'survive', 'platform', 'arcade', 'score', 'submit']),
    PVP_TURN: countMatches(words, ['versus', 'turns', 'opponent', 'strategy', 'compete', 'battle', 'match', 'chess', 'cards', 'tactics', 'board']),
    PVP_REALTIME: countMatches(words, ['race', 'fight', 'shoot', 'realtime', 'real-time', 'simultaneous', 'reaction', 'racing', 'fighting', 'fps', 'multiplayer']),
    IDLE: countMatches(words, ['idle', 'incremental', 'passive', 'upgrade', 'click', 'accumulate', 'farm', 'generator', 'offline', 'progress']),
    RPG: countMatches(words, ['quest', 'character', 'level', 'stats', 'adventure', 'dungeon', 'loot', 'rpg', 'experience', 'skill']),
    BETTING: countMatches(words, ['bet', 'betting', 'wager', 'gamble', 'casino', 'dice', 'flip', 'lottery', 'raffle', 'prediction', 'odds'])
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
  
  return {
    gameType,
    promptSuite: gameType.toLowerCase() + '_complete',
    secondaryMechanics,
    contractComplexity,
    gasProfile,
    antiCheatLevel,
    confidence: Math.max(...Object.values(scores)) / Math.max(1, words.length) * 100
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
```

## Output Schema

```json
{
  "gameType": "PUZZLE|RUNNER|PVP_TURN|PVP_REALTIME|IDLE|RPG|BETTING",
  "promptSuite": "puzzle_complete|runner_complete|pvp_turn_complete|pvp_realtime_complete|idle_complete|rpg_complete|betting_complete",
  "secondaryMechanics": ["economy_tokens", "leaderboard_global"],
  "contractComplexity": "simple|medium|complex",
  "gasProfile": "low|medium|high",
  "antiCheatLevel": "basic|standard|advanced",
  "confidence": 85.5
}
```

## Usage Instructions

1. **Input Processing:** Extract and normalize the game idea text
2. **Keyword Analysis:** Tokenize and score against each game type
3. **Primary Classification:** Select the highest-scoring game type
4. **Secondary Detection:** Identify additional mechanics needed
5. **Complexity Assessment:** Determine contract complexity based on mechanics
6. **Output Generation:** Return structured classification with confidence score

## Confidence Thresholds

- **High Confidence (>70%):** Use selected prompt suite directly
- **Medium Confidence (30-70%):** Use selected suite + ask for clarification
- **Low Confidence (<30%):** Request more specific game description

## Fallback Strategy

If no clear game type emerges (all scores similar):
- Default to `PUZZLE` for grid/tile mentions
- Default to `IDLE` for economy/token mentions  
- Default to `RPG` for character/progression mentions
- Ask user to specify game type if confidence < 20%
