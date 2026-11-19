// ===== 29 Card Game: Sound Effects, True Shuffle, Custom Names, ±6 Win/Loss & Pit-Gated Marriage =====
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["J", "9", "A", "10", "K", "Q", "8", "7"];
const POINTS = { J: 3, "9": 2, A: 1, "10": 1, K: 0, Q: 0, "8": 0, "7": 0 };
const HUMAN = 0; // You
const TARGET_MARK = 6; // +6 win, -6 loss
const MARRIAGE_BONUS = 4; // Marriage = +4 points (after winning at least 1 pit/trick)

const DEFAULT_PLAYER_NAMES = ["You", "West", "Partner", "East"];
const STORAGE_KEY = "game29_custom_names_v1";

function loadCustomNames() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_PLAYER_NAMES];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 4) {
      return [...DEFAULT_PLAYER_NAMES];
    }
    return DEFAULT_PLAYER_NAMES.map((def, i) =>
      typeof parsed[i] === "string" && parsed[i].trim()
        ? parsed[i].trim().slice(0, 16)
        : def
    );
  } catch {
    return [...DEFAULT_PLAYER_NAMES];
  }
}

function saveCustomNames(names) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
  } catch {
    // স্টোরেজ সীমা বা প্রাইভেট মোডে ইগনোর করবে
  }
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
  marriageFanfare() {
    this.playTone(587.33, 0.11, "triangle", 0.09, 0);
    this.playTone(739.99, 0.11, "triangle", 0.09, 0.08);
    this.playTone(880.0, 0.14, "triangle", 0.1, 0.16);
    this.playTone(1174.66, 0.24, "sine", 0.1, 0.25);
  },
  win() {
    this.playTone(523.25, 0.12, "sine", 0.09, 0);
    this.playTone(659.25, 0.12, "sine", 0.09, 0.1);
    this.playTone(783.99, 0.14, "sine", 0.09, 0.2);
    this.playTone(1046.5, 0.24, "sine", 0.1, 0.3);
  },
};

const state = {
  playerNames: loadCustomNames(),
  deck: [],
  hands: [[], [], [], []],
  dealtHands: [[], [], [], []],
  dealer: 0,
  currentBid: 0,
  bidder: null,
  trumpMaker: null,
  stakeMultiplier: 1,
  doubledBy: null,
  redoubledBy: null,
  trump: null,
  trumpRevealed: false,
  animateTrumpReveal: false,
  revealedSeventhCard: null,
  teamTricksWon: [0, 0], // [Team 0 pits, Team 1 pits]
  marriageDeclared: [false, false], // [Team 0, Team 1]
  marriageBonus: [0, 0], // [Team 0, Team 1]
  leader: 1,
  trickNumber: 1,
  played: [],
  lastTrick: null,
  trickPoints: [0, 0],
  teamMarks: [0, 0],
  matchOver: false,
  matchWinnerTeam: null,
  activePlayer: null,
  lastPlayedPlayer: null,
  phase: "idle",
  bidResolver: null,
  doubleResolver: null,
  trumpResolver: null,
  playResolver: null,
};

