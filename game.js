// ============================================================
// game.js — GameState object and all state machine transitions
// ============================================================

// The single source of truth for all game state
const GameState = {
  // Progression
  round: 1,
  stage: 1,         // increases every 3 rounds, controls rule pool
  score: 0,
  targetScore: 300, // scales per stage
  coins: 3,
  lives: 3,

  // Rules
  activeRules: [],     // array of rule IDs currently in effect
  ruleChoicesCount: 3, // normally 3
  stability: 100,      // 0-100%

  // Hand session (resets each round)
  deck: [],
  hand: [],
  discard: [],
  handSize: 5,         // cards dealt to hand
  playSize: 5,         // cards player must submit
  handsPerRound: 4,
  handsRemaining: 4,
  drawsRemaining: 2,   // discard-and-redraw uses left
  maxDiscards: 5,      // max cards replaceable per draw
  mustDiscard: 0,      // must discard exactly this many (0 = no constraint)
  minDiscard: 0,       // must discard at least this many
  carryOver: 0,        // cards to carry from previous hand
  blindCards: 0,       // number of face-down cards

  // Deck modifiers (applied by deck_mutation rules)
  deckModifiers: {
    extraSuits: [],
    removedSuits: [],
    extraValues: [],
    removedValues: [],
    shrinkPerRound: 0,
    isBlind: false,
    addJokers: false,
    aceValue: 14
  },

  // Hand ranking modifiers (applied by chaos rules)
  rankingModifiers: {
    swaps: [],
    valueOverrides: {},
    straightLength: 5
  },

  // Scoring modifiers
  scoringModifiers: {
    suitMultipliers: {},
    aceValue: 14,
    kingValue: 13,
    queenValue: 20
  },

  // Shop / upgrades
  inventory: { shield: 0, cancelCard: 0, extraLife: 0 },

  // Screen state
  screen: 'title',
  previousScreen: null,

  // Per-session rule picking
  offeredRules: [],

  // Last hand result (for round summary)
  lastHandResult: null,
  lastHandCards: null,
  roundScore: 0, // score earned this round so far

  // Meta
  runComplete: false,
  bestScore: 0,
  discoveredCombos: [],

  // Perfect hand counter (for card master combo)
  perfectHandCount: 0,
  totalHandsPlayed: 0,

  // Session tracking
  currentShopItems: [],
};

// ============================================================
// PERSISTENCE
// ============================================================

function saveGame() {
  try {
    localStorage.setItem('brokenDeck_state', JSON.stringify(GameState));
  } catch(e) { /* ignore */ }
}

function loadGame() {
  try {
    const saved = localStorage.getItem('brokenDeck_state');
    if (saved) {
      const data = JSON.parse(saved);
      Object.assign(GameState, data);
      return true;
    }
  } catch(e) { /* ignore */ }
  return false;
}

function hasSavedGame() {
  return !!localStorage.getItem('brokenDeck_state');
}

function clearSavedGame() {
  localStorage.removeItem('brokenDeck_state');
}

function saveBestScore() {
  const best = parseInt(localStorage.getItem('brokenDeck_best') || '0');
  if (GameState.score > best) {
    localStorage.setItem('brokenDeck_best', String(GameState.score));
    GameState.bestScore = GameState.score;
  }
}

function loadBestScore() {
  GameState.bestScore = parseInt(localStorage.getItem('brokenDeck_best') || '0');
}

// ============================================================
// GAME INITIALIZATION
// ============================================================

function initGameState() {
  loadBestScore();
}

function resetRun() {
  GameState.round = 1;
  GameState.stage = 1;
  GameState.score = 0;
  GameState.targetScore = 300;
  GameState.coins = 3;
  GameState.lives = 3;
  GameState.activeRules = [];
  GameState.ruleChoicesCount = 3;
  GameState.stability = 100;
  GameState.deck = [];
  GameState.hand = [];
  GameState.discard = [];
  GameState.handSize = 5;
  GameState.playSize = 5;
  GameState.handsPerRound = 4;
  GameState.handsRemaining = 4;
  GameState.drawsRemaining = 2;
  GameState.maxDiscards = 5;
  GameState.mustDiscard = 0;
  GameState.minDiscard = 0;
  GameState.carryOver = 0;
  GameState.blindCards = 0;
  GameState.deckModifiers = {
    extraSuits: [], removedSuits: [], extraValues: [], removedValues: [],
    shrinkPerRound: 0, isBlind: false, addJokers: false, aceValue: 14
  };
  GameState.rankingModifiers = { swaps: [], valueOverrides: {}, straightLength: 5 };
  GameState.scoringModifiers = { suitMultipliers: {}, aceValue: 14, kingValue: 13, queenValue: 20 };
  GameState.inventory = { shield: 0, cancelCard: 0, extraLife: 0 };
  GameState.offeredRules = [];
  GameState.lastHandResult = null;
  GameState.lastHandCards = null;
  GameState.roundScore = 0;
  GameState.runComplete = false;
  GameState.discoveredCombos = [];
  GameState.perfectHandCount = 0;
  GameState.totalHandsPlayed = 0;
  GameState.currentShopItems = [];
}

