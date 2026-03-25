// ============================================================
// cards.js — Card creation, deck management, hand analysis
// ============================================================

// Create a Card object from an ID string like 'AC', 'KH', etc.
function createCard(id, deckModifiers) {
  const valueChar = id.slice(0, -1); // all but last char
  const suitChar = id.slice(-1);

  const aceValue = (deckModifiers && deckModifiers.aceValue) || 14;
  let value = VALUE_MAP[valueChar];
  if (valueChar === 'A') value = aceValue;

  const suit = SUIT_MAP[suitChar] || 'clubs';
  const color = SUIT_COLOR[suit] || 'black';

  return {
    id,
    value,
    suit,
    color,
    svgPath: `קלפים/${id}.svg`,
    // runtime state
    selected: false,
    invalid: false,
    boosted: false,
    locked: false,
    faceDown: false
  };
}

// Build a standard deck of Card objects, respecting deckModifiers
function createDeck(deckModifiers) {
  deckModifiers = deckModifiers || {};
  const removedSuits = deckModifiers.removedSuits || [];
  const removedValues = deckModifiers.removedValues || [];
  const extraSuits = deckModifiers.extraSuits || [];
  const extraValues = deckModifiers.extraValues || [];
  const addJokers = deckModifiers.addJokers || false;

  let cards = [];

  // Standard 52 cards
  STANDARD_CARD_IDS.forEach(id => {
    const suitChar = id.slice(-1);
    const valueChar = id.slice(0, -1);
    const suit = SUIT_MAP[suitChar];
    const value = VALUE_MAP[valueChar];

    if (removedSuits.includes(suit)) return;
    if (removedValues.includes(value)) return;

    cards.push(createCard(id, deckModifiers));
  });

  // Extra value cards (use existing suits)
  extraValues.forEach(extraVal => {
    ['C','D','H','S'].forEach(suitChar => {
      const suit = SUIT_MAP[suitChar];
      if (removedSuits.includes(suit)) return;
      const fakeId = `E${suitChar}`; // reuse E prefix
      const card = createCard(fakeId, deckModifiers);
      card.value = extraVal;
      cards.push(card);
    });
  });

  // Jokers if added
  if (addJokers) {
    JOKER_IDS.forEach(id => cards.push(createCard(id, deckModifiers)));
  }

  return cards;
}

// Fisher-Yates shuffle (mutates array in-place, also returns it)
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Draw N cards from deck (mutates deck array)
function drawCards(deck, n) {
  const drawn = [];
  for (let i = 0; i < n && deck.length > 0; i++) {
    drawn.push(deck.pop());
  }
  return drawn;
}

// ============================================================
// HAND ANALYSIS
// ============================================================

// Check if sorted values contain a consecutive run of length n
function hasConsecutiveRun(sortedValues, n) {
  if (sortedValues.length < n) return false;
  let runLen = 1;
  for (let i = 1; i < sortedValues.length; i++) {
    if (sortedValues[i] === sortedValues[i-1] + 1) {
      runLen++;
      if (runLen >= n) return true;
    } else if (sortedValues[i] !== sortedValues[i-1]) {
      runLen = 1;
    }
  }
  return false;
}