const els = {
  yourScore: document.getElementById("yourScore"),
  oppScore: document.getElementById("oppScore"),
  yourPileCards: document.getElementById("yourPileCards"),
  oppPileCards: document.getElementById("oppPileCards"),
  yourMarkText: document.getElementById("yourMarkText"),
  oppMarkText: document.getElementById("oppMarkText"),
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

function getPlayerName(idx) {
  return (
    state.playerNames[idx] ||
    DEFAULT_PLAYER_NAMES[idx] ||
    "Player"
  );
}

function getTeamDisplayName(teamIdx) {
  if (teamIdx === 0) {
    return `Your Team (${getPlayerName(0)} & ${getPlayerName(2)})`;
  }
  return `Opponent (${getPlayerName(1)} & ${getPlayerName(3)})`;
}

function getShortTeamName(teamIdx) {
  return teamIdx === 0 ? "Your Team" : "Opponent";
}

function updateMarriageBanner() {
  let banner = document.getElementById("marriageBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "marriageBanner";
    banner.style.cssText =
      "margin:4px auto;padding:4px 12px;border-radius:999px;background:linear-gradient(90deg,#f59e0b,#eab308);color:#0f172a;font-size:12px;font-weight:800;display:inline-block;box-shadow:0 2px 8px rgba(0,0,0,0.25);";
    if (els.statusText && els.statusText.parentNode) {
      els.statusText.parentNode.insertBefore(banner, els.statusText.nextSibling);
    }
  }

  const activeTeams = [];
  if (state.marriageDeclared[0]) {
    activeTeams.push(`${getShortTeamName(0)} Marriage (+${MARRIAGE_BONUS})`);
  }
  if (state.marriageDeclared[1]) {
    activeTeams.push(`${getShortTeamName(1)} Marriage (+${MARRIAGE_BONUS})`);
  }

  if (activeTeams.length === 0 || state.phase === "idle") {
    banner.style.display = "none";
    banner.textContent = "";
    return;
  }

  banner.style.display = "inline-block";
  banner.textContent = `💍 ${activeTeams.join(" • ")}`;
}

// শর্ত: ট্রাম্প রিভিল হওয়া থাকতে হবে, হাতে K + Q (ট্রাম্প স্যুটের) থাকতে হবে,
// এবং অন্তত ১টি Pit (Trick) জেতা থাকতে হবে — আগে Pit না পেলে Marriage শো হবে না।
function evaluateInternationalMarriage(announceNow = true) {
  if (!state.trumpRevealed || !state.trump || state.trump === "JOKER") {
    updateMarriageBanner();
    return;
  }

  const sourceHands =
    state.dealtHands && state.dealtHands[0].length > 0
      ? state.dealtHands
      : state.hands;

  const newlyAnnounced = [];

  for (let team = 0; team < 2; team++) {
    if (state.marriageDeclared[team]) continue;

    // আগে অন্তত ১টি Pit (Trick) না পেলে Marriage শো হবে না
    if ((state.teamTricksWon[team] || 0) < 1) {
      continue;
    }

    const pA = sourceHands[team] || [];
    const pB = sourceHands[team + 2] || [];
    const combined = [...pA, ...pB];

    const hasK = combined.some((c) => c.suit === state.trump && c.rank === "K");
    const hasQ = combined.some((c) => c.suit === state.trump && c.rank === "Q");

    if (hasK && hasQ) {
      state.marriageDeclared[team] = true;
      state.marriageBonus[team] = MARRIAGE_BONUS;

      let holderName = getShortTeamName(team);
      if (
        pA.some((c) => c.suit === state.trump && c.rank === "K") &&
        pA.some((c) => c.suit === state.trump && c.rank === "Q")
      ) {
        holderName = getPlayerName(team);
      } else if (
        pB.some((c) => c.suit === state.trump && c.rank === "K") &&
        pB.some((c) => c.suit === state.trump && c.rank === "Q")
      ) {
        holderName = getPlayerName(team + 2);
      } else {
        holderName = `${getPlayerName(team)} & ${getPlayerName(team + 2)}`;
      }

      newlyAnnounced.push(
        `Marriage by ${holderName} (1+ Pit won & K${state.trump} + Q${state.trump}, +${MARRIAGE_BONUS} pts)`
      );
    }
  }

  if (newlyAnnounced.length > 0 && announceNow) {
    soundFX.marriageFanfare();
    els.statusText.textContent = newlyAnnounced.join(" | ");
  }

  updateMarriageBanner();
}

function updateSeventhLeadBanner() {
  let banner = document.getElementById("seventhLeadBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "seventhLeadBanner";
    banner.className = "seventh-lead-banner hidden";
    if (els.statusText && els.statusText.parentNode) {
      els.statusText.parentNode.insertBefore(banner, els.statusText.nextSibling);
    }
  }

  const shouldShow =
    state.revealedSeventhCard !== null &&
    state.phase !== "finished" &&
    state.phase !== "idle";

  if (!shouldShow) {
    banner.classList.add("hidden");
    banner.textContent = "";
    return;
  }

  const c = state.revealedSeventhCard;
  const makerName =
    state.trumpMaker !== null ? ` • ${getPlayerName(state.trumpMaker)}` : "";
  banner.textContent = `7th Card: ${c.rank}${c.suit} (Trump: ${c.suit}${makerName})`;
  banner.classList.toggle("red-suit", isRed(c.suit));
  banner.classList.remove("hidden");
}

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

function secureRandomInt(max) {
  if (max <= 0) return 0;
  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    const arr = new Uint32Array(1);
    const limit = Math.floor(0xffffffff / max) * max;
    let x = 0;
    do {
      window.crypto.getRandomValues(arr);
      x = arr[0];
    } while (x >= limit);
    return x % max;
  }
  return Math.floor(Math.random() * max);
}