// ============================================================
// RULE GENERATION
// ============================================================

function generateRuleChoices() {
  const available = getRulesForStage(GameState.stage)
    .filter(r => !GameState.activeRules.includes(r.id));

  if (available.length === 0) return [];

  // Shuffle and take N
  const shuffled = shuffle([...available]);

  // Ensure we have enough
  const count = Math.min(GameState.ruleChoicesCount, shuffled.length);
  GameState.offeredRules = shuffled.slice(0, count);
  return GameState.offeredRules;
}

// ============================================================
// DECK MANAGEMENT
// ============================================================

function rebuildDeck() {
  GameState.deck = shuffle(createDeck(GameState.deckModifiers));
  GameState.discard = [];
}

function dealNewHand() {
  // Carry over cards from previous hand if rule active
  const carried = GameState.carryOver > 0 && GameState.lastHandCards
    ? GameState.lastHandCards.slice(0, GameState.carryOver)
    : [];

  // Refill deck if low
  if (GameState.deck.length < GameState.handSize) {
    const newDeck = shuffle(createDeck(GameState.deckModifiers));
    GameState.deck = [...newDeck, ...GameState.deck];
  }

  const needed = GameState.handSize - carried.length;
  const drawn = drawCards(GameState.deck, needed);

  GameState.hand = [...carried, ...drawn].map((c, i) => ({
    ...c,
    selected: false,
    invalid: false,
    boosted: false,
    locked: false,
    faceDown: i < GameState.blindCards
  }));
}

// Discard selected cards and draw replacements
function discardAndDraw(selectedIds) {
  if (GameState.drawsRemaining <= 0) return false;

  const toDiscard = GameState.hand.filter(c => selectedIds.includes(c.id));
  const toKeep = GameState.hand.filter(c => !selectedIds.includes(c.id));

  // Validate discard count
  const count = toDiscard.length;
  if (count < GameState.minDiscard) return false;
  if (count > GameState.maxDiscards) return false;
  if (GameState.mustDiscard > 0 && count !== GameState.mustDiscard) return false;

  GameState.discard.push(...toDiscard);

  // Refill deck if needed
  if (GameState.deck.length < count) {
    const newDeck = shuffle(createDeck(GameState.deckModifiers));
    GameState.deck = [...newDeck];
  }

  const newCards = drawCards(GameState.deck, count);
  GameState.hand = [...toKeep, ...newCards].map(c => ({
    ...c, selected: false, invalid: false
  }));
  GameState.drawsRemaining--;
  return true;
}

// ============================================================
// HAND SUBMISSION
// ============================================================

function submitHand(selectedIds) {
  const selectedCards = GameState.hand.filter(c => selectedIds.includes(c.id));

  if (selectedCards.length === 0) return null;

  const result = evaluateHand(selectedCards, GameState);

  GameState.lastHandResult = result;
  GameState.lastHandCards = selectedCards;
  GameState.totalHandsPlayed++;

  if (result.valid) {
    GameState.score += result.finalScore;
    GameState.roundScore += result.finalScore;

    // Earn 1 coin per valid hand
    GameState.coins = Math.min(GameState.coins + 1, 20);

    // Check perfect hand (flush or better + all constraints passed)
    if (result.rankIndex >= 5) {
      GameState.perfectHandCount++;
    }
  }

  GameState.handsRemaining--;
  GameState.discard.push(...selectedCards);

  // Remove played cards from hand
  GameState.hand = GameState.hand.filter(c => !selectedIds.includes(c.id));

  saveGame();
  return result;
}

// ============================================================
// STATE TRANSITIONS
// ============================================================

function transitionTo(screenKey) {
  GameState.previousScreen = GameState.screen;
  GameState.screen = screenKey;
  if (typeof renderScreen === 'function') {
    renderScreen(screenKey);
  }
  saveGame();
}

// Title screen → New game
function startNewGame() {
  clearSavedGame();
  resetRun();
  generateRuleChoices();
  transitionTo('rulePick');
}

// Title screen → Continue
function continueGame() {
  if (hasSavedGame()) {
    loadGame();
    transitionTo(GameState.screen);
  } else {
    startNewGame();
  }
}

// Rule pick → pick a rule and go to hand play
function pickRule(ruleId) {
  const rule = getRuleById(ruleId);
  if (!rule) return;

  // Add rule to active list
  GameState.activeRules.push(ruleId);

  // Apply persistent effects
  applyPersistentRule(ruleId, GameState);

  // Recalculate stability
  GameState.stability = calculateStability(GameState.activeRules, GameState);

  // Update stability visual on container
  updateStabilityVisual();

  // Check if game is now impossible
  if (GameState.stability < 5 && GameState.activeRules.length > 1) {
    transitionTo('gameOver');
    return;
  }

  // Rebuild deck and deal hand
  rebuildDeck();
  GameState.handsRemaining = GameState.handsPerRound;
  GameState.drawsRemaining = 2;
  GameState.roundScore = 0;
  dealNewHand();

  transitionTo('handPlay');
}

