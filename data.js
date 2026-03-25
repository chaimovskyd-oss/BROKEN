// ============================================================
// data.js — Card definitions, rule loading, constraint handlers
// ============================================================

// Maps filename letter → numeric value
const VALUE_MAP = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  '0': 0,   // Joker
  'E': 15   // Extended/special
};

// Maps filename letter → suit name
const SUIT_MAP = {
  'C': 'clubs',
  'D': 'diamonds',
  'H': 'hearts',
  'S': 'spades'
};

// Maps suit → color
const SUIT_COLOR = {
  'clubs': 'black',
  'spades': 'black',
  'hearts': 'red',
  'diamonds': 'red'
};

// All standard card IDs (value+suit combos that represent real playable cards)
const STANDARD_CARD_IDS = [
  '2C','2D','2H','2S',
  '3C','3D','3H','3S',
  '4C','4D','4H','4S',
  '5C','5D','5H','5S',
  '6C','6D','6H','6S',
  '7C','7D','7H','7S',
  '8C','8D','8H','8S',
  '9C','9D','9H','9S',
  'TC','TD','TH','TS',
  'JC','JD','JH','JS',
  'QC','QD','QH','QS',
  'KC','KD','KH','KS',
  'AC','AD','AH','AS'
];

// Joker IDs
const JOKER_IDS = ['0C','0D','0H','0S'];

// Extended card IDs
const EXTENDED_IDS = ['EC','ED','EH','ES'];

// Back card IDs (for display only, not dealt)
const BACK_IDS = ['1B','2B'];

// Global rules storage
let RULES_MAP = new Map(); // id → rule object
let RULES_ARRAY = [];

// Load rules from JSON file
async function loadRules() {
  try {
    const response = await fetch('broken_deck_rules.json');
    if (!response.ok) throw new Error('fetch failed');
    const data = await response.json();
    RULES_ARRAY = data.rules;
    RULES_ARRAY.forEach(r => RULES_MAP.set(r.id, r));
    console.log(`Loaded ${RULES_ARRAY.length} rules`);
    return true;
  } catch (e) {
    console.warn('Could not fetch rules JSON. Make sure to run from an HTTP server.');
    // Fallback: empty rules for development
    RULES_ARRAY = [];
    return false;
  }
}

function getRuleById(id) {
  return RULES_MAP.get(id) || null;
}

function getRulesForStage(stage) {
  return RULES_ARRAY.filter(r => r.stage_min <= stage && r.stage_max >= stage);
}

// ============================================================
// CONSTRAINT HANDLERS
// Maps description_technical string → function(handProxy) → boolean
// ============================================================

