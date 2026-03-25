// ============================================================
// ui.js — Screen rendering and UI management
// ============================================================

// ============================================================
// SCREEN MANAGEMENT
// ============================================================

function renderScreen(screenKey) {
  // Hide all screens
  document.querySelectorAll('.game-screen').forEach(el => el.classList.remove('active'));

  const screenMap = {
    'title': 'screen-title',
    'rulePick': 'screen-rule-pick',
    'handPlay': 'screen-hand-play',
    'roundSummary': 'screen-round-summary',
    'shop': 'screen-shop',
    'gameOver': 'screen-game-over',
    'victory': 'screen-victory'
  };

  const screenId = screenMap[screenKey];
  if (!screenId) return;

  const screenEl = document.getElementById(screenId);
  if (screenEl) screenEl.classList.add('active');

  // Call screen-specific renderer
  const renderers = {
    'title': renderTitleScreen,
    'rulePick': renderRulePickScreen,
    'handPlay': renderHandPlayScreen,
    'roundSummary': renderRoundSummaryScreen,
    'shop': renderShopScreen,
    'gameOver': renderGameOverScreen,
    'victory': renderVictoryScreen
  };

  if (renderers[screenKey]) renderers[screenKey]();
}

// ============================================================
// COMPONENT FACTORIES
// ============================================================

// Create a game card DOM element
function createCardElement(card, index) {
  const div = document.createElement('div');
  div.className = 'game-card';
  if (card.selected) div.classList.add('selected');
  if (card.invalid) div.classList.add('invalid');
  if (card.boosted) div.classList.add('boosted');
  div.style.setProperty('--card-index', index);
  div.dataset.cardId = card.id;

  const img = document.createElement('img');
  if (card.faceDown) {
    img.src = 'קלפים/1B.svg';
    img.alt = 'face down card';
  } else {
    img.src = card.svgPath;
    img.alt = card.id;
  }
  img.draggable = false;
  div.appendChild(img);

  return div;
}

// Create a stat badge element
function createStatBadge(label, value, dangerLevel) {
  const div = document.createElement('div');
  div.className = 'stat-badge';
  if (dangerLevel === 'danger') div.classList.add('stat-badge--danger');

  const labelEl = document.createElement('span');
  labelEl.className = 'label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'value';
  valueEl.textContent = value;

  div.appendChild(labelEl);
  div.appendChild(valueEl);
  return div;
}

// Create risk badge
function createRiskBadge(risk) {
  const span = document.createElement('span');
  span.className = `risk-badge ${risk.toLowerCase()}`;
  const labels = { low: 'נמוך', medium: 'בינוני', high: 'גבוה' };
  span.textContent = labels[risk.toLowerCase()] || risk;
  return span;
}

// Create a rule card element
function createRuleCardElement(rule, stabilityDelta, onClick) {
  const div = document.createElement('div');
  div.className = `rule-card risk-${rule.risk.toLowerCase()}`;

  // Rule card background SVG
  div.style.backgroundImage = "url('אלמנטים/חוקים.svg')";
  div.style.backgroundSize = '100% 100%';
  div.style.backgroundRepeat = 'no-repeat';

  // Name (Hebrew)
  const nameHe = document.createElement('div');
  nameHe.className = 'rule-name-he';
  nameHe.textContent = rule.name_he;

  // Name (English)
  const nameEn = document.createElement('div');
  nameEn.className = 'rule-name-en';
  nameEn.textContent = rule.name_en;

  // Description
  const desc = document.createElement('div');
  desc.className = 'rule-desc';
  desc.textContent = rule.description_technical;

  // Footer: risk + multiplier + stability delta
  const footer = document.createElement('div');
  footer.className = 'rule-footer';

  const leftGroup = document.createElement('div');
  leftGroup.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  leftGroup.appendChild(createRiskBadge(rule.risk));

  if (typeof stabilityDelta === 'number') {
    const deltaEl = document.createElement('span');
    deltaEl.className = `stability-delta ${stabilityDelta >= 0 ? 'positive' : 'negative'}`;
    deltaEl.textContent = `יציבות: ${stabilityDelta >= 0 ? '+' : ''}${stabilityDelta}%`;
    leftGroup.appendChild(deltaEl);
  }

  const multEl = document.createElement('div');
  multEl.className = 'multiplier-badge';
  multEl.textContent = `×${rule.multiplier}`;

  footer.appendChild(leftGroup);
  footer.appendChild(multEl);

  div.appendChild(nameHe);
  div.appendChild(nameEn);
  div.appendChild(desc);
  div.appendChild(footer);

  if (onClick) div.addEventListener('click', onClick);

  return div;
}

