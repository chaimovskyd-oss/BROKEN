// ============================================================
// rules-engine.js — Rule evaluation, scoring, stability
// ============================================================

// ============================================================
// CONSTRAINT EVALUATION (per hand)
// ============================================================

// Evaluate a hand against all active constraint rules
// Returns: { valid, violations, passedConstraints, handProxy, handResult }
function evaluateConstraints(cards, gameState) {
  const handResult = analyzeHand(cards, gameState.rankingModifiers);
  const proxy = buildHandProxy(cards, handResult);

  const violations = [];
  const passedConstraints = [];

  gameState.activeRules.forEach(ruleId => {
    const rule = getRuleById(ruleId);
    if (!rule || rule.category !== 'hand_constraint') return;

    const handler = CONSTRAINT_HANDLERS[ruleId];
    if (!handler) return;

    const passes = handler(proxy);
    if (passes) {
      passedConstraints.push(rule);
    } else {
      violations.push(rule);
    }
  });

  return {
    valid: violations.length === 0,
    violations,
    passedConstraints,
    handProxy: proxy,
    handResult
  };
}

// ============================================================
// SCORE CALCULATION (per hand)
// ============================================================

// Apply all score_modifier rules to compute final score
// Returns: { baseScore, finalScore, multiplier, bonus, breakdown[] }
function calculateScore(cards, gameState, constraintResult) {
  const { handResult, valid } = constraintResult;

  let baseScore = handResult.baseScore;
  let multiplier = 1.0;
  let bonus = 0;
  const breakdown = [];

  // Apply base score overrides from hand_type rules
  gameState.activeRules.forEach(ruleId => {
    const rule = getRuleById(ruleId);
    if (!rule || rule.category !== 'score_modifier') return;

    const dt = rule.description_technical;

    // hand_type overrides
    if (dt === 'pair.baseScore=50' && handResult.rank === 'pair') {
      baseScore = 50; breakdown.push({ label: rule.name_he, type: 'override', value: 50 });
    }
    if (dt === 'highCard.baseScore=25' && handResult.rank === 'highCard') {
      baseScore = 25; breakdown.push({ label: rule.name_he, type: 'override', value: 25 });
    }
  });

  let score = baseScore;

  // Apply all active rule multipliers (from constraint rules that passed)
  constraintResult.passedConstraints.forEach(rule => {
    if (rule.multiplier && rule.multiplier !== 1.0) {
      multiplier *= rule.multiplier;
      breakdown.push({ label: rule.name_he, type: 'multiplier', value: rule.multiplier });
    }
  });

  // Apply score_modifier rules
  gameState.activeRules.forEach(ruleId => {
    const rule = getRuleById(ruleId);
    if (!rule || rule.category !== 'score_modifier') return;

    const dt = rule.description_technical;
    const h = constraintResult.handProxy;
    const hr = handResult;

    // Suit multipliers
    if (dt.match(/^hearts\.multiplier=(\d+\.?\d*)$/)) {
      const m = parseFloat(dt.match(/=(\d+\.?\d*)$/)[1]);
      const heartCount = (hr.suitCounts['hearts'] || 0);
      if (heartCount > 0) { multiplier *= m; breakdown.push({ label: rule.name_he, type: 'multiplier', value: m }); }
    }
    else if (dt.match(/^spades\.multiplier=(\d+\.?\d*)$/)) {
      const m = parseFloat(dt.match(/=(\d+\.?\d*)$/)[1]);
      if ((hr.suitCounts['spades'] || 0) > 0) { multiplier *= m; breakdown.push({ label: rule.name_he, type: 'multiplier', value: m }); }
    }
    else if (dt.match(/^diamonds\.multiplier=(\d+\.?\d*)$/)) {
      const m = parseFloat(dt.match(/=(\d+\.?\d*)$/)[1]);
      if ((hr.suitCounts['diamonds'] || 0) > 0) { multiplier *= m; breakdown.push({ label: rule.name_he, type: 'multiplier', value: m }); }
    }
    else if (dt.match(/^clubs\.multiplier=(\d+\.?\d*)$/)) {
      const m = parseFloat(dt.match(/=(\d+\.?\d*)$/)[1]);
      if ((hr.suitCounts['clubs'] || 0) > 0) { multiplier *= m; breakdown.push({ label: rule.name_he, type: 'multiplier', value: m }); }
    }
    // Suit value=0
    else if (dt === 'hearts.value=0') {
      const penaltyCards = cards.filter(c => c.suit === 'hearts');
      score -= penaltyCards.reduce((sum, c) => sum + c.value, 0);
      breakdown.push({ label: rule.name_he, type: 'penalty', value: 0 });
    }
    else if (dt === 'spades.value=0') {
      const penaltyCards = cards.filter(c => c.suit === 'spades');
      score -= penaltyCards.reduce((sum, c) => sum + c.value, 0);
    }
    // Dominant suit multiplier
    else if (dt === 'dominantSuit.multiplier=3') {
      const maxCount = Math.max(...Object.values(hr.suitCounts));
      if (maxCount >= 2) { multiplier *= 3; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 3 }); }
    }
    // Single suit hand
    else if (dt === 'if(suitCount==1) multiplier*=5') {
      if (hr.suitCount === 1) { multiplier *= 5; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 5 }); }
    }
    // Value modifications (affect card values for scoring)
    else if (dt === 'evenCards.multiplier=1.5') {
      const evenCount = cards.filter(c => c.value % 2 === 0).length;
      if (evenCount > 0) { multiplier *= 1.5; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 1.5 }); }
    }
    else if (dt === 'oddCards.multiplier=1.5') {
      const oddCount = cards.filter(c => c.value % 2 === 1).length;
      if (oddCount > 0) { multiplier *= 1.5; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 1.5 }); }
    }
    else if (dt === 'lowCards.multiplier=2') {
      const lowCount = cards.filter(c => c.value >= 2 && c.value <= 5).length;
      if (lowCount > 0) { multiplier *= 2; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 2 }); }
    }
    else if (dt === 'highCards.multiplier=2') {
      const highCount = cards.filter(c => c.value >= 11).length;
      if (highCount > 0) { multiplier *= 2; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 2 }); }
    }
    else if (dt === 'card7.value=77') {
      const sevens = cards.filter(c => c.value === 7).length;
      bonus += sevens * 70; // 77 - 7 = extra 70
      breakdown.push({ label: rule.name_he, type: 'bonus', value: sevens * 70 });
    }
    else if (dt === 'card2.value=-10') {
      const twos = cards.filter(c => c.value === 2).length;
      score -= twos * 12; // -10 - 2 = extra -12
      breakdown.push({ label: rule.name_he, type: 'penalty', value: -(twos * 12) });
    }
    else if (dt === 'maxCard.multiplier=3') {
      multiplier *= 3;
      breakdown.push({ label: rule.name_he, type: 'multiplier', value: 3 });
    }
    else if (dt === 'minCard.value=0') {
      score -= hr.valueMin;
    }
    // Hand type multipliers
    else if (dt === 'threeKind.multiplier=2' && (hr.rank === 'three' || hr.isThree)) {
      multiplier *= 2; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 2 });
    }
    else if (dt === 'fullHouse.multiplier=3' && hr.rank === 'fullHouse') {
      multiplier *= 3; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 3 });
    }
    else if (dt === 'straightFlush.multiplier=5' && (hr.rank === 'straightFlush' || hr.rank === 'royalFlush')) {
      multiplier *= 5; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 5 });
    }
    else if (dt === 'fourKind.multiplier=4' && hr.rank === 'four') {
      multiplier *= 4; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 4 });
    }
    // Combo bonuses
    else if (dt === 'if(suitCount==4) bonus+=100') {
      if (hr.suitCount === 4) { bonus += 100; breakdown.push({ label: rule.name_he, type: 'bonus', value: 100 }); }
    }
    else if (dt === 'if(hasRun(3)) bonus+=50') {
      if (h.hasRun(3)) { bonus += 50; breakdown.push({ label: rule.name_he, type: 'bonus', value: 50 }); }
    }
    else if (dt === 'if(meetsAllConstraints&&handType>=FLUSH) bonus+=200') {
      if (valid && hr.rankIndex >= 5) { bonus += 200; breakdown.push({ label: rule.name_he, type: 'bonus', value: 200 }); }
    }
    else if (dt === 'multiplier+=activeRules.length*0.05') {
      const extra = gameState.activeRules.length * 0.05;
      multiplier += extra; breakdown.push({ label: rule.name_he, type: 'multiplier', value: extra });
    }
    else if (dt === 'if(stability<30) multiplier*=2') {
      if (gameState.stability < 30) { multiplier *= 2; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 2 }); }
    }
    else if (dt === 'if(validHandPct<5) multiplier*=3') {
      if (gameState.stability < 5) { multiplier *= 3; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 3 }); }
    }
    else if (dt === 'if(activeRules>=5) multiplier*=1.3') {
      if (gameState.activeRules.length >= 5) { multiplier *= 1.3; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 1.3 }); }
    }
    else if (dt === 'if(activeRules>=10) multiplier*=1.5') {
      if (gameState.activeRules.length >= 10) { multiplier *= 1.5; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 1.5 }); }
    }
    // Penalties
    else if (dt === 'redCards.forEach(c=>score-=5)') {
      const redCount = cards.filter(c => c.color === 'red').length;
      score -= redCount * 5; breakdown.push({ label: rule.name_he, type: 'penalty', value: -(redCount * 5) });
    }
    else if (dt === 'duplicates.forEach(()=>score-=10)') {
      const dupCount = Object.values(hr.valueCounts).filter(f => f > 1).reduce((s, f) => s + (f - 1), 0);
      score -= dupCount * 10; breakdown.push({ label: rule.name_he, type: 'penalty', value: -(dupCount * 10) });
    }
    else if (dt === 'faceCards.forEach(()=>score-=15)') {
      const faceCount = cards.filter(c => c.value >= 11 && c.value <= 13).length;
      score -= faceCount * 15; breakdown.push({ label: rule.name_he, type: 'penalty', value: -(faceCount * 15) });
    }
    else if (dt === 'if(handType==HIGH_CARD) score-=50') {
      if (hr.rank === 'highCard') { score -= 50; breakdown.push({ label: rule.name_he, type: 'penalty', value: -50 }); }
    }
    else if (dt === 'if(suitCount==1) score/=2') {
      if (hr.suitCount === 1) { score = Math.floor(score / 2); breakdown.push({ label: rule.name_he, type: 'penalty', value: '÷2' }); }
    }
    else if (dt === 'handRank=MAX_RANK-handRank') {
      // Invert scoring: royal flush becomes high card etc.
      const MAX_RANK = 9;
      const newRankIndex = MAX_RANK - hr.rankIndex;
      const allRanks = ['highCard','pair','twoPair','three','straight','flush','fullHouse','four','straightFlush','royalFlush'];
      const invertedRank = allRanks[Math.max(0, Math.min(9, newRankIndex))];
      const BASE_SCORES_REF = { highCard:5, pair:10, twoPair:25, three:40, straight:60, flush:70, fullHouse:90, four:120, straightFlush:200, royalFlush:500 };
      score = BASE_SCORES_REF[invertedRank] || 5;
      breakdown.push({ label: rule.name_he, type: 'special', value: 'inverted' });
    }
    else if (dt === 'multiplier*=random(0.5,2)') {
      const rand = 0.5 + Math.random() * 1.5;
      multiplier *= rand; breakdown.push({ label: rule.name_he, type: 'multiplier', value: rand.toFixed(2) + 'x (rnd)' });
    }
    else if (dt === 'score=activeRules*baseHandScore') {
      score = gameState.activeRules.length * hr.baseScore;
      breakdown.push({ label: rule.name_he, type: 'special', value: score });
    }
    else if (dt === 'if(isPrime(sum)) score*=2') {
      if (isPrime(hr.valueSum)) { score *= 2; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 2 }); }
    }
    else if (dt === 'multiplier*=(10-hand.size())') {
      const m = Math.max(1, 10 - cards.length);
      multiplier *= m; breakdown.push({ label: rule.name_he, type: 'multiplier', value: m });
    }
    else if (dt === 'if(allDiff) highCard.multiplier=3') {
      if (hr.allDiffValues && hr.rank === 'highCard') { multiplier *= 3; breakdown.push({ label: rule.name_he, type: 'multiplier', value: 3 }); }
    }
  });

  const finalScore = Math.max(0, Math.round((score + bonus) * multiplier));

  return { baseScore, finalScore, multiplier, bonus, breakdown };
}