// Helper: parse parameterized patterns
function parseConstraintExpression(expr) {
  // Static map for known exact expressions
  const STATIC = {
    // must_have
    'hand.hasPair()==true':         h => h.hasPair(),
    'hand.hasTwoPair()==true':      h => h.hasTwoPair(),
    'hand.hasThree()==true':        h => h.hasThree(),
    'hand.hasFour()==true':         h => h.hasFour(),
    'hand.hasFullHouse()==true':    h => h.hasFullHouse(),
    'hand.isStraight()==true':      h => h.isStraight(),
    'hand.isFlush()==true':         h => h.isFlush(),
    "hand.isStraight()&&hand.isFlush()": h => h.isStraight() && h.isFlush(),
    "hand.hasColor('red')":         h => h.hasColor('red'),
    "hand.hasColor('black')":       h => h.hasColor('black'),
    'hand.any(c=>c.value>10)':      h => h.any(c => c.value > 10),
    'hand.any(c=>c.value>=2&&c.value<=5)': h => h.any(c => c.value >= 2 && c.value <= 5),
    'hand.any(c=>c.value==14)':     h => h.any(c => c.value === 14),
    'hand.any(c=>c.value>=11&&c.value<=13)': h => h.any(c => c.value >= 11 && c.value <= 13),
    'hand.suitCount()==1':          h => h.suitCount() === 1,
    'hand.suitCount()==4':          h => h.suitCount() === 4,
    'hand.suitCount()>=3':          h => h.suitCount() >= 3,
    'hand.suitCount()>=2':          h => h.suitCount() >= 2,
    'hand.all(c=>c.value%2==0)':    h => h.all(c => c.value % 2 === 0),
    'hand.all(c=>c.value%2==1)':    h => h.all(c => c.value % 2 === 1),
    'hand.sum()>35':                h => h.sum() > 35,
    'hand.sum()<25':                h => h.sum() < 25,
    'hand.sum()%2==0':              h => h.sum() % 2 === 0,
    'hand.hasRun(3)':               h => h.hasRun(3),
    'hand.hasRun(2)':               h => h.hasRun(2),
    // forbidden
    'hand.hasPair()==false':        h => !h.hasPair(),
    'hand.hasThree()==false':       h => !h.hasThree(),
    'hand.isStraight()==false':     h => !h.isStraight(),
    'hand.isFlush()==false':        h => !h.isFlush(),
    "hand.none(c=>c.suit=='hearts')":   h => h.none(c => c.suit === 'hearts'),
    "hand.none(c=>c.suit=='spades')":   h => h.none(c => c.suit === 'spades'),
    "hand.none(c=>c.suit=='diamonds')": h => h.none(c => c.suit === 'diamonds'),
    "hand.none(c=>c.suit=='clubs')":    h => h.none(c => c.suit === 'clubs'),
    'hand.all(c=>c.value<=10)':     h => h.all(c => c.value <= 10),
    'hand.all(c=>c.value>=6)':      h => h.all(c => c.value >= 6),
    'hand.none(c=>c.value==14)':    h => h.none(c => c.value === 14),
    'hand.all(c=>c.value<11||c.value>13)': h => h.all(c => c.value < 11 || c.value > 13),
    "hand.all(c=>c.color=='black')": h => h.all(c => c.color === 'black'),
    "hand.all(c=>c.color=='red')":   h => h.all(c => c.color === 'red'),
    'hand.maxSuitCount()<=1':       h => h.maxSuitCount() <= 1,
    'hand.allDiffValues()':         h => h.allDiffValues(),
    'hand.none(c=>[2,3,5,7,11,13].includes(c.value))': h => h.none(c => [2,3,5,7,11,13].includes(c.value)),
    'hand.none(c=>c.value==13)':    h => h.none(c => c.value === 13),
    'hand.none(c=>c.value==12)':    h => h.none(c => c.value === 12),
    // hand_size
    'hand.size()==4':               h => h.size() === 4,
    'hand.size()==3':               h => h.size() === 3,
    'hand.size()==6':               h => h.size() === 6,
    'hand.size()>=6':               h => h.size() >= 6,
    'hand.size()<=4':               h => h.size() <= 4,
    // range
    'hand.all(c=>c.value>=2&&c.value<=7)': h => h.all(c => c.value >= 2 && c.value <= 7),
    'hand.all(c=>c.value>=8)':      h => h.all(c => c.value >= 8),
    'hand.all(c=>c.value>=5&&c.value<=10)': h => h.all(c => c.value >= 5 && c.value <= 10),
    'hand.maxValue()-hand.minValue()<=4':   h => h.maxValue() - h.minValue() <= 4,
    'hand.maxValue()-hand.minValue()>=8':   h => h.maxValue() - h.minValue() >= 8,
    // extra patterns found in rules
    'hand.sum()%3==0':              h => h.sum() % 3 === 0,
    'hand.sum()%5==0':              h => h.sum() % 5 === 0,
    'hand.maxSuitCount()<=2':       h => h.maxSuitCount() <= 2,
    'hand.none(c=>c.isJoker)':      h => h.none(c => c.value === 0),
  };

  if (STATIC[expr]) return STATIC[expr];

  // Dynamic pattern: hand.any(c=>c.value==N) or hand.none(c=>c.value==N)
  let m;
  m = expr.match(/^hand\.any\(c=>c\.value==(\d+)\)$/);
  if (m) { const v = parseInt(m[1]); return h => h.any(c => c.value === v); }

  m = expr.match(/^hand\.none\(c=>c\.value==(\d+)\)$/);
  if (m) { const v = parseInt(m[1]); return h => h.none(c => c.value === v); }

  m = expr.match(/^hand\.all\(c=>c\.value>=(\d+)\)$/);
  if (m) { const v = parseInt(m[1]); return h => h.all(c => c.value >= v); }

  m = expr.match(/^hand\.all\(c=>c\.value<=(\d+)\)$/);
  if (m) { const v = parseInt(m[1]); return h => h.all(c => c.value <= v); }

  m = expr.match(/^hand\.sum\(\)>(\d+)$/);
  if (m) { const v = parseInt(m[1]); return h => h.sum() > v; }

  m = expr.match(/^hand\.sum\(\)<(\d+)$/);
  if (m) { const v = parseInt(m[1]); return h => h.sum() < v; }

  m = expr.match(/^hand\.suitCount\(\)==(\d+)$/);
  if (m) { const v = parseInt(m[1]); return h => h.suitCount() === v; }

  m = expr.match(/^hand\.suitCount\(\)>=(\d+)$/);
  if (m) { const v = parseInt(m[1]); return h => h.suitCount() >= v; }

  m = expr.match(/^hand\.hasRun\((\d+)\)$/);
  if (m) { const v = parseInt(m[1]); return h => h.hasRun(v); }

  m = expr.match(/^hand\.size\(\)==(\d+)$/);
  if (m) { const v = parseInt(m[1]); return h => h.size() === v; }

  m = expr.match(/^hand\.size\(\)>=(\d+)$/);
  if (m) { const v = parseInt(m[1]); return h => h.size() >= v; }

  m = expr.match(/^hand\.size\(\)<=(\d+)$/);
  if (m) { const v = parseInt(m[1]); return h => h.size() <= v; }

  // Unknown expression - log warning and return always-true (don't block player)
  console.warn('Unknown constraint expression:', expr);
  return () => true;
}

// Pre-parse constraint handlers for all rules
function buildConstraintHandlers() {
  const handlers = {};
  RULES_ARRAY.forEach(rule => {
    if (rule.category === 'hand_constraint') {
      handlers[rule.id] = parseConstraintExpression(rule.description_technical);
    }
  });
  return handlers;
}

let CONSTRAINT_HANDLERS = {};

// Call after loadRules() to set up handlers
function initConstraintHandlers() {
  CONSTRAINT_HANDLERS = buildConstraintHandlers();
}
