// ===== 29 Card Game: Sound Effects & Animations =====
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["J", "9", "A", "10", "K", "Q", "8", "7"];
const POINTS = { J: 3, "9": 2, A: 1, "10": 1, K: 0, Q: 0, "8": 0, "7": 0 };
const HUMAN = 0; // P1 = You

const BOT_STORAGE_KEY = "card29_bot_names_v1";
const DEFAULT_BOT_NAMES = {
  west: "West",     // P2
  partner: "Partner", // P3
  east: "East",     // P4
};

function loadBotNames() {
  try {
    const saved = JSON.parse(localStorage.getItem(BOT_STORAGE_KEY));
    return {
      west: (saved?.west || DEFAULT_BOT_NAMES.west).trim() || DEFAULT_BOT_NAMES.west,
      partner: (saved?.partner || DEFAULT_BOT_NAMES.partner).trim() || DEFAULT_BOT_NAMES.partner,
      east: (saved?.east || DEFAULT_BOT_NAMES.east).trim() || DEFAULT_BOT_NAMES.east,
    };
  } catch {
    return { ...DEFAULT_BOT_NAMES };
  }
}

let botNames = loadBotNames();
const PLAYER_NAMES = [
  "You (P1)",
  `${botNames.west} (P2)`,
  `${botNames.partner} (P3)`,
  `${botNames.east} (P4)`,
];

function syncPlayerNames() {
  PLAYER_NAMES[0] = "You (P1)";
  PLAYER_NAMES[1] = `${botNames.west} (P2)`;
  PLAYER_NAMES[2] = `${botNames.partner} (P3)`;
  PLAYER_NAMES[3] = `${botNames.east} (P4)`;
}

// Lightweight Web Audio Sound Engine (no external files needed)
const soundFX = {
  enabled: true,
  ctx: null,
  ensureCtx() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  },
  playTone(freq, duration = 0.09, type = "sine", gainVal = 0.08, delay = 0) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  },
  click() {
    this.playTone(540, 0.05, "triangle", 0.06);
  },
  cardPlay() {
    this.playTone(210, 0.06, "sine", 0.11);
    this.playTone(130, 0.07, "triangle", 0.07, 0.015);
  },
  trumpReveal() {
    this.playTone(523.25, 0.12, "triangle", 0.09, 0);
    this.playTone(659.25, 0.14, "triangle", 0.09, 0.09);
    this.playTone(783.99, 0.2, "triangle", 0.1, 0.18);
  },
  win() {
    this.playTone(523.25, 0.12, "sine", 0.09, 0);
    this.playTone(659.25, 0.12, "sine", 0.09, 0.1);
    this.playTone(783.99, 0.14, "sine", 0.09, 0.2);
    this.playTone(1046.5, 0.24, "sine", 0.1, 0.3);
  },
};

const state = {
  hands: [[], [], [], []],
  dealer: 3,
  currentBid: 0,
  bidder: null,
  stakeMultiplier: 1,
  trump: null,
  trumpRevealed: false,
  animateTrumpReveal: false,
  leader: 1,
  trickNumber: 1,
  played: [],
  lastTrick: null,
  teamPoints: [0, 0],
  activePlayer: null,
  lastPlayedPlayer: null,
  phase: "idle",
  bidResolver: null,
  doubleResolver: null,
  trumpResolver: null,
  playResolver: null,
};