// Full hand evaluation: constraints + scoring
function evaluateHand(cards, gameState) {
  const constraintResult = evaluateConstraints(cards, gameState);
  const scoreResult = calculateScore(cards, gameState, constraintResult);

  return {
    ...constraintResult,
    ...scoreResult
  };
}

// ============================================================
// STABILITY CALCULATION (Monte Carlo)
// ============================================================

// Check if set of constraint rules is at all satisfiable
// Returns 0-100 stability percentage
function calculateStability(activeRuleIds, gameState) {
  const SAMPLES = 500; // balance speed vs accuracy
  const constraintRuleIds = activeRuleIds.filter(id => {
    const rule = getRuleById(id);
    return rule && rule.category === 'hand_constraint';
  });

  if (constraintRuleIds.length === 0) return 100;

  // Build simulated deck
  const deck = shuffle(createDeck(gameState.deckModifiers));
  const playSize = gameState.playSize || 5;

  let passing = 0;

  for (let i = 0; i < SAMPLES; i++) {
    // Random hand from deck (sample without replacement from full deck)
    const deckCopy = shuffle(createDeck(gameState.deckModifiers));
    const hand = deckCopy.slice(0, playSize);

    // Check all constraints
    const handResult = analyzeHand(hand, gameState.rankingModifiers);
    const proxy = buildHandProxy(hand, handResult);

    let allPass = true;
    for (const ruleId of constraintRuleIds) {
      const handler = CONSTRAINT_HANDLERS[ruleId];
      if (handler && !handler(proxy)) {
        allPass = false;
        break;
      }
    }

    if (allPass) passing++;
  }

  return Math.round((passing / SAMPLES) * 100);
}

