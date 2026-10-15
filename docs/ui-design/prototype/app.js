const root = document.documentElement;
const leftPane = document.getElementById('leftPane');
const leftRail = document.getElementById('leftRail');
const rightPane = document.getElementById('rightPane');
const rightRail = document.getElementById('rightRail');
const overlay = document.getElementById('agentOverlay');
const tabGroupB = document.getElementById('tabGroupB');

function toggleTheme() {
  root.dataset.theme = root.dataset.theme === 'dark' ? '' : 'dark';
}

function setLeftCollapsed(collapsed) {
  leftPane.hidden = collapsed;
  leftRail.hidden = !collapsed;
}

function setRightCollapsed(collapsed) {
  rightPane.hidden = collapsed;
  rightRail.hidden = !collapsed;
}

function setAgentExpanded(expanded) {
  overlay.hidden = !expanded;
  if (expanded) {
    overlay.querySelector('textarea').focus();
  } else {
    document.getElementById('dockTranscript').focus();
  }
}

document.getElementById('toggleTheme').addEventListener('click', toggleTheme);
document.getElementById('demoToggleLeft').addEventListener('click', () => setLeftCollapsed(!leftPane.hidden));
document.getElementById('demoToggleRight').addEventListener('click', () => setRightCollapsed(!rightPane.hidden));
document.getElementById('demoToggleAgent').addEventListener('click', () => setAgentExpanded(overlay.hidden));

document.getElementById('collapseLeft').addEventListener('click', () => setLeftCollapsed(true));
document.getElementById('expandLeft').addEventListener('click', () => setLeftCollapsed(false));
document.getElementById('collapseRight').addEventListener('click', () => setRightCollapsed(true));
document.getElementById('expandRight').addEventListener('click', () => setRightCollapsed(false));

document.getElementById('dockTranscript').addEventListener('click', () => setAgentExpanded(true));
document.getElementById('collapseAgent').addEventListener('click', () => setAgentExpanded(false));

document.getElementById('splitBtn').addEventListener('click', () => { tabGroupB.hidden = false; });
document.getElementById('mergeBtn').addEventListener('click', () => { tabGroupB.hidden = true; });

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !overlay.hidden) {
    setAgentExpanded(false);
  }
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key === 'b') {
    event.preventDefault();
    setLeftCollapsed(!leftPane.hidden);
  }
  if ((event.ctrlKey || event.metaKey) && event.altKey && event.key === 'b') {
    event.preventDefault();
    setRightCollapsed(!rightPane.hidden);
  }
});