// Create active rule chip
function createRuleChip(rule) {
  const span = document.createElement('span');
  span.className = `rule-chip risk-${rule.risk.toLowerCase()}`;
  span.textContent = rule.name_he;
  span.title = rule.name_en + ': ' + rule.description_technical;
  return span;
}

// Stability display helper
function getStabilityLabel(stability) {
  if (stability >= 70) return { text: `${stability}%`, cls: 'stable' };
  if (stability >= 40) return { text: `${stability}%`, cls: 'warning' };
  if (stability >= 20) return { text: `${stability}%`, cls: 'danger' };
  return { text: `${stability}% ⚠️`, cls: 'critical' };
}

function getStabilityColor(stability) {
  if (stability >= 70) return 'var(--risk-low)';
  if (stability >= 40) return 'var(--risk-medium)';
  if (stability >= 20) return '#f97316';
  return 'var(--risk-high)';
}

// ============================================================
// TITLE SCREEN
// ============================================================

function renderTitleScreen() {
  const screen = document.getElementById('screen-title');
  screen.innerHTML = '';

  const content = document.createElement('div');
  content.className = 'title-content';

  // Logo
  const logoWrap = document.createElement('div');
  logoWrap.className = 'title-logo-wrap';

  const logo = document.createElement('h1');
  logo.className = 'game-logo';
  logo.textContent = 'קלף שבור';

  const subtitle = document.createElement('div');
  subtitle.className = 'title-subtitle';
  subtitle.textContent = 'Broken Deck';

  logoWrap.appendChild(logo);
  logoWrap.appendChild(subtitle);

  // Best score stats
  const stats = document.createElement('div');
  stats.className = 'title-stats';

  const bestScoreItem = document.createElement('div');
  bestScoreItem.className = 'title-stat-item';
  const bestLabel = document.createElement('div');
  bestLabel.className = 'label';
  bestLabel.textContent = 'שיא';
  const bestValue = document.createElement('div');
  bestValue.className = 'value';
  bestValue.textContent = GameState.bestScore || '0';
  bestScoreItem.appendChild(bestLabel);
  bestScoreItem.appendChild(bestValue);
  stats.appendChild(bestScoreItem);

  // Buttons
  const buttons = document.createElement('div');
  buttons.className = 'title-buttons';

  const newRunBtn = document.createElement('button');
  newRunBtn.className = 'btn btn-primary';
  newRunBtn.textContent = 'ריצה חדשה';
  newRunBtn.style.cssText = 'width:200px;padding:14px 24px;font-size:16px;';
  newRunBtn.addEventListener('click', startNewGame);

  buttons.appendChild(newRunBtn);

  if (hasSavedGame()) {
    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn btn-secondary';
    continueBtn.textContent = 'המשך ריצה';
    continueBtn.style.cssText = 'width:200px;padding:12px 24px;';
    continueBtn.addEventListener('click', continueGame);
    buttons.appendChild(continueBtn);
  }

  // Version
  const version = document.createElement('div');
  version.className = 'title-version';
  version.textContent = 'גרסה 1.0 — 304 חוקים';

  content.appendChild(logoWrap);
  content.appendChild(stats);
  content.appendChild(buttons);
  content.appendChild(version);
  screen.appendChild(content);
}

// ============================================================
// RULE PICK SCREEN
// ============================================================