// Hand play → submit hand
function playHand(selectedIds) {
  const result = submitHand(selectedIds);
  if (!result) return null;

  // Check victory
  if (GameState.score >= GameState.targetScore) {
    saveBestScore();
    transitionTo('victory');
    return result;
  }

  // If hands remain, deal new hand
  if (GameState.handsRemaining > 0) {
    dealNewHand();
    if (typeof renderScreen === 'function') {
      renderScreen('handPlay');
    }
  } else {
    // Round over
    transitionTo('roundSummary');
  }

  return result;
}

// Hand play → discard and redraw
function discardCards(selectedIds) {
  return discardAndDraw(selectedIds);
}

// Round summary → next round
function nextRound() {
  GameState.round++;

  // Stage increases every 3 rounds
  if (GameState.round % 3 === 0) {
    GameState.stage = Math.floor(GameState.round / 3) + 1;
  }

  // Target score scales
  GameState.targetScore = 300 + (GameState.stage - 1) * 200;

  // Every 3 rounds, go to shop
  if (GameState.round % 3 === 0) {
    // Earn coins for completing round
    GameState.coins += 2;
    generateShopItems();
    transitionTo('shop');
  } else {
    generateRuleChoices();
    transitionTo('rulePick');
  }
}

// Shop items
function generateShopItems() {
  GameState.currentShopItems = [
    {
      id: 'shield',
      name_he: 'מגן',
      name_en: 'Shield',
      desc_he: 'מבטל הפרה אחת של חוק בכל יד',
      icon: '🛡️',
      cost: 3,
      type: 'shield'
    },
    {
      id: 'cancelCard',
      name_he: 'ביטול חוק',
      name_en: 'Cancel Rule',
      desc_he: 'מסיר חוק פעיל אחד לצמיתות',
      icon: '✂️',
      cost: 4,
      type: 'cancelCard'
    },
    {
      id: 'extraLife',
      name_he: 'חיים נוספים',
      name_en: 'Extra Life',
      desc_he: 'מוסיף חיים נוספים לריצה',
      icon: '❤️',
      cost: 5,
      type: 'extraLife'
    },
    {
      id: 'scoreBoost',
      name_he: 'הגברת ניקוד',
      name_en: 'Score Boost',
      desc_he: 'מוסיף 50 נקודות מיידית',
      icon: '⚡',
      cost: 2,
      type: 'scoreBoost'
    }
  ];
}

function buyShopItem(itemId) {
  const item = GameState.currentShopItems.find(i => i.id === itemId);
  if (!item) return false;
  if (GameState.coins < item.cost) return false;

  GameState.coins -= item.cost;

  switch(item.type) {
    case 'shield':
      GameState.inventory.shield++;
      break;
    case 'cancelCard':
      GameState.inventory.cancelCard++;
      break;
    case 'extraLife':
      GameState.inventory.extraLife++;
      GameState.lives++;
      break;
    case 'scoreBoost':
      GameState.score += 50;
      break;
  }

  saveGame();
  return true;
}

// Use cancel card (remove a rule)
function useCancelCard(ruleId) {
  if (GameState.inventory.cancelCard <= 0) return false;
  const idx = GameState.activeRules.indexOf(ruleId);
  if (idx === -1) return false;

  GameState.activeRules.splice(idx, 1);
  GameState.inventory.cancelCard--;
  GameState.stability = calculateStability(GameState.activeRules, GameState);
  updateStabilityVisual();
  saveGame();
  return true;
}

// Shop → done → rule pick
function leaveShop() {
  generateRuleChoices();
  transitionTo('rulePick');
}

// Game over → restart
function restartGame() {
  clearSavedGame();
  resetRun();
  transitionTo('title');
}

// Victory → title
function backToTitle() {
  saveBestScore();
  clearSavedGame();
  resetRun();
  transitionTo('title');
}

// ============================================================
// STABILITY VISUAL
// ============================================================

function updateStabilityVisual() {
  const container = document.getElementById('game-container');
  if (!container) return;

  container.classList.remove('stability-warning', 'stability-danger', 'stability-critical');

  const s = GameState.stability;
  if (s < 20) {
    container.classList.add('stability-critical');
    container.style.setProperty('--crack-intensity', String((20 - s) / 20));
  } else if (s < 40) {
    container.classList.add('stability-danger');
    container.style.setProperty('--crack-intensity', String((40 - s) / 40 * 0.6));
  } else if (s < 70) {
    container.classList.add('stability-warning');
    container.style.setProperty('--crack-intensity', '0');
  } else {
    container.style.setProperty('--crack-intensity', '0');
  }
}