const els = {
  startLobby: document.getElementById("startLobby"),
  botPartnerInput: document.getElementById("botPartnerInput"),
  botWestInput: document.getElementById("botWestInput"),
  botEastInput: document.getElementById("botEastInput"),
  resetBotNamesBtn: document.getElementById("resetBotNamesBtn"),
  startGameBtn: document.getElementById("startGameBtn"),
  openLobbyBtn: document.getElementById("openLobbyBtn"),
  yourScore: document.getElementById("yourScore"),
  oppScore: document.getElementById("oppScore"),
  bidderLabel: document.getElementById("bidderLabel"),
  bidValue: document.getElementById("bidValue"),
  stakeLabel: document.getElementById("stakeLabel"),
  trumpCardFace: document.getElementById("trumpCardFace"),
  trumpSubLabel: document.getElementById("trumpSubLabel"),
  statusText: document.getElementById("statusText"),
  myHand: document.getElementById("myHand"),
  p2Backs: document.getElementById("p2Backs"),
  p3Backs: document.getElementById("p3Backs"),
  p4Backs: document.getElementById("p4Backs"),
  slotP1: document.getElementById("slotP1"),
  slotP2: document.getElementById("slotP2"),
  slotP3: document.getElementById("slotP3"),
  slotP4: document.getElementById("slotP4"),
  seatP2: document.getElementById("seatP2"),
  seatP3: document.getElementById("seatP3"),
  seatP4: document.getElementById("seatP4"),
  badgeP1: document.getElementById("badgeP1"),
  badgeP2: document.getElementById("badgeP2"),
  badgeP3: document.getElementById("badgeP3"),
  badgeP4: document.getElementById("badgeP4"),
  p1Label: document.getElementById("p1Label"),
  p2Label: document.getElementById("p2Label"),
  p3Label: document.getElementById("p3Label"),
  p4Label: document.getElementById("p4Label"),
  soundToggleBtn: document.getElementById("soundToggleBtn"),
  lastHandBtn: document.getElementById("lastHandBtn"),
  showTrumpBtn: document.getElementById("showTrumpBtn"),
  newGameBtn: document.getElementById("newGameBtn"),
  bidModal: document.getElementById("bidModal"),
  bidPromptText: document.getElementById("bidPromptText"),
  bidButtonsGrid: document.getElementById("bidButtonsGrid"),
  doubleModal: document.getElementById("doubleModal"),
  doubleTitle: document.getElementById("doubleTitle"),
  doubleDesc: document.getElementById("doubleDesc"),
  acceptDoubleBtn: document.getElementById("acceptDoubleBtn"),
  declineDoubleBtn: document.getElementById("declineDoubleBtn"),
  trumpModal: document.getElementById("trumpModal"),
  seventhCardInfo: document.getElementById("seventhCardInfo"),
  use7thCardBtn: document.getElementById("use7thCardBtn"),
  useJokerTrumpBtn: document.getElementById("useJokerTrumpBtn"),
  lastHandModal: document.getElementById("lastHandModal"),
  lastHandWinner: document.getElementById("lastHandWinner"),
  lastHandCards: document.getElementById("lastHandCards"),
  closeLastHandBtn: document.getElementById("closeLastHandBtn"),
  resultModal: document.getElementById("resultModal"),
  resultTitle: document.getElementById("resultTitle"),
  resultDetail: document.getElementById("resultDetail"),
  continueBtn: document.getElementById("continueBtn"),
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, points: POINTS[rank] });
    }
  }
  return deck;
}

function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function rankPower(card) {
  return RANKS.indexOf(card.rank);
}

function sortHand(hand) {
  return [...hand].sort((a, b) => {
    const suitDiff = SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    if (suitDiff !== 0) return suitDiff;
    return rankPower(a) - rankPower(b);
  });
}

function isRed(suit) {
  return suit === "♥" || suit === "♦";
}

function legalCards(hand, played) {
  if (played.length === 0) return hand;
  const leadSuit = played[0].card.suit;
  const same = hand.filter((c) => c.suit === leadSuit);
  return same.length > 0 ? same : hand;
}

function trickWinner(played, trump, trumpRevealed) {
  let best = played[0];
  for (const p of played.slice(1)) {
    const cs = p.card.suit;
    const bs = best.card.suit;
    if (cs === bs) {
      if (rankPower(p.card) < rankPower(best.card)) best = p;
    } else if (trumpRevealed && trump === "JOKER" && bs !== played[0].card.suit) {
      if (rankPower(p.card) < rankPower(best.card)) best = p;
    } else if (trumpRevealed && cs === trump && bs !== trump) {
      best = p;
    }
  }
  return best.player;
}

function botBid(hand, currentBid) {
  let total = 0;
  for (const c of hand) total += c.points;
  let wanted = 0;
  if (total >= 6) wanted = 21;
  else if (total >= 5) wanted = 19;
  else if (total >= 4) wanted = 17;
  else if (total >= 3) wanted = 16;
  return wanted > currentBid ? wanted : "pass";
}