function renderRulePickScreen() {
  const screen = document.getElementById('screen-rule-pick');
  screen.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'rule-pick-header';

  const headerLeft = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'rule-pick-title';
  title.textContent = `שלב ${GameState.stage} — סיבוב ${GameState.round}`;
  headerLeft.appendChild(title);

  const headerRight = document.createElement('div');
  headerRight.style.cssText = 'display:flex;gap:12px;align-items:center;';
  headerRight.appendChild(createStatBadge('ניקוד', GameState.score));
  headerRight.appendChild(createStatBadge('יעד', GameState.targetScore));

  const stabilityInfo = getStabilityLabel(GameState.stability);
  const stabBadge = createStatBadge('יציבות', stabilityInfo.text);
  stabBadge.querySelector('.value').style.color = getStabilityColor(GameState.stability);
  headerRight.appendChild(stabBadge);

  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  // Body
  const body = document.createElement('div');
  body.className = 'rule-pick-body';

  const prompt = document.createElement('div');
  prompt.className = 'rule-pick-prompt';
  prompt.textContent = 'בחר חוק אחד שיוסיף לאוסף החוקים הפעילים';

  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'rule-cards-container';

  // Generate rule choices if not set
  if (!GameState.offeredRules || GameState.offeredRules.length === 0) {
    generateRuleChoices();
  }

  GameState.offeredRules.forEach(rule => {
    const delta = calculateStabilityDelta(rule.id, GameState);
    const cardEl = createRuleCardElement(rule, delta, () => {
      pickRule(rule.id);
    });
    cardsContainer.appendChild(cardEl);
  });

  // Active rules section
  const activeSection = document.createElement('div');
  activeSection.className = 'active-rules-section';
  activeSection.style.cssText = 'width:100%;max-width:800px;';

  if (GameState.activeRules.length > 0) {
    const activeTitle = document.createElement('div');
    activeTitle.className = 'active-rules-title';
    activeTitle.textContent = `חוקים פעילים (${GameState.activeRules.length})`;

    const activeBar = document.createElement('div');
    activeBar.className = 'active-rules-bar';

    GameState.activeRules.forEach(ruleId => {
      const rule = getRuleById(ruleId);
      if (rule) activeBar.appendChild(createRuleChip(rule));
    });

    activeSection.appendChild(activeTitle);
    activeSection.appendChild(activeBar);
  }

  body.appendChild(prompt);
  body.appendChild(cardsContainer);
  body.appendChild(activeSection);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'rule-pick-footer';

  const footerLeft = document.createElement('div');
  footerLeft.style.cssText = 'display:flex;gap:12px;align-items:center;';
  footerLeft.appendChild(createStatBadge('חיים', '❤️'.repeat(GameState.lives)));
  footerLeft.appendChild(createStatBadge('מטבעות', `🪙 ${GameState.coins}`));

  footer.appendChild(footerLeft);

  screen.appendChild(header);
  screen.appendChild(body);
  screen.appendChild(footer);
}

// ============================================================
// HAND PLAY SCREEN
// ============================================================

let handSelectedIds = []; // tracks which cards are selected