// Calculate stability delta if a rule were added
function calculateStabilityDelta(ruleId, gameState) {
  const testRules = [...gameState.activeRules, ruleId];
  const newStability = calculateStability(testRules, gameState);
  return newStability - gameState.stability;
}

// ============================================================
// PERSISTENT RULE APPLICATION
// ============================================================

// Apply a rule's persistent effects to gameState (mutates gameState)
// Called when a rule is added (rule pick screen)
function applyPersistentRule(ruleId, gameState) {
  const rule = getRuleById(ruleId);
  if (!rule) return;

  const dt = rule.description_technical;

  if (rule.category === 'structure') {
    // Draw/play sizes
    const drawMatch = dt.match(/drawSize=(\d+),playSize=(\d+)/);
    if (drawMatch) {
      gameState.handSize = parseInt(drawMatch[1]);
      gameState.playSize = parseInt(drawMatch[2]);
      return;
    }

    // Discard limits
    const discardMatch = dt.match(/maxDiscards=(\d+)/);
    if (discardMatch) {
      gameState.maxDiscards = parseInt(discardMatch[1]);
      return;
    }
    const mustDiscardMatch = dt.match(/mustDiscard=(\d+)/);
    if (mustDiscardMatch) {
      gameState.mustDiscard = parseInt(mustDiscardMatch[1]);
      return;
    }
    const minDiscardMatch = dt.match(/minDiscard=(\d+)/);
    if (minDiscardMatch) {
      gameState.minDiscard = parseInt(minDiscardMatch[1]);
      return;
    }

    // Hands per round
    const handsMatch = dt.match(/handsPerRound=(\d+)/);
    if (handsMatch) {
      gameState.handsPerRound = parseInt(handsMatch[1]);
      gameState.handsRemaining = gameState.handsPerRound;
      return;
    }

    // Carry over cards
    const carryMatch = dt.match(/carryOver=(\d+)/);
    if (carryMatch) {
      gameState.carryOver = parseInt(carryMatch[1]);
      return;
    }

    // Blind cards
    const blindMatch = dt.match(/blindCards=(\d+)/);
    if (blindMatch) {
      gameState.blindCards = parseInt(blindMatch[1]);
      return;
    }
  }

  // hand_constraint/hand_size rules also update playSize
  if (rule.category === 'hand_constraint' && rule.subcategory === 'hand_size') {
    const eqMatch = dt.match(/hand\.size\(\)==(\d+)/);
    if (eqMatch) {
      const size = parseInt(eqMatch[1]);
      gameState.playSize = size;
      if (gameState.handSize < size + 2) gameState.handSize = size + 2;
      return;
    }
    const geMatch = dt.match(/hand\.size\(\)>=(\d+)/);
    if (geMatch) {
      const size = parseInt(geMatch[1]);
      gameState.playSize = size;
      if (gameState.handSize < size + 2) gameState.handSize = size + 2;
      return;
    }
    const leMatch = dt.match(/hand\.size\(\)<=(\d+)/);
    if (leMatch) {
      const size = parseInt(leMatch[1]);
      gameState.playSize = Math.min(gameState.playSize, size);
      return;
    }
  }

  if (rule.category === 'deck_mutation') {
    // Handle deck mutations
    if (dt.includes('removeSuit=')) {
      const suit = dt.match(/removeSuit='?(\w+)'?/)?.[1];
      if (suit && !gameState.deckModifiers.removedSuits.includes(suit)) {
        gameState.deckModifiers.removedSuits.push(suit);
      }
    }
    if (dt.includes('addSuit=') || dt.includes('extraSuit=')) {
      const suit = dt.match(/(?:addSuit|extraSuit)='?(\w+)'?/)?.[1];
      if (suit && !gameState.deckModifiers.extraSuits.includes(suit)) {
        gameState.deckModifiers.extraSuits.push(suit);
      }
    }
    if (dt === 'addJokers=true') {
      gameState.deckModifiers.addJokers = true;
    }
  }

  if (rule.category === 'chaos') {
    // Hand rank swaps
    const swapMatch = dt.match(/swap\('?(\w+)'?,\s*'?(\w+)'?\)/);
    if (swapMatch) {
      gameState.rankingModifiers.swaps.push([swapMatch[1], swapMatch[2]]);
      return;
    }
    // Straight length
    if (dt.includes('straightLength=')) {
      const len = parseInt(dt.match(/straightLength=(\d+)/)?.[1]);
      if (len) gameState.rankingModifiers.straightLength = len;
      return;
    }
    // Rule choices count
    if (dt.includes('ruleChoices=')) {
      const count = parseInt(dt.match(/ruleChoices=(\d+)/)?.[1]);
      if (count) gameState.ruleChoicesCount = count;
      return;
    }
  }

  if (rule.category === 'score_modifier') {
    // Ace value override
    if (dt === 'ace.value=1') { gameState.scoringModifiers.aceValue = 1; return; }
    if (dt === 'ace.value=15') { gameState.scoringModifiers.aceValue = 15; return; }
    if (dt === 'king.value=0') { gameState.scoringModifiers.kingValue = 0; return; }
    if (dt === 'queen.value=20') { gameState.scoringModifiers.queenValue = 20; return; }
    // hand_type rank swaps
    if (dt === 'twoPair.rank>threeKind.rank') {
      gameState.rankingModifiers.swaps.push(['twoPair', 'three']);
    }
    if (dt === 'flush.rank<straight.rank') {
      gameState.rankingModifiers.swaps.push(['flush', 'straight']);
    }
  }
}

// ============================================================
// UTILITY
// ============================================================

function isPrime(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}