function botChooseTrump(hand) {
  const score = {};
  for (const s of SUITS) score[s] = 0;
  for (const c of hand) score[c.suit] += c.points + 1;
  let best = SUITS[0];
  for (const s of SUITS) {
    if (score[s] > score[best]) best = s;
  }
  return best;
}

function botShouldDouble(hand, currentBid) {
  let highCards = 0;
  for (const c of hand) {
    if (c.rank === "J" || c.rank === "9" || c.rank === "A") highCards++;
  }
  return highCards >= 3 && currentBid >= 17;
}

function botPlay(hand, played, trump, trumpRevealed) {
  const legal = [...legalCards(hand, played)];
  legal.sort((a, b) => rankPower(b) - rankPower(a));
  if (played.length === 3) {
    for (const c of legal) {
      const test = [...played, { player: -1, card: c }];
      if (trickWinner(test, trump, trumpRevealed) === -1) return c;
    }
  }
  return legal[0];
}

function checkCouple(hands, trump) {
  const bonus = [0, 0];
  const notes = [];
  if (!trump || trump === "JOKER") return { bonus, notes };
  for (let team = 0; team < 2; team++) {
    const combined = [...hands[team], ...hands[team + 2]];
    const hasK = combined.some((c) => c.suit === trump && c.rank === "K");
    const hasQ = combined.some((c) => c.suit === trump && c.rank === "Q");
    if (hasK && hasQ) {
      bonus[team] = 4;
      notes.push(`Team ${team + 1} Couple (+4)`);
    }
  }
  return { bonus, notes };
}

function makeCardEl(card, clickable = false, onClick = null, extraClass = "") {
  const el = document.createElement("div");
  el.className =
    "card-tile" +
    (isRed(card.suit) ? " red" : "") +
    (extraClass ? ` ${extraClass}` : "");
  if (clickable) {
    el.classList.add("playable");
    el.addEventListener("click", onClick);
  } else if (state.phase === "playing") {
    el.classList.add("disabled");
  }

  const isFace = card.rank === "J" || card.rank === "Q" || card.rank === "K";
  const centerMarkup = isFace
    ? `<div class="face-emblem"><span class="face-letter">${card.rank}</span><span class="face-suit">${card.suit}</span></div>`
    : `<span class="center-suit-big">${card.suit}</span>`;

  el.innerHTML = `
    <div class="card-corner top">
      <span class="corner-rank">${card.rank}</span>
      <span class="corner-suit">${card.suit}</span>
    </div>
    <div class="card-center-art">${centerMarkup}</div>
    <div class="card-corner bottom">
      <span class="corner-rank">${card.rank}</span>
      <span class="corner-suit">${card.suit}</span>
    </div>
  `;
  return el;
}

function renderBacks(container, count) {
  container.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const b = document.createElement("div");
    b.className = "mini-back";
    container.appendChild(b);
  }
}

function renderTurnIndicators() {
  const seats = [null, els.seatP2, els.seatP3, els.seatP4];
  const badges = [els.badgeP1, els.badgeP2, els.badgeP3, els.badgeP4];

  for (let i = 0; i < 4; i++) {
    if (seats[i]) {
      seats[i].classList.toggle("active-turn", state.activePlayer === i);
    }
    if (badges[i]) {
      const isTurn = state.activePlayer === i;
      const justPlayed =
        !isTurn && state.lastPlayedPlayer === i && state.phase === "playing";
      badges[i].classList.toggle("hidden", !isTurn && !justPlayed);
      if (isTurn) {
        badges[i].textContent = i === HUMAN ? "YOUR TURN" : "TURN";
      } else if (justPlayed) {
        badges[i].textContent = "PLAYED";
      }
    }
  }

  els.myHand.classList.toggle("active-turn", state.activePlayer === HUMAN);
}