function renderHandPlayScreen() {
  const screen = document.getElementById('screen-hand-play');
  screen.innerHTML = '';
  handSelectedIds = []; // reset selection

  // Header
  const header = document.createElement('div');
  header.className = 'hand-play-header';

  const headerLogo = document.createElement('div');
  headerLogo.className = 'header-logo';
  headerLogo.textContent = 'קלף שבור';

  const headerStats = document.createElement('div');
  headerStats.className = 'header-stats';

  const stabInfo = getStabilityLabel(GameState.stability);
  const stabBadge = createStatBadge('יציבות', stabInfo.text);
  stabBadge.querySelector('.value').style.color = getStabilityColor(GameState.stability);
  headerStats.appendChild(stabBadge);
  headerStats.appendChild(createStatBadge('שלב', GameState.stage));
  headerStats.appendChild(createStatBadge('חיים', GameState.lives));

  header.appendChild(headerLogo);
  header.appendChild(headerStats);

  // Body
  const body = document.createElement('div');
  body.className = 'hand-play-body';

  // Active rules bar
  const rulesBarWrap = document.createElement('div');
  rulesBarWrap.className = 'active-rules-bar-wrap';

  if (GameState.activeRules.length > 0) {
    const rulesBar = document.createElement('div');
    rulesBar.className = 'active-rules-bar';
    GameState.activeRules.forEach(id => {
      const r = getRuleById(id);
      if (r) rulesBar.appendChild(createRuleChip(r));
    });
    rulesBarWrap.appendChild(rulesBar);
  } else {
    const emptyMsg = document.createElement('span');
    emptyMsg.style.cssText = 'font-size:12px;color:var(--text-secondary);';
    emptyMsg.textContent = 'אין חוקים פעילים';
    rulesBarWrap.appendChild(emptyMsg);
  }

  // Play area
  const playArea = document.createElement('div');
  playArea.className = 'play-area';

  // Hand area
  const handArea = document.createElement('div');
  handArea.className = 'hand-area';

  const handCards = document.createElement('div');
  handCards.id = 'hand-cards';
  handCards.className = 'hand-cards';

  function renderHandCards() {
    handCards.innerHTML = '';

    GameState.hand.forEach((card, i) => {
      const cardEl = createCardElement(card, i);

      cardEl.addEventListener('click', () => {
        if (card.locked) return;

        const idx = handSelectedIds.indexOf(card.id);
        if (idx === -1) {
          handSelectedIds.push(card.id);
          cardEl.classList.add('selected');
        } else {
          handSelectedIds.splice(idx, 1);
          cardEl.classList.remove('selected');
        }

        // Live constraint check
        updateHandValidation();
      });

      handCards.appendChild(cardEl);
    });
  }

  function updateHandValidation() {
    if (handSelectedIds.length === 0) return;

    const selectedCards = GameState.hand.filter(c => handSelectedIds.includes(c.id));
    if (selectedCards.length < GameState.playSize) {
      // Not enough cards selected yet - clear invalid state
      handCards.querySelectorAll('.game-card').forEach(el => el.classList.remove('invalid'));
      updateResultMessage('', '');
      return;
    }

    const result = evaluateConstraints(selectedCards, GameState);

    // Mark violating cards
    handCards.querySelectorAll('.game-card').forEach(el => el.classList.remove('invalid'));

    if (!result.valid) {
      result.violations.forEach(violation => {
        // Add invalid state to card (simplified - marks all selected)
        handCards.querySelectorAll('.game-card.selected').forEach(el => el.classList.add('invalid'));
      });
      updateResultMessage('invalid', `❌ ${result.violations.map(v => v.name_he).join(', ')}`);
    } else {
      updateResultMessage('valid', `✓ היד תקינה`);
    }
  }

  function updateResultMessage(type, text) {
    const msgEl = document.getElementById('hand-result-msg');
    if (!msgEl) return;
    msgEl.className = `hand-result-message ${type}`;
    msgEl.textContent = text;
  }

  renderHandCards();

  const instructions = document.createElement('div');
  instructions.className = 'hand-instructions';
  instructions.textContent = `בחר ${GameState.playSize} קלפים ולחץ "שחק יד"`;

  handArea.appendChild(handCards);
  handArea.appendChild(instructions);

  // Side panel (deck + discard)
  const sidePanel = document.createElement('div');
  sidePanel.className = 'side-panel';

  // Deck
  const deckArea = document.createElement('div');
  deckArea.className = 'deck-area';

  const deckLabel = document.createElement('div');
  deckLabel.className = 'side-panel-label';
  deckLabel.textContent = 'חפיסה';

  const deckStack = document.createElement('div');
  deckStack.className = 'deck-stack';

  const deckImg = document.createElement('img');
  deckImg.src = 'קלפים/1B.svg';
  deckImg.alt = 'deck';
  deckImg.style.cssText = 'width:100%;height:100%;border-radius:8px;object-fit:cover;';

  const deckCount = document.createElement('div');
  deckCount.className = 'deck-count-badge';
  deckCount.textContent = `${GameState.deck.length} קלפים`;

  deckStack.appendChild(deckImg);
  deckArea.appendChild(deckLabel);
  deckArea.appendChild(deckStack);
  deckArea.appendChild(deckCount);

  // Discard
  const discardArea = document.createElement('div');
  discardArea.className = 'discard-area';

  const discardLabel = document.createElement('div');
  discardLabel.className = 'side-panel-label';
  discardLabel.textContent = 'גרוטאה';

  const discardCount = document.createElement('div');
  discardCount.className = 'deck-count-badge';
  discardCount.textContent = `${GameState.discard.length}`;

  if (GameState.discard.length > 0) {
    const topDiscardImg = document.createElement('img');
    const topCard = GameState.discard[GameState.discard.length - 1];
    topDiscardImg.src = topCard.svgPath;
    topDiscardImg.alt = topCard.id;
    topDiscardImg.style.cssText = 'width:60px;height:84px;border-radius:6px;opacity:0.7;';
    discardArea.appendChild(discardLabel);
    discardArea.appendChild(topDiscardImg);
    discardArea.appendChild(discardCount);
  } else {
    discardArea.appendChild(discardLabel);
    discardArea.appendChild(discardCount);
  }

  sidePanel.appendChild(deckArea);
  sidePanel.appendChild(discardArea);

  playArea.appendChild(handArea);
  playArea.appendChild(sidePanel);

  body.appendChild(rulesBarWrap);
  body.appendChild(playArea);

  // Footer / HUD
  const footer = document.createElement('div');
  footer.className = 'hand-play-footer';

  // Score display
  const scoreSection = document.createElement('div');
  scoreSection.className = 'hud-section';
  const scoreLabel = document.createElement('div');
  scoreLabel.className = 'hud-label';
  scoreLabel.textContent = 'ניקוד';
  const scoreDisplay = document.createElement('div');
  scoreDisplay.className = 'score-display';
  const scoreCurrent = document.createElement('span');
  scoreCurrent.className = 'score-current';
  scoreCurrent.id = 'score-current';
  scoreCurrent.textContent = GameState.score;
  const scoreDivider = document.createElement('span');
  scoreDivider.className = 'score-divider';
  scoreDivider.textContent = '/';
  const scoreTarget = document.createElement('span');
  scoreTarget.className = 'score-target';
  scoreTarget.textContent = GameState.targetScore;
  scoreDisplay.appendChild(scoreCurrent);
  scoreDisplay.appendChild(scoreDivider);
  scoreDisplay.appendChild(scoreTarget);
  scoreSection.appendChild(scoreLabel);
  scoreSection.appendChild(scoreDisplay);

  // Divider
  const div1 = document.createElement('div');
  div1.className = 'hud-divider';

  // Hands remaining
  const handsSection = document.createElement('div');
  handsSection.className = 'hud-section';
  const handsLabel = document.createElement('div');
  handsLabel.className = 'hud-label';
  handsLabel.textContent = 'ידיים';
  const handsValue = document.createElement('div');
  handsValue.className = 'hud-value';
  handsValue.textContent = `${GameState.handsRemaining} נותרו`;
  handsSection.appendChild(handsLabel);
  handsSection.appendChild(handsValue);

  // Divider
  const div2 = document.createElement('div');
  div2.className = 'hud-divider';

  // Draws remaining
  const drawsSection = document.createElement('div');
  drawsSection.className = 'hud-section';
  const drawsLabel = document.createElement('div');
  drawsLabel.className = 'hud-label';
  drawsLabel.textContent = 'החלפות';
  const drawsValue = document.createElement('div');
  drawsValue.className = 'hud-value';
  drawsValue.textContent = GameState.drawsRemaining;
  drawsSection.appendChild(drawsLabel);
  drawsSection.appendChild(drawsValue);

  // Result message (live feedback)
  const resultMsg = document.createElement('div');
  resultMsg.id = 'hand-result-msg';
  resultMsg.className = 'hand-result-message';

  // Actions
  const actions = document.createElement('div');
  actions.className = 'hud-actions';

  // Discard button
  const discardBtn = document.createElement('button');
  discardBtn.className = 'btn btn-secondary';
  discardBtn.textContent = '🔄 החלפה';
  discardBtn.addEventListener('click', () => {
    if (handSelectedIds.length === 0) return;
    if (GameState.drawsRemaining <= 0) return;

    const success = discardCards([...handSelectedIds]);
    if (success) {
      handSelectedIds = [];
      renderHandPlayScreen(); // re-render with new hand
    }
  });

  // Play button
  const playBtn = document.createElement('button');
  playBtn.className = 'btn btn-primary';
  playBtn.textContent = '▶ שחק יד';
  playBtn.style.cssText = 'font-size:15px;padding:12px 28px;';
  playBtn.addEventListener('click', () => {
    if (handSelectedIds.length !== GameState.playSize) {
      alert(`בחר בדיוק ${GameState.playSize} קלפים`);
      return;
    }

    const result = playHand([...handSelectedIds]);
    if (!result) return;

    // Show score pop animation on valid hand
    if (result.valid) {
      const el = document.getElementById('score-current');
      if (el) {
        el.classList.add('score-popping');
        setTimeout(() => el.classList.remove('score-popping'), 400);
      }
    }
  });

  actions.appendChild(discardBtn);
  actions.appendChild(playBtn);

  // Divider
  const div3 = document.createElement('div');
  div3.className = 'hud-divider';

  // Stage/round info
  const roundSection = document.createElement('div');
  roundSection.className = 'hud-section';
  const roundLabel = document.createElement('div');
  roundLabel.className = 'hud-label';
  roundLabel.textContent = 'סיבוב';
  const roundValue = document.createElement('div');
  roundValue.className = 'hud-value';
  roundValue.textContent = `${GameState.round}`;
  roundSection.appendChild(roundLabel);
  roundSection.appendChild(roundValue);

  footer.appendChild(scoreSection);
  footer.appendChild(div1);
  footer.appendChild(handsSection);
  footer.appendChild(div2);
  footer.appendChild(drawsSection);
  footer.appendChild(resultMsg);
  footer.appendChild(actions);
  footer.appendChild(div3);
  footer.appendChild(roundSection);

  screen.appendChild(header);
  screen.appendChild(body);
  screen.appendChild(footer);
}

