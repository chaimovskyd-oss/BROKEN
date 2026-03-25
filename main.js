// ============================================================
// main.js — Bootstrap: load rules, initialize game, render title
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Broken Deck — initializing...');

  // Load rules from JSON
  const rulesLoaded = await loadRules();
  if (!rulesLoaded) {
    console.warn('Rules could not be loaded. Game functionality may be limited.');
    console.warn('Please run from an HTTP server: python -m http.server 8080');
  }

  // Build constraint handler lookup table
  initConstraintHandlers();

  // Run card system self-tests
  runCardTests();

  // Initialize game state (load best score, etc.)
  initGameState();

  // Render title screen
  renderScreen('title');

  console.log('Broken Deck — ready!');
});