function renderHUD() {
  els.yourScore.textContent = state.teamPoints[0];
  els.oppScore.textContent = state.teamPoints[1];
  els.bidderLabel.textContent =
    state.bidder !== null ? `Bid: P${state.bidder + 1}` : "Bid: --";
  els.bidValue.textContent = state.currentBid > 0 ? state.currentBid : "--";
  els.stakeLabel.textContent = `${state.stakeMultiplier}x`;

  const animCls = state.animateTrumpReveal ? " reveal-anim" : "";
  if (state.trumpRevealed && state.trump) {
    if (state.trump === "JOKER") {
      els.trumpCardFace.className = "trump-mini-card" + animCls;
      els.trumpCardFace.innerHTML = `<span class="trump-card-rank">JOKER</span><span class="trump-card-suit">🃏</span>`;
      els.trumpSubLabel.textContent = "TRUMP (🃏)";
    } else {
      els.trumpCardFace.className =
        "trump-mini-card" + (isRed(state.trump) ? " red" : "") + animCls;
      els.trumpCardFace.innerHTML = `<span class="trump-card-rank">A</span><span class="trump-card-suit">${state.trump}</span>`;
      els.trumpSubLabel.textContent = `TRUMP (${state.trump})`;
    }
    state.animateTrumpReveal = false;
  } else {
    els.trumpCardFace.className = "trump-mini-card back";
    els.trumpCardFace.textContent = "🂠";
    els.trumpSubLabel.textContent = state.trump ? "TRUMP (HIDDEN)" : "TRUMP";
  }

  const canReveal =
    state.phase === "playing" &&
    !state.trumpRevealed &&
    state.trump !== null &&
    state.played.length > 0 &&
    !state.hands[HUMAN].some((c) => c.suit === state.played[0].card.suit);
  els.showTrumpBtn.disabled = !canReveal;
  els.lastHandBtn.disabled = !state.lastTrick;
}

function renderTable() {
  syncPlayerNames();
  renderHUD();
  renderTurnIndicators();
  renderBacks(els.p2Backs, state.hands[1].length);
  renderBacks(els.p3Backs, state.hands[2].length);
  renderBacks(els.p4Backs, state.hands[3].length);

  els.p1Label.textContent = `You (P1) — Team 1${state.bidder === 0 ? ` [Bid ${state.currentBid}]` : ""}`;
  els.p2Label.textContent = `${botNames.west}${state.bidder === 1 ? ` (${state.currentBid})` : ""}`;
  els.p3Label.textContent = `${botNames.partner}${state.bidder === 2 ? ` (${state.currentBid})` : ""}`;
  els.p4Label.textContent = `${botNames.east}${state.bidder === 3 ? ` (${state.currentBid})` : ""}`;

  els.slotP1.innerHTML = "";
  els.slotP2.innerHTML = "";
  els.slotP3.innerHTML = "";
  els.slotP4.innerHTML = "";

  const slotMap = [els.slotP1, els.slotP2, els.slotP3, els.slotP4];
  state.played.forEach((item) => {
    const isFresh = item.player === state.lastPlayedPlayer;
    slotMap[item.player].appendChild(
      makeCardEl(item.card, false, null, isFresh ? "played-anim" : "")
    );
  });

  state.hands[HUMAN] = sortHand(state.hands[HUMAN]);
  els.myHand.innerHTML = "";
  const isHumanTurn =
    state.phase === "playing" &&
    state.played.length < 4 &&
    (state.leader + state.played.length) % 4 === HUMAN;

  const legal = isHumanTurn ? legalCards(state.hands[HUMAN], state.played) : [];

  state.hands[HUMAN].forEach((card) => {
    const allowed = isHumanTurn && legal.includes(card);
    els.myHand.appendChild(
      makeCardEl(card, allowed, () => {
        if (allowed && state.playResolver) {
          const resolve = state.playResolver;
          state.playResolver = null;
          resolve(card);
        }
      })
    );
  });
}

function triggerTrumpReveal() {
  if (!state.trumpRevealed && state.trump) {
    state.trumpRevealed = true;
    state.animateTrumpReveal = true;
    soundFX.trumpReveal();
  }
}