// ============================================================
// ROUND SUMMARY SCREEN
// ============================================================

function renderRoundSummaryScreen() {
  const screen = document.getElementById('screen-round-summary');
  screen.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'panel-frame round-summary-panel';

  const title = document.createElement('h2');
  title.className = 'summary-title';
  title.textContent = `סיכום סיבוב ${GameState.round}`;

  // Show last played hand
  if (GameState.lastHandCards && GameState.lastHandCards.length > 0) {
    const handDisplay = document.createElement('div');
    handDisplay.className = 'summary-hand-display';
    GameState.lastHandCards.forEach(card => {
      const img = document.createElement('img');
      img.src = card.svgPath;
      img.alt = card.id;
      img.style.cssText = 'width:60px;height:84px;border-radius:6px;';
      handDisplay.appendChild(img);
    });
    panel.appendChild(title);
    panel.appendChild(handDisplay);
  } else {
    panel.appendChild(title);
  }

  // Score breakdown
  const scoreRows = [
    { label: 'ניקוד הסיבוב', value: GameState.roundScore },
    { label: 'ניקוד כולל', value: GameState.score },
    { label: 'יעד', value: GameState.targetScore },
  ];

  scoreRows.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'summary-score-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'label';
    labelEl.textContent = row.label;
    const valueEl = document.createElement('span');
    valueEl.className = 'value';
    valueEl.textContent = row.value;
    rowEl.appendChild(labelEl);
    rowEl.appendChild(valueEl);
    panel.appendChild(rowEl);
  });

  // Progress bar
  const progressSection = document.createElement('div');
  progressSection.className = 'summary-progress';

  const progressLabel = document.createElement('div');
  progressLabel.className = 'summary-progress-label';
  const progressLeft = document.createElement('span');
  progressLeft.textContent = `התקדמות: ${GameState.score}`;
  const progressRight = document.createElement('span');
  progressRight.textContent = `${GameState.targetScore}`;
  progressLabel.appendChild(progressLeft);
  progressLabel.appendChild(progressRight);

  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  const progressFill = document.createElement('div');
  progressFill.className = 'progress-fill';
  const pct = Math.min(100, Math.round((GameState.score / GameState.targetScore) * 100));
  progressFill.style.width = `${pct}%`;
  progressBar.appendChild(progressFill);

  progressSection.appendChild(progressLabel);
  progressSection.appendChild(progressBar);
  panel.appendChild(progressSection);

  // Last hand result breakdown
  if (GameState.lastHandResult && GameState.lastHandResult.breakdown && GameState.lastHandResult.breakdown.length > 0) {
    const comboBadges = document.createElement('div');
    comboBadges.className = 'combo-badges';
    GameState.lastHandResult.breakdown.slice(0, 5).forEach(item => {
      const badge = document.createElement('span');
      badge.className = 'combo-badge';
      badge.textContent = `${item.label}: ×${item.value}`;
      comboBadges.appendChild(badge);
    });
    panel.appendChild(comboBadges);
  }

  // Continue button
  const continueBtn = document.createElement('button');
  continueBtn.className = 'btn btn-primary';
  continueBtn.textContent = 'סיבוב הבא →';
  continueBtn.style.cssText = 'width:100%;padding:14px;font-size:15px;margin-top:16px;';
  continueBtn.addEventListener('click', nextRound);
  panel.appendChild(continueBtn);

  screen.appendChild(panel);
}