// জেনুইন Fisher–Yates Shuffle (একাধিক রাউন্ড পাসসহ)
function shuffle(deck) {
  const d = [...deck];
  for (let pass = 0; pass < 3; pass++) {
    for (let i = d.length - 1; i > 0; i--) {
      const j = secureRandomInt(i + 1);
      [d[i], d[j]] = [d[j], d[i]];
    }
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

function formatSignedValue(val) {
  if (val > 0) return `+${val}`;
  if (val < 0) return `${val}`;
  return "0";
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
  if (total >= 5) wanted = 20;
  else if (total >= 4) wanted = 18;
  else if (total >= 3) wanted = 17;
  else if (total >= 2) wanted = 16;
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
  return highCards >= 2 && currentBid >= 17;
}

// প্রফেশনাল ২৯ প্লেয়ার AI
function botPlay(playerIdx, hand, played, trump, trumpRevealed) {
  const legal = [...legalCards(hand, played)];
  if (legal.length === 1) return legal[0];

  const myTeam = playerIdx % 2;
  const currentTrickPts = played.reduce((sum, item) => sum + item.card.points, 0);

  if (played.length === 0) {
    const nonTrumpHigh = legal
      .filter(
        (c) =>
          c.suit !== trump &&
          (c.rank === "J" || c.rank === "9" || c.rank === "A")
      )
      .sort((a, b) => rankPower(a) - rankPower(b));

    if (nonTrumpHigh.length > 0) {
      return nonTrumpHigh[0];
    }

    const lowSafe = [...legal].sort((a, b) => {
      if (a.points !== b.points) return a.points - b.points;
      return rankPower(b) - rankPower(a);
    });
    return lowSafe[0];
  }

  const currentBestPlayer = trickWinner(played, trump, trumpRevealed);
  const partnerCurrentlyWinning = currentBestPlayer % 2 === myTeam;

  const winningCards = legal.filter((card) => {
    const simulated = [...played, { player: playerIdx, card }];
    return trickWinner(simulated, trump, trumpRevealed) === playerIdx;
  });

  if (partnerCurrentlyWinning) {
    if (currentTrickPts >= 2) {
      const pointCards = [...legal]
        .filter((c) => c.points > 0)
        .sort((a, b) => b.points - a.points || rankPower(b) - rankPower(a));
      if (pointCards.length > 0) return pointCards[0];
    }
    const dumpLow = [...legal].sort((a, b) => {
      if (a.points !== b.points) return a.points - b.points;
      return rankPower(b) - rankPower(a);
    });
    return dumpLow[0];
  }

  if (winningCards.length > 0) {
    const nonTrumpWins = winningCards.filter((c) => c.suit !== trump);
    const pool = nonTrumpWins.length > 0 ? nonTrumpWins : winningCards;

    if (currentTrickPts >= 2 || played.length === 3) {
      pool.sort((a, b) => rankPower(b) - rankPower(a));
      return pool[0];
    }

    const cheapWins = [...pool].sort((a, b) => {
      if (a.points !== b.points) return a.points - b.points;
      return rankPower(b) - rankPower(a);
    });
    return cheapWins[0];
  }

  const discardLowest = [...legal].sort((a, b) => {
    if (a.points !== b.points) return a.points - b.points;
    return rankPower(b) - rankPower(a);
  });
  return discardLowest[0];
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

function renderSidePile(cardsEl, labelEl, markVal) {
  labelEl.textContent = formatSignedValue(markVal);
  cardsEl.innerHTML = "";

  const absVal = Math.abs(markVal);
  if (absVal === 0) return;

  const isMinus = markVal < 0;
  const visiblePips = Math.min(absVal, 6);

  const card6d = document.createElement("div");
  card6d.className = "pile-card-6d" + (isMinus ? " minus-mode" : "");

  const corner = document.createElement("div");
  corner.className = "pile-6d-corner";
  corner.textContent = "6♦";
  card6d.appendChild(corner);

  const pipsWrap = document.createElement("div");
  pipsWrap.className = "pile-6d-pips";
  for (let i = 0; i < 6; i++) {
    const pip = document.createElement("span");
    pip.className =
      "pile-pip " +
      (isMinus ? "black-pip" : "red-pip") +
      (i >= visiblePips ? " hidden-pip" : "");
    pipsWrap.appendChild(pip);
  }
  card6d.appendChild(pipsWrap);

  const backCard = document.createElement("div");
  backCard.className = "pile-card-back";

  cardsEl.appendChild(card6d);
  cardsEl.appendChild(backCard);
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

function renderStakeBadge() {
  if (!els.stakeLabel) return;

  if (state.stakeMultiplier >= 4 && state.redoubledBy !== null) {
    els.stakeLabel.classList.remove("hidden");
    els.stakeLabel.textContent = `RE-DOUBLE • ${getPlayerName(state.redoubledBy)}`;
  } else if (state.stakeMultiplier >= 2 && state.doubledBy !== null) {
    els.stakeLabel.classList.remove("hidden");
    els.stakeLabel.textContent = `DOUBLE • ${getPlayerName(state.doubledBy)}`;
  } else {
    els.stakeLabel.textContent = "";
    els.stakeLabel.classList.add("hidden");
  }
}

function renderHUD() {
  const team0DisplayPts = state.trickPoints[0] + state.marriageBonus[0];
  const team1DisplayPts = state.trickPoints[1] + state.marriageBonus[1];

  els.yourScore.textContent =
    team0DisplayPts > 0 ? `+${team0DisplayPts}` : "0";
  els.oppScore.textContent =
    team1DisplayPts > 0 ? `+${team1DisplayPts}` : "0";

  renderSidePile(els.yourPileCards, els.yourMarkText, state.teamMarks[0]);
  renderSidePile(els.oppPileCards, els.oppMarkText, state.teamMarks[1]);

  if (state.trumpMaker !== null) {
    els.bidderLabel.textContent = `Trump: ${getPlayerName(state.trumpMaker)}`;
  } else if (state.bidder !== null) {
    els.bidderLabel.textContent = `Bid: ${getPlayerName(state.bidder)}`;
  } else {
    els.bidderLabel.textContent = "Bid: --";
  }

  els.bidValue.textContent = state.currentBid > 0 ? state.currentBid : "--";
  renderStakeBadge();

  const animCls = state.animateTrumpReveal ? " reveal-anim" : "";
  const makerSuffix =
    state.trumpMaker !== null ? ` • ${getPlayerName(state.trumpMaker)}` : "";

  if (state.trumpRevealed && state.trump) {
    if (state.trump === "JOKER") {
      els.trumpCardFace.className = "trump-mini-card" + animCls;
      els.trumpCardFace.innerHTML = `<span class="trump-card-rank">JOKER</span><span class="trump-card-suit">🃏</span>`;
      els.trumpSubLabel.textContent = `TRUMP (🃏)${makerSuffix}`;
    } else {
      els.trumpCardFace.className =
        "trump-mini-card" + (isRed(state.trump) ? " red" : "") + animCls;
      els.trumpCardFace.innerHTML = `<span class="trump-card-rank">A</span><span class="trump-card-suit">${state.trump}</span>`;
      els.trumpSubLabel.textContent = `TRUMP (${state.trump})${makerSuffix}`;
    }
    state.animateTrumpReveal = false;
  } else {
    els.trumpCardFace.className = "trump-mini-card back";
    els.trumpCardFace.textContent = "🂠";
    els.trumpSubLabel.textContent = state.trump
      ? `HIDDEN${makerSuffix}`
      : "TRUMP";
  }

  updateSeventhLeadBanner();
  updateMarriageBanner();

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
  renderHUD();
  renderTurnIndicators();
  renderBacks(els.p2Backs, state.hands[1].length);
  renderBacks(els.p3Backs, state.hands[2].length);
  renderBacks(els.p4Backs, state.hands[3].length);

  els.p1Label.textContent = `${getPlayerName(0)} — Team 1${state.bidder === 0 ? ` [Bid ${state.currentBid}]` : ""}`;
  els.p2Label.textContent = `${getPlayerName(1)}${state.bidder === 1 ? ` (${state.currentBid})` : ""}`;
  els.p3Label.textContent = `${getPlayerName(2)}${state.bidder === 2 ? ` (${state.currentBid})` : ""}`;
  els.p4Label.textContent = `${getPlayerName(3)}${state.bidder === 3 ? ` (${state.currentBid})` : ""}`;

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

// ===== Player Name Editor Modal (Only Names) =====
function ensureNameEditModal() {
  let modal = document.getElementById("nameEditModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "nameEditModal";
  modal.className = "modal-backdrop hidden";
  modal.style.zIndex = "9999";
  modal.innerHTML = `
    <div class="modal-card" style="max-width:360px;text-align:left;background:#0f172a;border:2px solid #38bdf8;color:#fff;">
      <h3 style="text-align:center;color:#fff;">Change Player Names</h3>
      <p class="modal-sub" style="text-align:center;margin-bottom:12px;color:#cbd5e1;">
        Enter custom names for all 4 players
      </p>
      <div id="nameEditInputs" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;"></div>
      <div style="display:flex;gap:8px;justify-content:space-between;">
        <button id="resetNamesBtn" type="button" class="pill-btn" style="background:#334155;">Reset</button>
        <div style="display:flex;gap:8px;">
          <button id="cancelNamesBtn" type="button" class="pill-btn" style="background:#475569;">Cancel</button>
          <button id="saveNamesBtn" type="button" class="pill-btn primary-btn">Save</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("cancelNamesBtn").addEventListener("click", () => {
    soundFX.click();
    modal.classList.add("hidden");
  });

  return modal;
}

function openNameEditModal() {
  soundFX.click();
  const modal = ensureNameEditModal();
  const container = document.getElementById("nameEditInputs");
  const draftNames = [...state.playerNames];
  const roleLabels = ["You (Team 1)", "West (Team 2)", "Partner (Team 1)", "East (Team 2)"];

  container.innerHTML = "";
  const inputRefs = [];

  draftNames.forEach((nm, idx) => {
    const fieldWrap = document.createElement("div");
    fieldWrap.style.cssText = "display:flex;flex-direction:column;gap:3px;";

    const lbl = document.createElement("label");
    lbl.style.cssText = "font-size:11px;font-weight:700;color:#7dd3fc;";
    lbl.textContent = roleLabels[idx];

    const inp = document.createElement("input");
    inp.type = "text";
    inp.maxLength = 16;
    inp.value = nm;
    inp.placeholder = DEFAULT_PLAYER_NAMES[idx];
    inp.style.cssText =
      "width:100%;padding:7px 9px;border-radius:7px;border:1px solid #94a3b8;background:#ffffff;color:#0f172a;font-size:13px;font-weight:700;outline:none;";

    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.getElementById("saveNamesBtn").click();
      }
    });

    fieldWrap.appendChild(lbl);
    fieldWrap.appendChild(inp);
    container.appendChild(fieldWrap);
    inputRefs.push(inp);
  });

  document.getElementById("saveNamesBtn").onclick = () => {
    soundFX.click();
    state.playerNames = inputRefs.map((inp, idx) => {
      const val = inp.value.trim();
      return val ? val.slice(0, 16) : DEFAULT_PLAYER_NAMES[idx];
    });
    saveCustomNames(state.playerNames);
    modal.classList.add("hidden");
    renderTable();
  };

  document.getElementById("resetNamesBtn").onclick = () => {
    soundFX.click();
    state.playerNames = [...DEFAULT_PLAYER_NAMES];
    saveCustomNames(state.playerNames);
    modal.classList.add("hidden");
    renderTable();
  };

  modal.classList.remove("hidden");
  if (inputRefs[0]) inputRefs[0].focus();
}

function ensureEditNamesButton() {
  if (document.getElementById("editNamesBtn")) return;
  const btn = document.createElement("button");
  btn.id = "editNamesBtn";
  btn.type = "button";
  btn.className = "pill-btn";
  btn.style.background = "#0284c7";
  btn.textContent = "Names";
  btn.addEventListener("click", openNameEditModal);

  if (els.newGameBtn && els.newGameBtn.parentNode) {
    els.newGameBtn.parentNode.insertBefore(btn, els.newGameBtn);
  } else {
    document.body.appendChild(btn);
  }
}

function checkMatchWinner() {
  if (state.teamMarks[0] >= TARGET_MARK) return 0;
  if (state.teamMarks[1] >= TARGET_MARK) return 1;
  if (state.teamMarks[0] <= -TARGET_MARK) return 1;
  if (state.teamMarks[1] <= -TARGET_MARK) return 0;
  return null;
}

function triggerTrumpReveal() {
  if (!state.trumpRevealed && state.trump) {
    state.trumpRevealed = true;
    state.animateTrumpReveal = true;
    soundFX.trumpReveal();
    evaluateInternationalMarriage(true);
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

function getUpcomingSeventhCard() {
  return state.deck[8] || null;
}

function promptHumanTrump() {
  return new Promise((resolve) => {
    state.trumpResolver = resolve;
    state.revealedSeventhCard = null;

    els.seventhCardInfo.textContent =
      "Choose Trump from your 4 cards, or tap 7th Card";
    els.use7thCardBtn.classList.remove("hidden");
    els.use7thCardBtn.disabled = !getUpcomingSeventhCard();
    els.use7thCardBtn.textContent = "Use 7th Card Suit";

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
      r({ trump: btn.dataset.suit, fromSeventh: false, card: null });
    }
  });
});

els.use7thCardBtn.addEventListener("click", () => {
  const seventh = getUpcomingSeventhCard();
  if (!seventh) return;
  soundFX.click();
  state.revealedSeventhCard = seventh;
  els.trumpModal.classList.add("hidden");
  updateSeventhLeadBanner();
  if (state.trumpResolver) {
    const r = state.trumpResolver;
    state.trumpResolver = null;
    r({ trump: seventh.suit, fromSeventh: true, card: seventh });
  }
});

els.useJokerTrumpBtn.addEventListener("click", () => {
  soundFX.click();
  els.trumpModal.classList.add("hidden");
  if (state.trumpResolver) {
    const r = state.trumpResolver;
    state.trumpResolver = null;
    r({ trump: "JOKER", fromSeventh: false, card: null });
  }
});

els.showTrumpBtn.addEventListener("click", () => {
  if (!state.trumpRevealed && state.trump) {
    triggerTrumpReveal();
    const makerName =
      state.trumpMaker !== null ? ` (${getPlayerName(state.trumpMaker)})` : "";
    const trumpLabel = state.trump === "JOKER" ? "Joker (🃏)" : state.trump;
    if (!state.marriageDeclared[0] && !state.marriageDeclared[1]) {
      els.statusText.textContent = `Trump revealed: ${trumpLabel}${makerName}`;
    }
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
  els.lastHandWinner.textContent = `Won by ${getPlayerName(state.lastTrick.winner)}`;
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
    cap.textContent = getPlayerName(item.player);
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

async function startRound(resetMatch = false) {
  ensureEditNamesButton();
  els.resultModal.classList.add("hidden");
  els.bidModal.classList.add("hidden");
  els.doubleModal.classList.add("hidden");
  els.trumpModal.classList.add("hidden");
  els.lastHandModal.classList.add("hidden");

  if (resetMatch) {
    state.teamMarks = [0, 0];
    state.matchOver = false;
    state.matchWinnerTeam = null;
    state.dealer = secureRandomInt(4);
  } else {
    state.dealer = (state.dealer + 1) % 4;
  }

  state.deck = shuffle(createDeck());
  state.hands = [[], [], [], []];
  state.dealtHands = [[], [], [], []];
  state.currentBid = 0;
  state.bidder = null;
  state.trumpMaker = null;
  state.stakeMultiplier = 1;
  state.doubledBy = null;
  state.redoubledBy = null;
  state.trump = null;
  state.trumpRevealed = false;
  state.animateTrumpReveal = false;
  state.revealedSeventhCard = null;
  state.teamTricksWon = [0, 0];
  state.marriageDeclared = [false, false];
  state.marriageBonus = [0, 0];
  state.leader = (state.dealer + 1) % 4;
  state.trickNumber = 1;
  state.played = [];
  state.lastTrick = null;
  state.trickPoints = [0, 0];
  state.activePlayer = null;
  state.lastPlayedPlayer = null;
  state.phase = "bidding";

  for (let i = 0; i < 16; i++) state.hands[i % 4].push(state.deck.shift());
  renderTable();
  els.statusText.textContent = "4 cards dealt each — Bidding started...";
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
        els.statusText.textContent = `${getPlayerName(HUMAN)}'s turn to bid (4 cards)...`;
        bid = await promptHumanBid(minNext);
      } else {
        els.statusText.textContent = `${getPlayerName(turn)} is bidding...`;
        await sleep(360);
        bid = botBid(state.hands[turn], state.currentBid);
      }

      if (bid === "pass") {
        passed[turn] = true;
        els.statusText.textContent = `${getPlayerName(turn)} passed`;
      } else {
        state.currentBid = bid;
        state.bidder = turn;
        els.statusText.textContent = `${getPlayerName(turn)} bid ${bid}`;
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
    return startRound(false);
  }

  const bidderTeam = state.bidder % 2;
  state.phase = "double";
  if (bidderTeam === 0) {
    const doubterBot = botShouldDouble(state.hands[1], state.currentBid)
      ? 1
      : botShouldDouble(state.hands[3], state.currentBid)
        ? 3
        : null;

    if (doubterBot !== null) {
      state.stakeMultiplier = 2;
      state.doubledBy = doubterBot;
      renderHUD();
      els.statusText.textContent = `DOUBLE by ${getPlayerName(doubterBot)} on bid ${state.currentBid}!`;
      await sleep(600);

      const reDouble = await promptHumanDouble(
        "Re-double?",
        `${getPlayerName(doubterBot)} doubled your bid of ${state.currentBid}. Do you want to Re-double?`
      );
      if (reDouble) {
        state.stakeMultiplier = 4;
        state.redoubledBy = HUMAN;
        renderHUD();
        els.statusText.textContent = `RE-DOUBLE by ${getPlayerName(HUMAN)}!`;
        await sleep(550);
      }
    }
  } else {
    const wantDouble = await promptHumanDouble(
      "Double Bid?",
      `${getPlayerName(state.bidder)} bid ${state.currentBid}. Double this bid?`
    );
    if (wantDouble) {
      state.stakeMultiplier = 2;
      state.doubledBy = HUMAN;
      renderHUD();
      els.statusText.textContent = `DOUBLE by ${getPlayerName(HUMAN)}!`;
      await sleep(500);

      const botReDouble =
        botShouldDouble(state.hands[state.bidder], state.currentBid) &&
        state.currentBid >= 19;
      if (botReDouble) {
        state.stakeMultiplier = 4;
        state.redoubledBy = state.bidder;
        renderHUD();
        els.statusText.textContent = `RE-DOUBLE by ${getPlayerName(state.bidder)}!`;
        await sleep(600);
      }
    }
  }

  state.phase = "trump";
  state.trumpRevealed = false;
  state.trumpMaker = state.bidder;

  if (state.bidder === HUMAN) {
    els.statusText.textContent = `${getPlayerName(HUMAN)} is selecting Trump from 4 cards...`;
    const choice = await promptHumanTrump();
    state.trump = choice.trump;
    els.statusText.textContent = `Trump selected by ${getPlayerName(HUMAN)} (hidden until shown)`;
  } else {
    state.trump = botChooseTrump(state.hands[state.bidder]);
    els.statusText.textContent = `Trump selected by ${getPlayerName(state.bidder)} (hidden until shown)`;
    await sleep(450);
  }
  renderHUD();

  for (let i = 0; i < 16; i++) {
    const card = state.deck.shift();
    if (card) state.hands[i % 4].push(card);
  }
  state.dealtHands = state.hands.map((h) => [...h]);
  els.statusText.textContent = "Remaining 4 cards dealt! Playing starts...";
  renderTable();
  await sleep(550);

  state.phase = "playing";
  renderTable();
  await sleep(300);

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
        const currentTrickPts = state.played.reduce((s, x) => s + x.card.points, 0);
        const bestSoFar =
          state.played.length > 0 ? trickWinner(state.played, state.trump, false) : null;
        const partnerLeading = bestSoFar !== null && bestSoFar % 2 === p % 2;

        if (!(partnerLeading && currentTrickPts < 2)) {
          triggerTrumpReveal();
          const makerName =
            state.trumpMaker !== null ? ` (${getPlayerName(state.trumpMaker)})` : "";
          const trumpLabel = state.trump === "JOKER" ? "Joker (🃏)" : state.trump;
          if (!state.marriageDeclared[0] && !state.marriageDeclared[1]) {
            els.statusText.textContent = `${getPlayerName(p)} could not follow suit! Trump revealed: ${trumpLabel}${makerName}`;
          }
          renderHUD();
          await sleep(500);
        }
      }

      let card;
      if (p === HUMAN) {
        els.statusText.textContent = `Trick ${trick}/8 — ${getPlayerName(p)} turn`;
        renderTable();
        card = await waitHumanCard();
      } else {
        els.statusText.textContent = `Trick ${trick}/8 — ${getPlayerName(p)} playing card...`;
        renderTable();
        await sleep(380);
        card = botPlay(
          p,
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
      els.statusText.textContent = `Trick ${trick}/8 — ${getPlayerName(p)} played ${card.rank}${card.suit}`;
      renderTable();
      await sleep(220);
    }

    const winner = trickWinner(
      state.played,
      state.trump,
      state.trumpRevealed
    );
    const winTeam = winner % 2;
    const pts = state.played.reduce((s, x) => s + x.card.points, 0);
    const lastBonus = trick === 8 ? 1 : 0;
    const earned = pts + lastBonus;

    state.teamTricksWon[winTeam] += 1;
    state.trickPoints[winTeam] += earned;
    state.lastTrick = { cards: [...state.played], winner };
    state.leader = winner;
    state.lastPlayedPlayer = null;

    if (winTeam === 0) soundFX.win();
    els.statusText.textContent = `Trick ${trick} won by ${getPlayerName(winner)} (+${earned})`;
    renderHUD();
    renderTurnIndicators();

    // Pit জেতার পরই Marriage শর্ত পূর্ণ হলে Marriage শো হবে
    evaluateInternationalMarriage(true);
    renderHUD();

    await sleep(750);
  }

  state.phase = "finished";
  state.activePlayer = null;
  state.lastPlayedPlayer = null;

  if (!state.trumpRevealed && state.trump) {
    state.trumpRevealed = true;
  }
  evaluateInternationalMarriage(false);

  const defenderTeam = bidderTeam === 0 ? 1 : 0;
  const effectiveBidTarget =
    state.currentBid - state.marriageBonus[bidderTeam] + state.marriageBonus[defenderTeam];

  const totalTeamPts = [
    state.trickPoints[0] + state.marriageBonus[0],
    state.trickPoints[1] + state.marriageBonus[1],
  ];

  const bidSucceeded = totalTeamPts[bidderTeam] >= effectiveBidTarget;
  const markDelta = 1 * state.stakeMultiplier;

  if (bidSucceeded) {
    state.teamMarks[bidderTeam] += markDelta;
  } else {
    state.teamMarks[bidderTeam] -= markDelta;
  }

  renderHUD();
  renderTurnIndicators();

  const winnerTeam = checkMatchWinner();
  const bidderTeamName = getShortTeamName(bidderTeam);

  if (winnerTeam !== null) {
    state.matchOver = true;
    state.matchWinnerTeam = winnerTeam;
    soundFX.win();

    const winnerName = getTeamDisplayName(winnerTeam);
    els.resultTitle.textContent = `${winnerName} Won the Game!`;
    els.statusText.textContent = `GAME OVER — ${winnerName} Won!`;
    els.resultDetail.textContent = `Final Marks -> Your Team: ${formatSignedValue(state.teamMarks[0])} | Opponent: ${formatSignedValue(state.teamMarks[1])} | Last Hand: ${bidderTeamName} bid ${state.currentBid} (Target ${effectiveBidTarget}) | Pts: ${totalTeamPts[0]} vs ${totalTeamPts[1]}`;
    els.continueBtn.textContent = "Play New Game";
    els.resultModal.classList.remove("hidden");
    return;
  }

  const youWonRound = bidderTeam === 0 && bidSucceeded;
  if (youWonRound) soundFX.win();

  if (bidSucceeded) {
    els.resultTitle.textContent =
      bidderTeam === 0 ? "Bid Won! (+ Mark)" : "Opponent Bid Won! (+ Mark)";
  } else {
    els.resultTitle.textContent =
      bidderTeam === 0 ? "Bid Failed! (- Mark)" : "Opponent Bid Failed! (- Mark)";
  }

  const stakeStatusText =
    state.stakeMultiplier >= 4 && state.redoubledBy !== null
      ? `RE-DOUBLE by ${getPlayerName(state.redoubledBy)}`
      : state.stakeMultiplier >= 2 && state.doubledBy !== null
        ? `DOUBLE by ${getPlayerName(state.doubledBy)}`
        : "Normal";

  const marriageNotes = [];
  if (state.marriageDeclared[0]) marriageNotes.push(`Your Team Marriage (+${MARRIAGE_BONUS})`);
  if (state.marriageDeclared[1]) marriageNotes.push(`Opponent Marriage (+${MARRIAGE_BONUS})`);
  const marriageText = marriageNotes.length > 0 ? marriageNotes.join(", ") : "No Marriage";

  els.resultDetail.textContent = `${bidderTeamName} Bid ${state.currentBid} (Adj Target ${effectiveBidTarget}, ${stakeStatusText}) | Pts: ${totalTeamPts[0]} vs ${totalTeamPts[1]} | ${bidderTeamName} Mark: ${bidSucceeded ? `+${markDelta}` : `-${markDelta}`} | ${marriageText}`;
  els.continueBtn.textContent = "Continue";
  els.resultModal.classList.remove("hidden");
}

els.newGameBtn.addEventListener("click", () => {
  soundFX.click();
  startRound(true);
});

els.continueBtn.addEventListener("click", () => {
  soundFX.click();
  if (state.matchOver) {
    startRound(true);
  } else {
    startRound(false);
  }
});

ensureEditNamesButton();
startRound(true);