function promptHumanBid(minNext) {
  return new Promise((resolve) => {
    state.bidResolver = resolve;
    els.bidPromptText.textContent =
      state.currentBid === 0
        ? "Minimum bid is 16, or choose PASS"
        : `Current bid is ${state.currentBid} — bid at least ${minNext} or PASS`;

    els.bidButtonsGrid.innerHTML = "";
    for (let n = 28; n >= 16; n--) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bid-circle";
      btn.textContent = n;
      btn.disabled = n < minNext;
      btn.addEventListener("click", () => {
        soundFX.click();
        els.bidModal.classList.add("hidden");
        state.bidResolver = null;
        resolve(n);
      });
      els.bidButtonsGrid.appendChild(btn);
    }

    const passBtn = document.createElement("button");
    passBtn.type = "button";
    passBtn.className = "bid-circle pass-btn";
    passBtn.textContent = "PASS";
    passBtn.addEventListener("click", () => {
      soundFX.click();
      els.bidModal.classList.add("hidden");
      state.bidResolver = null;
      resolve("pass");
    });
    els.bidButtonsGrid.appendChild(passBtn);

    els.bidModal.classList.remove("hidden");
  });
}

function promptHumanDouble(title, desc) {
  return new Promise((resolve) => {
    state.doubleResolver = resolve;
    els.doubleTitle.textContent = title;
    els.doubleDesc.textContent = desc;
    els.doubleModal.classList.remove("hidden");
  });
}

els.acceptDoubleBtn.addEventListener("click", () => {
  soundFX.click();
  els.doubleModal.classList.add("hidden");
  if (state.doubleResolver) {
    const r = state.doubleResolver;
    state.doubleResolver = null;
    r(true);
  }
});

els.declineDoubleBtn.addEventListener("click", () => {
  soundFX.click();
  els.doubleModal.classList.add("hidden");
  if (state.doubleResolver) {
    const r = state.doubleResolver;
    state.doubleResolver = null;
    r(false);
  }
});

function getSeventhCard() {
  return (
    state.hands[HUMAN][6] ||
    state.hands[HUMAN][state.hands[HUMAN].length - 1] ||
    null
  );
}

function promptHumanTrump() {
  return new Promise((resolve) => {
    state.trumpResolver = resolve;
    const seventh = getSeventhCard();
    if (seventh) {
      els.seventhCardInfo.textContent = `Your 7th Card: ${seventh.rank}${seventh.suit} (Suit: ${seventh.suit})`;
      els.use7thCardBtn.disabled = false;
      els.use7thCardBtn.textContent = `Use 7th Card Suit (${seventh.suit})`;
    } else {
      els.seventhCardInfo.textContent = "7th Card not available";
      els.use7thCardBtn.disabled = true;
    }
    els.trumpModal.classList.remove("hidden");
  });
}

document.querySelectorAll(".suit-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    soundFX.click();
    els.trumpModal.classList.add("hidden");
    if (state.trumpResolver) {
      const r = state.trumpResolver;
      state.trumpResolver = null;
      r(btn.dataset.suit);
    }
  });
});

els.use7thCardBtn.addEventListener("click", () => {
  const seventh = getSeventhCard();
  if (!seventh) return;
  soundFX.click();
  els.trumpModal.classList.add("hidden");
  if (state.trumpResolver) {
    const r = state.trumpResolver;
    state.trumpResolver = null;
    r(seventh.suit);
  }
});

els.useJokerTrumpBtn.addEventListener("click", () => {
  soundFX.click();
  els.trumpModal.classList.add("hidden");
  if (state.trumpResolver) {
    const r = state.trumpResolver;
    state.trumpResolver = null;
    r("JOKER");
  }
});

els.showTrumpBtn.addEventListener("click", () => {
  if (!state.trumpRevealed && state.trump) {
    triggerTrumpReveal();
    els.statusText.textContent = `Trump revealed: ${state.trump === "JOKER" ? "Joker (🃏)" : state.trump}`;
    renderTable();
  }
});

els.soundToggleBtn.addEventListener("click", () => {
  soundFX.enabled = !soundFX.enabled;
  els.soundToggleBtn.textContent = soundFX.enabled ? "Sound: ON" : "Sound: OFF";
  els.soundToggleBtn.classList.toggle("sound-on", soundFX.enabled);
  els.soundToggleBtn.classList.toggle("sound-off", !soundFX.enabled);
  if (soundFX.enabled) soundFX.click();
});