// ============================================================
// SHOP SCREEN
// ============================================================

function renderShopScreen() {
  const screen = document.getElementById('screen-shop');
  screen.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'shop-header rule-pick-header';

  const headerTitle = document.createElement('div');
  headerTitle.className = 'rule-pick-title';
  headerTitle.textContent = '🏪 חנות שדרוגים';

  const coinDisplay = document.createElement('div');
  coinDisplay.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:18px;font-weight:700;color:var(--text-gold);';
  coinDisplay.textContent = `🪙 ${GameState.coins}`;

  header.appendChild(headerTitle);
  header.appendChild(coinDisplay);

  // Body
  const body = document.createElement('div');
  body.className = 'shop-body';

  const shopTitle = document.createElement('h2');
  shopTitle.className = 'shop-title';
  shopTitle.textContent = 'השתמש במטבעות לשדרוג הריצה';

  const grid = document.createElement('div');
  grid.className = 'shop-grid';

  GameState.currentShopItems.forEach(item => {
    const itemEl = document.createElement('div');
    itemEl.className = `shop-item panel-frame ${GameState.coins < item.cost ? 'soldout' : ''}`;

    itemEl.innerHTML = `
      <div class="shop-item-icon">${item.icon}</div>
      <div class="shop-item-name">${item.name_he}</div>
      <div class="shop-item-desc">${item.desc_he}</div>
      <div class="shop-item-price">
        <span class="shop-item-cost">🪙 ${item.cost}</span>
        ${GameState.inventory[item.type] !== undefined ? `<span style="font-size:11px;color:var(--text-secondary);">בידך: ${GameState.inventory[item.type] || 0}</span>` : ''}
      </div>
    `;

    itemEl.addEventListener('click', () => {
      if (GameState.coins < item.cost) return;
      const success = buyShopItem(item.id);
      if (success) {
        renderShopScreen(); // re-render with updated coins
      }
    });

    grid.appendChild(itemEl);
  });

  const doneBtn = document.createElement('button');
  doneBtn.className = 'btn btn-primary';
  doneBtn.textContent = 'סיום קניות →';
  doneBtn.style.cssText = 'padding:14px 40px;font-size:15px;';
  doneBtn.addEventListener('click', leaveShop);

  body.appendChild(shopTitle);
  body.appendChild(grid);
  body.appendChild(doneBtn);

  screen.appendChild(header);
  screen.appendChild(body);
}

