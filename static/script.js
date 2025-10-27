
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



// Menu Navigation
const mainMenu = document.getElementById('mainMenu');
const creditsScreen = document.getElementById('creditsScreen');
const gameScreen = document.getElementById('gameScreen');
const playBtn = document.getElementById('playBtn');
const creditsBtn = document.getElementById('creditsBtn');
const backFromCreditsBtn = document.getElementById('backFromCreditsBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');

// Navigation functions
function showScreen(screen) {
  mainMenu.classList.add('hidden');
  creditsScreen.classList.add('hidden');
  gameScreen.classList.add('hidden');
  
  screen.classList.remove('hidden');
}

// Event listeners for menu navigation
playBtn.addEventListener('click', () => {
  showScreen(gameScreen);
  // Initialize game if not already done
  if (!boardEl.children.length) {
    initGame();
  }
});

creditsBtn.addEventListener('click', () => {
  showScreen(creditsScreen);
});

backFromCreditsBtn.addEventListener('click', () => {
  showScreen(mainMenu);
});

const boardEl = document.getElementById('board');
const colsEl = document.getElementById('cols');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');

resetBtn.addEventListener('click', async () => {
  await resetGame();
  renderFromState(await fetchState());
});

if (backToMenuBtn) {
  backToMenuBtn.addEventListener('click', () => {
    showScreen(mainMenu);
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
    statusEl.textContent = `Tour du joueur ${state.current_player}`;
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
}

// Initialize with main menu
showScreen(mainMenu);

// Game initialization function
function initGame() {
  createCols();
  fetchState().then(state => renderFromState(state));
}