els.lastHandBtn.addEventListener("click", () => {
  if (!state.lastTrick) return;
  soundFX.click();
  els.lastHandWinner.textContent = `Won by ${PLAYER_NAMES[state.lastTrick.winner]}`;
  els.lastHandCards.innerHTML = "";
  state.lastTrick.cards.forEach((item) => {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = "center";
    wrap.style.gap = "4px";
    wrap.appendChild(makeCardEl(item.card, false));
    const cap = document.createElement("span");
    cap.style.fontSize = "11px";
    cap.textContent = PLAYER_NAMES[item.player].split(" ")[0];
    wrap.appendChild(cap);
    els.lastHandCards.appendChild(wrap);
  });
  els.lastHandModal.classList.remove("hidden");
});

els.closeLastHandBtn.addEventListener("click", () => {
  soundFX.click();
  els.lastHandModal.classList.add("hidden");
});

function waitHumanCard() {
  return new Promise((resolve) => {
    state.playResolver = resolve;
  });
}

async function startGame() {
  els.resultModal.classList.add("hidden");
  els.bidModal.classList.add("hidden");
  els.doubleModal.classList.add("hidden");
  els.trumpModal.classList.add("hidden");
  els.lastHandModal.classList.add("hidden");

  syncPlayerNames();

  const deck = shuffle(createDeck());
  state.hands = [[], [], [], []];
  state.dealer = (state.dealer + 1) % 4;
  state.currentBid = 0;
  state.bidder = null;
  state.stakeMultiplier = 1;
  state.trump = null;
  state.trumpRevealed = false;
  state.animateTrumpReveal = false;
  state.leader = (state.dealer + 1) % 4;
  state.trickNumber = 1;
  state.played = [];
  state.lastTrick = null;
  state.teamPoints = [0, 0];
  state.activePlayer = null;
  state.lastPlayedPlayer = null;
  state.phase = "bidding";

  for (let i = 0; i < 16; i++) state.hands[i % 4].push(deck.shift());
  renderTable();
  els.statusText.textContent = "Bidding round started...";
  await sleep(450);

  const passed = [false, false, false, false];
  let turn = (state.dealer + 1) % 4;

  while (true) {
    const active = passed.filter((p) => !p).length;
    if (state.bidder !== null && active === 1) break;
    if (active === 0) break;

    if (!passed[turn]) {
      state.activePlayer = turn;
      renderTurnIndicators();

      let bid;
      if (turn === HUMAN) {
        const minNext = state.currentBid === 0 ? 16 : state.currentBid + 1;
        els.statusText.textContent = "Your turn to bid...";
        bid = await promptHumanBid(minNext);
      } else {
        els.statusText.textContent = `${PLAYER_NAMES[turn]} is bidding...`;
        await sleep(360);
        bid = botBid(state.hands[turn], state.currentBid);
      }

      if (bid === "pass") {
        passed[turn] = true;
        els.statusText.textContent = `${PLAYER_NAMES[turn]} passed`;
      } else {
        state.currentBid = bid;
        state.bidder = turn;
        els.statusText.textContent = `${PLAYER_NAMES[turn]} bid ${bid}`;
        if (bid === 28) break;
      }
      renderHUD();
      await sleep(360);
    }
    turn = (turn + 1) % 4;
  }

  state.activePlayer = null;
  renderTurnIndicators();

  if (state.bidder === null) {
    els.statusText.textContent = "All passed! Redealing...";
    await sleep(850);
    return startGame();
  }

  const bidderTeam = state.bidder % 2;
  state.phase = "double";
  if (bidderTeam === 0) {
    const oppWantsDouble =
      botShouldDouble(state.hands[1], state.currentBid) ||
      botShouldDouble(state.hands[3], state.currentBid);
    if (oppWantsDouble) {
      state.stakeMultiplier = 2;
      renderHUD();
      els.statusText.textContent = `Opponent DOUBLED bid ${state.currentBid} (2x)!`;
      await sleep(600);

      const reDouble = await promptHumanDouble(
        "Re-double (4x)?",
        `Opponent doubled your bid of ${state.currentBid}. Do you want to Re-double for 4x points?`
      );
      if (reDouble) {
        state.stakeMultiplier = 4;
        renderHUD();
        els.statusText.textContent = "Your team RE-DOUBLED (4x)!";
        await sleep(550);
      }
    }
  } else {
    const wantDouble = await promptHumanDouble(
      "Double Bid?",
      `${PLAYER_NAMES[state.bidder]} bid ${state.currentBid}. Double for 2x points?`
    );
    if (wantDouble) {
      state.stakeMultiplier = 2;
      renderHUD();
      els.statusText.textContent = "You DOUBLED the bid (2x)!";
      await sleep(500);

      const botReDouble =
        botShouldDouble(state.hands[state.bidder], state.currentBid) &&
        state.currentBid >= 19;
      if (botReDouble) {
        state.stakeMultiplier = 4;
        renderHUD();
        els.statusText.textContent = `${PLAYER_NAMES[state.bidder]} RE-DOUBLED (4x)!`;
        await sleep(600);
      }
    }
  }

  for (let i = 0; i < 16; i++) state.hands[i % 4].push(deck.shift());
  renderTable();

  state.phase = "trump";
  if (state.bidder === HUMAN) {
    els.statusText.textContent = "You won the bid — choose Trump";
    state.trump = await promptHumanTrump();
  } else {
    state.trump = botChooseTrump(state.hands[state.bidder]);
    els.statusText.textContent = `${PLAYER_NAMES[state.bidder]} (${state.currentBid}) selected hidden Trump`;
  }

  state.phase = "playing";
  renderTable();
  await sleep(420);

  for (let trick = 1; trick <= 8; trick++) {
    state.trickNumber = trick;
    state.played = [];
    state.lastPlayedPlayer = null;
    renderTable();

    for (let k = 0; k < 4; k++) {
      const p = (state.leader + k) % 4;
      state.activePlayer = p;

      const hasLead =
        state.played.length === 0 ||
        state.hands[p].some((c) => c.suit === state.played[0].card.suit);

      if (!hasLead && !state.trumpRevealed && p !== HUMAN) {
        triggerTrumpReveal();
        els.statusText.textContent = `${PLAYER_NAMES[p]} could not follow suit! Trump revealed: ${state.trump === "JOKER" ? "Joker (🃏)" : state.trump}`;
        renderHUD();
        await sleep(500);
      }

      let card;
      if (p === HUMAN) {
        els.statusText.textContent = `Trick ${trick}/8 — ${PLAYER_NAMES[p]} turn`;
        renderTable();
        card = await waitHumanCard();
      } else {
        els.statusText.textContent = `Trick ${trick}/8 — ${PLAYER_NAMES[p]} playing card...`;
        renderTable();
        await sleep(380);
        card = botPlay(
          state.hands[p],
          state.played,
          state.trump,
          state.trumpRevealed
        );
      }

      state.hands[p] = state.hands[p].filter((c) => c !== card);
      state.played.push({ player: p, card });
      state.lastPlayedPlayer = p;
      state.activePlayer = null;
      soundFX.cardPlay();
      els.statusText.textContent = `Trick ${trick}/8 — ${PLAYER_NAMES[p]} played ${card.rank}${card.suit}`;
      renderTable();
      await sleep(220);
    }

    const winner = trickWinner(
      state.played,
      state.trump,
      state.trumpRevealed
    );
    const pts = state.played.reduce((s, x) => s + x.card.points, 0);
    const lastBonus = trick === 8 ? 1 : 0;
    state.teamPoints[winner % 2] += pts + lastBonus;
    state.lastTrick = { cards: [...state.played], winner };
    state.leader = winner;
    state.lastPlayedPlayer = null;

    if (winner % 2 === 0) soundFX.win();
    els.statusText.textContent = `Trick ${trick} won by ${PLAYER_NAMES[winner]} (+${pts + lastBonus})`;
    renderHUD();
    renderTurnIndicators();
    await sleep(750);
  }

  state.phase = "finished";
  state.activePlayer = null;
  state.lastPlayedPlayer = null;
  const couple = checkCouple(state.hands, state.trump);
  const rawScores = [
    state.teamPoints[0] + couple.bonus[0],
    state.teamPoints[1] + couple.bonus[1],
  ];
  const bidSucceeded = rawScores[bidderTeam] >= state.currentBid;
  const stakeValue = state.currentBid * state.stakeMultiplier;

  const finalDisplayScores = [rawScores[0], rawScores[1]];
  if (bidSucceeded) {
    finalDisplayScores[bidderTeam] = Math.max(rawScores[bidderTeam], stakeValue);
  } else {
    finalDisplayScores[1 - bidderTeam] = Math.max(
      rawScores[1 - bidderTeam],
      stakeValue
    );
  }
  state.teamPoints = finalDisplayScores;
  renderHUD();
  renderTurnIndicators();

  const youWonRound =
    (bidderTeam === 0 && bidSucceeded) || (bidderTeam !== 0 && !bidSucceeded);
  if (youWonRound) soundFX.win();

  els.resultTitle.textContent =
    bidderTeam === 0
      ? bidSucceeded
        ? "Your team has won!"
        : "Your team missed the bid!"
      : !bidSucceeded
        ? "Your team has won!"
        : "Opponent won the bid!";

  const coupleText =
    couple.notes.length > 0 ? couple.notes.join(", ") : "No Couple";
  els.resultDetail.textContent = `Bid: ${state.currentBid} (${state.stakeMultiplier}x) by ${PLAYER_NAMES[state.bidder]} | Trick Pts: ${rawScores[0]} vs ${rawScores[1]} | Final: ${finalDisplayScores[0]} vs ${finalDisplayScores[1]} | ${coupleText}`;
  els.resultModal.classList.remove("hidden");
}

