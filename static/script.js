
async function fetchState() {
  const res = await fetch('/api/state');
  return await res.json();
}

async function playCol(col) {
  const form = new FormData();
  form.append('col', String(col));
  const res = await fetch('/api/play', { method: 'POST', body: form });
  return await res.json();
}

async function resetGame() {
  const res = await fetch('/api/reset', { method: 'POST' });
  return await res.json();
}

async function setMode(mode) {
  const res = await fetch('/api/set_mode', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ mode }) 
  });
  return await res.json();
}

const boardEl = document.getElementById('board');
const colsEl = document.getElementById('cols');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');
const modeSelect = document.getElementById('mode');

resetBtn.addEventListener('click', async () => {
  await resetGame();
  renderFromState(await fetchState());
});

if (modeSelect) {
  modeSelect.addEventListener('change', async () => {
    const state = await setMode(modeSelect.value);
    renderFromState(state);
  });
}

function createCols() {
  colsEl.innerHTML = '';
  for (let c = 0; c < 7; c++) {
    const btn = document.createElement('button');
    btn.className = 'col-button';
    btn.textContent = '▼';
    btn.title = `Jouer colonne ${c+1}`;
    btn.addEventListener('click', () => onColClick(c));
    colsEl.appendChild(btn);
  }
}

let lock = false; 

async function onColClick(col) {
  if (lock) return;
  lock = true;
  try {
    const prevState = await fetchState();
    const newState = await playCol(col);
    const placed = findPlacedDisc(prevState.board, newState.board);
    if (placed) {
      await animateDrop(placed.row, placed.col, newState.board[placed.row][placed.col]);
      renderFromState(newState, placed);
    } else {
      renderFromState(newState);
    }
  } catch (err) {
    console.error(err);
  } finally {
    lock = false;
  }
}
function findPlacedDisc(prevBoard, newBoard) {
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      if (prevBoard[r][c] !== newBoard[r][c]) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

function animateDrop(targetRow, targetCol, player) {
  return new Promise(resolve => {
    const cellIndex = targetRow * 7 + targetCol;
    const targetCell = boardEl.children[cellIndex];
    if (!targetCell) { resolve(); return; }

    const disc = document.createElement('div');
    disc.className = `disc p${player} drop`;
    disc.style.width = '64px';
    disc.style.height = '64px';
    boardEl.appendChild(disc);
    
    const boardRect = boardEl.getBoundingClientRect();
    const cellRect = targetCell.getBoundingClientRect();

    const startX = cellRect.left + cellRect.width/2 - boardRect.left - 32;
    const startY = -100; // Start above the board
    const endX = cellRect.left + cellRect.width/2 - boardRect.left - 32;
    const endY = cellRect.top + cellRect.height/2 - boardRect.top - 32;

    disc.style.transform = `translate(${startX}px, ${startY}px)`;
    disc.getBoundingClientRect();
    
    requestAnimationFrame(() => {
      disc.style.transform = `translate(${endX}px, ${endY}px)`;
    });
    
    disc.addEventListener('transitionend', () => {
      const final = document.createElement('div');
      final.className = `disc p${player}`;
      targetCell.appendChild(final);
      disc.remove();
      resolve();
    }, { once: true });

    setTimeout(() => {
      if (document.body.contains(disc)) {
        disc.remove();
        resolve();
      }
    }, 800);
  });
}
function renderFromState(state, placed) {
  if (state.winner !== 0) {
    statusEl.textContent = `Le joueur ${state.winner} a gagné ! 🎉`;
  } else if (state.draw) {
    statusEl.textContent = `Match nul.`;
  } else {
    let modeLabel = modeToLabel(state.mode);
    statusEl.textContent = `${modeLabel} • Tour du joueur ${state.current_player}`;
  }

  boardEl.innerHTML = '';
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const val = state.board[r][c];
      if (val !== 0) {
        const disc = document.createElement('div');
        disc.className = `disc p${val}`;
        cell.appendChild(disc);
      }
      boardEl.appendChild(cell);
    }
  }
  
  if (state.win_coords && state.win_coords.length) {
    for (const coord of state.win_coords) {
      const rr = coord[0], cc = coord[1];
      const idx = rr * 7 + cc;
      const targetCell = boardEl.children[idx];
      if (targetCell) {
        const disc = targetCell.querySelector('.disc');
        if (disc) disc.classList.add('win');
      }
    }
  }

  if (modeSelect && state.mode) {
    modeSelect.value = state.mode;
  }
}

function modeToLabel(mode) {
  switch (mode) {
    case 'pvp': return 'Mode: JcJ';
    case 'pve_easy': return 'Mode: JcIA (facile)';
    case 'pve_smart': return 'Mode: JcIA (intelligent)';
    case 'anti_pvp': return 'Mode: Anti-gravité JcJ';
    case 'anti_pve_easy': return 'Mode: Anti-gravité JcIA (facile)';
    case 'anti_pve_smart': return 'Mode: Anti-gravité JcIA (intelligent)';
    default: return 'Mode';
  }
}

(async function init() {
  createCols();
  const state = await fetchState();
  renderFromState(state);
})();