// ============================================================
// GAME OVER SCREEN
// ============================================================

function renderGameOverScreen() {
  const screen = document.getElementById('screen-game-over');
  screen.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'game-over-panel';

  const crack = document.createElement('div');
  crack.className = 'game-over-crack';
  crack.textContent = '⚡';

  const title = document.createElement('h1');
  title.className = 'game-over-title';
  title.textContent = 'המשחק שבר';

  const reason = document.createElement('p');
  reason.className = 'game-over-reason';

  if (GameState.stability < 5) {
    reason.textContent = 'מערכת החוקים קרסה — אין יד חוקית אפשרית';
  } else if (GameState.lives <= 0) {
    reason.textContent = 'נגמרו החיים';
  } else {
    reason.textContent = 'לא הגעת לניקוד היעד';
  }

  const statsEl = document.createElement('div');
  statsEl.className = 'game-over-stats';

  const stats = [
    { label: 'ניקוד', value: GameState.score },
    { label: 'סיבובים', value: GameState.round },
    { label: 'חוקים', value: GameState.activeRules.length },
  ];

  stats.forEach(s => {
    const item = document.createElement('div');
    item.className = 'game-over-stat';
    item.innerHTML = `<span style="font-size:22px;font-weight:700;color:var(--text-gold);">${s.value}</span><span style="font-size:11px;color:var(--text-secondary);">${s.label}</span>`;
    statsEl.appendChild(item);
  });

  const restartBtn = document.createElement('button');
  restartBtn.className = 'btn btn-primary';
  restartBtn.textContent = 'ריצה חדשה';
  restartBtn.style.cssText = 'padding:14px 40px;font-size:15px;';
  restartBtn.addEventListener('click', restartGame);

  panel.appendChild(crack);
  panel.appendChild(title);
  panel.appendChild(reason);
  panel.appendChild(statsEl);
  panel.appendChild(restartBtn);
  screen.appendChild(panel);
}