function syncLobbyInputs() {
  if (els.botPartnerInput) els.botPartnerInput.value = botNames.partner;
  if (els.botWestInput) els.botWestInput.value = botNames.west;
  if (els.botEastInput) els.botEastInput.value = botNames.east;
}

function saveLobbyNames() {
  botNames = {
    partner: (els.botPartnerInput?.value || DEFAULT_BOT_NAMES.partner).trim() || DEFAULT_BOT_NAMES.partner,
    west: (els.botWestInput?.value || DEFAULT_BOT_NAMES.west).trim() || DEFAULT_BOT_NAMES.west,
    east: (els.botEastInput?.value || DEFAULT_BOT_NAMES.east).trim() || DEFAULT_BOT_NAMES.east,
  };
  try {
    localStorage.setItem(BOT_STORAGE_KEY, JSON.stringify(botNames));
  } catch {}
  syncPlayerNames();
  renderTable();
}

function openLobby() {
  soundFX.click();
  syncLobbyInputs();
  if (els.startLobby) {
    els.startLobby.classList.remove("hidden");
    els.startLobby.style.display = "flex";
  }
}

function closeLobby() {
  if (els.startLobby) {
    els.startLobby.classList.add("hidden");
    els.startLobby.style.display = "none";
  }
}

els.startGameBtn?.addEventListener("click", () => {
  soundFX.click();
  saveLobbyNames();
  closeLobby();
  startGame();
});

els.resetBotNamesBtn?.addEventListener("click", () => {
  soundFX.click();
  botNames = { ...DEFAULT_BOT_NAMES };
  try {
    localStorage.setItem(BOT_STORAGE_KEY, JSON.stringify(botNames));
  } catch {}
  syncLobbyInputs();
  syncPlayerNames();
  renderTable();
});

els.openLobbyBtn?.addEventListener("click", openLobby);

els.newGameBtn.addEventListener("click", () => {
  soundFX.click();
  startGame();
});

els.continueBtn.addEventListener("click", () => {
  soundFX.click();
  startGame();
});

// পেজ খুললেই অটো-স্টার্ট হবে না; Start Game চাপার অপেক্ষায় থাকবে
syncLobbyInputs();
renderTable();
openLobby();