// Check if values form a straight (consecutive sequence)
function checkStraight(sortedUniqValues, length) {
  if (sortedUniqValues.length < length) return false;

  // Normal straight
  for (let start = 0; start <= sortedUniqValues.length - length; start++) {
    let ok = true;
    for (let j = 1; j < length; j++) {
      if (sortedUniqValues[start + j] !== sortedUniqValues[start] + j) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }

  // Wheel straight: A-2-3-4-5 (ace = 1)
  if (length === 5 && sortedUniqValues.includes(14)) {
    const withLowAce = [1, ...sortedUniqValues.filter(v => v !== 14)].sort((a,b) => a-b);
    for (let start = 0; start <= withLowAce.length - length; start++) {
      let ok = true;
      for (let j = 1; j < length; j++) {
        if (withLowAce[start + j] !== withLowAce[start] + j) { ok = false; break; }
      }
      if (ok) return true;
    }
  }

  return false;
}

// Analyze a hand of Card objects and return a HandResult
// rankingModifiers: { swaps: [], valueOverrides: {}, straightLength: 5 }
function analyzeHand(cards, rankingModifiers) {
  rankingModifiers = rankingModifiers || {};
  const straightLength = rankingModifiers.straightLength || 5;

  if (!cards || cards.length === 0) {
    return { rank: 'highCard', rankIndex: 0, baseScore: 5, cards: [], isFlush: false, isStraight: false,
      isPair: false, isTwoPair: false, isThree: false, isFullHouse: false, isFour: false,
      isStraightFlush: false, isRoyalFlush: false, highCard: 0,
      suitCounts: {}, valueCounts: {}, valueSum: 0, valueMin: 0, valueMax: 0,
      suitCount: 0, allDiffValues: true };
  }

  // Build frequency maps
  const valueCounts = {};
  const suitCounts = {};
  let valueSum = 0;

  cards.forEach(c => {
    valueCounts[c.value] = (valueCounts[c.value] || 0) + 1;
    suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
    valueSum += c.value;
  });

  const values = cards.map(c => c.value);
  const sortedValues = [...values].sort((a, b) => a - b);
  const uniqueValues = [...new Set(sortedValues)];
  const freqs = Object.values(valueCounts).sort((a, b) => b - a);
  const suitCountValues = Object.values(suitCounts);
  const numSuits = Object.keys(suitCounts).length;

  const valueMin = sortedValues[0];
  const valueMax = sortedValues[sortedValues.length - 1];
  const allDiffValues = uniqueValues.length === cards.length;

  // Detect hand types
  const isFlush = numSuits === 1;
  const isStraight = checkStraight(uniqueValues, straightLength);

  const hasFour = freqs[0] >= 4;
  const hasThreeOfKind = freqs[0] >= 3;
  // numPairs: values appearing exactly 2 times (for full house / two pair detection)
  const exactPairCount = Object.values(valueCounts).filter(f => f === 2).length;
  // anyPair: any value appearing >= 2 times (for constraint hasPair())
  const anyPairCount = Object.values(valueCounts).filter(f => f >= 2).length;
  const hasThree = hasThreeOfKind;
  // For RANK: pair means at least one exact pair
  const hasPair = anyPairCount >= 1;
  const hasTwoPair = exactPairCount >= 2 || (exactPairCount >= 1 && hasThreeOfKind);
  // Full house: a triple AND a separate pair of a different value
  const hasFullHouse = hasThreeOfKind && exactPairCount >= 1 && !hasFour;
  const hasFourOfKind = hasFour;

  // Royal flush: straight flush with T-J-Q-K-A
  const isRoyalFlush = isFlush && isStraight &&
    sortedValues.includes(10) && sortedValues.includes(14) && straightLength === 5;
  const isStraightFlush = isFlush && isStraight && !isRoyalFlush;

  // Hand rank priority (default order, can be swapped by rankingModifiers)
  let rankOrder = [
    'highCard', 'pair', 'twoPair', 'three', 'straight',
    'flush', 'fullHouse', 'four', 'straightFlush', 'royalFlush'
  ];

  // Apply swaps from rankingModifiers
  if (rankingModifiers.swaps) {
    rankingModifiers.swaps.forEach(([a, b]) => {
      const ia = rankOrder.indexOf(a);
      const ib = rankOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) {
        [rankOrder[ia], rankOrder[ib]] = [rankOrder[ib], rankOrder[ia]];
      }
    });
  }

  // Determine best rank
  let rank = 'highCard';
  if (hasPair) rank = 'pair';
  if (hasTwoPair) rank = 'twoPair';
  if (hasThree && !hasFullHouse) rank = 'three';
  if (isStraight && !isFlush) rank = 'straight';
  if (isFlush && !isStraight) rank = 'flush';
  if (hasFullHouse) rank = 'fullHouse';
  if (hasFourOfKind) rank = 'four';
  if (isStraightFlush) rank = 'straightFlush';
  if (isRoyalFlush) rank = 'royalFlush';

  const BASE_SCORES = {
    highCard: 5, pair: 10, twoPair: 25, three: 40, straight: 60,
    flush: 70, fullHouse: 90, four: 120, straightFlush: 200, royalFlush: 500
  };

  const rankIndex = rankOrder.indexOf(rank);
  const baseScore = BASE_SCORES[rank] || 5;

  return {
    rank,
    rankIndex,
    baseScore,
    cards,
    isFlush,
    isStraight,
    isPair: hasPair,
    isTwoPair: hasTwoPair,
    isThree: hasThree,
    isFullHouse: hasFullHouse,
    isFour: hasFourOfKind,
    isStraightFlush,
    isRoyalFlush,
    highCard: valueMax,
    suitCounts,
    valueCounts,
    valueSum,
    valueMin,
    valueMax,
    suitCount: numSuits,
    allDiffValues,
    sortedValues,
    uniqueValues
  };
}

// Build HandProxy — provides the DSL interface that constraint handlers call
function buildHandProxy(cards, handResult) {
  return {
    hasPair: () => handResult.isPair,
    hasTwoPair: () => handResult.isTwoPair,
    hasThree: () => handResult.isThree,
    hasFour: () => handResult.isFour,
    hasFullHouse: () => handResult.isFullHouse,
    isStraight: () => handResult.isStraight,
    isFlush: () => handResult.isFlush,
    hasColor: (color) => cards.some(c => c.color === color),
    any: (pred) => cards.some(pred),
    none: (pred) => !cards.some(pred),
    all: (pred) => cards.every(pred),
    sum: () => handResult.valueSum,
    size: () => cards.length,
    suitCount: () => handResult.suitCount,
    maxSuitCount: () => Math.max(0, ...Object.values(handResult.suitCounts)),
    allDiffValues: () => handResult.allDiffValues,
    hasRun: (n) => hasConsecutiveRun(handResult.sortedValues, n),
    maxValue: () => handResult.valueMax,
    minValue: () => handResult.valueMin
  };
}

// Self-tests (run in console on startup to validate hand detection)
function runCardTests() {
  const testHand = (ids, expectedRank) => {
    const cards = ids.map(id => createCard(id));
    const result = analyzeHand(cards);
    const pass = result.rank === expectedRank;
    if (!pass) console.error(`FAIL: ${ids.join(',')} expected ${expectedRank} got ${result.rank}`);
    return pass;
  };

  let passed = 0, total = 0;
  const test = (ids, rank) => { total++; if (testHand(ids, rank)) passed++; };

  test(['AC','AD','AH','AS','KC'], 'four');        // Four of a kind
  test(['AC','AD','AH','KC','KD'], 'fullHouse');   // Full house
  test(['2C','4C','6C','8C','TC'], 'flush');        // Flush
  test(['2C','3D','4H','5S','6C'], 'straight');     // Straight
  test(['AC','AD','AH','KC','QD'], 'three');        // Three of a kind
  test(['AC','AD','KC','KD','2C'], 'twoPair');      // Two pair
  test(['AC','AD','KC','QD','JC'], 'pair');         // Pair
  test(['AC','KC','QD','JC','9H'], 'highCard');     // High card
  test(['TC','JC','QC','KC','AC'], 'royalFlush');  // Royal flush
  test(['2C','3C','4C','5C','6C'], 'straightFlush'); // Straight flush

  console.log(`Card tests: ${passed}/${total} passed`);
}