// ============================================================
// VICTORY SCREEN
// ============================================================

function renderVictoryScreen() {
  const screen = document.getElementById('screen-victory');
  screen.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'victory-panel';

  const title = document.createElement('h1');
  title.className = 'victory-title';
  title.textContent = '🏆 ניצחת!';

  const subtitle = document.createElement('div');
  subtitle.className = 'victory-subtitle';
  subtitle.textContent = 'הגעת ליעד הניקוד';

  const score = document.createElement('div');
  score.className = 'victory-score';
  score.textContent = GameState.score;

  const scoreLabel = document.createElement('div');
  scoreLabel.style.cssText = 'font-size:12px;color:var(--text-secondary);letter-spacing:0.2em;text-transform:uppercase;';
  scoreLabel.textContent = 'נקודות';

  const statsEl = document.createElement('div');
  statsEl.style.cssText = 'display:flex;gap:24px;justify-content:center;';

  const victoryStats = [
    { label: 'סיבובים', value: GameState.round },
    { label: 'חוקים פעילים', value: GameState.activeRules.length },
    { label: 'יציבות', value: `${GameState.stability}%` }
  ];

  victoryStats.forEach(s => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;';
    item.innerHTML = `<span style="font-size:20px;font-weight:700;color:var(--text-gold);">${s.value}</span><span style="font-size:11px;color:var(--text-secondary);">${s.label}</span>`;
    statsEl.appendChild(item);
  });

  const continueBtn = document.createElement('button');
  continueBtn.className = 'btn btn-primary';
  continueBtn.textContent = 'חזרה לתפריט';
  continueBtn.style.cssText = 'padding:14px 40px;font-size:15px;';
  continueBtn.addEventListener('click', backToTitle);

  panel.appendChild(title);
  panel.appendChild(subtitle);
  panel.appendChild(score);
  panel.appendChild(scoreLabel);
  panel.appendChild(statsEl);
  panel.appendChild(continueBtn);
  screen.appendChild(panel);
}
