// ===== 29 Card Game: Sound Effects, True Shuffle, Custom Names, ±6 Win/Loss, Pit Marriage & Single Hand =====
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["J", "9", "A", "10", "K", "Q", "8", "7"];
const POINTS = { J: 3, "9": 2, A: 1, "10": 1, K: 0, Q: 0, "8": 0, "7": 0 };
const HUMAN = 0; // You
const TARGET_MARK = 6; // +6 win, -6 loss
const MARRIAGE_BONUS = 4; // Marriage = 4 points factor in bid calculation (not added immediately as raw points)
const SINGLE_HAND_MARK = 3; // +3 win / -3 loss for Single Hand (all 8 tricks)

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
  playNoiseBurst(duration = 0.045, filterFreq = 1800, gainVal = 0.07, delay = 0) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const sampleRate = ctx.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (frameCount * 0.45));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(filterFreq, ctx.currentTime + delay);
    filter.Q.setValueAtTime(1.4, ctx.currentTime + delay);

    const gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainVal, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(start);
    noise.stop(start + duration + 0.01);
  },
  click() {
    this.playTone(540, 0.05, "triangle", 0.06);
  },
  shuffle() {
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const d = i * 0.045;
      this.playNoiseBurst(0.038, 1500 + i * 220, 0.075, d);
      this.playTone(260 + i * 35, 0.03, "triangle", 0.03, d);
    }
  },
  cardDeal() {
    this.playNoiseBurst(0.035, 2200, 0.065, 0);
    this.playTone(310, 0.045, "triangle", 0.055, 0.005);
  },
  cardPlay() {
    this.playNoiseBurst(0.03, 1900, 0.06, 0);
    this.playTone(210, 0.06, "sine", 0.11);
    this.playTone(130, 0.07, "triangle", 0.07, 0.015);
  },
  trumpSelect() {
    this.playTone(440, 0.08, "triangle", 0.08, 0);
    this.playTone(587.33, 0.11, "triangle", 0.09, 0.07);
  },
  trumpReveal() {
    this.playTone(523.25, 0.12, "triangle", 0.09, 0);
    this.playTone(659.25, 0.14, "triangle", 0.09, 0.09);
    this.playTone(783.99, 0.2, "triangle", 0.1, 0.18);
  },
  leadWin(isFriendly = true) {
    if (isFriendly) {
      this.playTone(587.33, 0.09, "triangle", 0.085, 0);
      this.playTone(783.99, 0.13, "sine", 0.095, 0.08);
    } else {
      this.playTone(392.0, 0.09, "triangle", 0.07, 0);
      this.playTone(329.63, 0.12, "sine", 0.07, 0.08);
    }
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
  playerBids: [null, null, null, null], // number or "PASS" or null per player (0..3)
  trumpMaker: null,
  stakeMultiplier: 1,
  doubledBy: null,
  redoubledBy: null,
  trump: null,
  trumpRevealed: false,
  animateTrumpReveal: false,
  revealedSeventhCard: null,
  teamTricksWon: [0, 0], // [Team 0 pits, Team 1 pits]
  marriageCardPlayedBy: [null, null], // player index (0..3) per team who played K or Q of trump
  marriageDeclared: [false, false], // [Team 0 marriage shown, Team 1 marriage shown]
  marriageHolderName: ["", ""], // [Team 0 holder, Team 1 holder]
  // Single Hand state
  singleHandActive: false,
  singleHandCaller: null, // 0..3
  singleHandCallerTricks: 0,
  singleHandCaughtEarly: false,
  roundCancelled: false,
  cancelReason: "",
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
  singleHandResolver: null,
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

// মার্ক পাইল কার্ডগুলো উপরের লাল টিক (✓) চিহ্নের জায়গায় এবং বড় সাইজে দেখানোর স্টাইল
function ensureTopLargeMarkPiles() {
  if (document.getElementById("topLargeMarkStyle")) return;

  const style = document.createElement("style");
  style.id = "topLargeMarkStyle";
  style.textContent = `
    #yourPileCards, #oppPileCards {
      position: fixed !important;
      top: 86px !important;
      z-index: 60 !important;
      display: flex !important;
      align-items: center !important;
      gap: 4px !important;
      pointer-events: none;
    }
    #yourPileCards {
      left: 10px !important;
    }
    #oppPileCards {
      right: 10px !important;
      flex-direction: row-reverse !important;
    }
    #yourMarkText, #oppMarkText {
      position: fixed !important;
      top: 156px !important;
      z-index: 60 !important;
      font-size: 12px !important;
      font-weight: 800 !important;
      color: #ffffff !important;
      background: rgba(15, 23, 42, 0.82) !important;
      padding: 2px 8px !important;
      border-radius: 999px !important;
      border: 1px solid rgba(255, 255, 255, 0.25) !important;
      pointer-events: none;
    }
    #yourMarkText {
      left: 10px !important;
    }
    #oppMarkText {
      right: 10px !important;
    }
    .pile-card-6d, .pile-card-back {
      width: 44px !important;
      height: 62px !important;
      border-radius: 7px !important;
    }
    .pile-6d-corner {
      font-size: 11px !important;
      font-weight: 800 !important;
    }
    .pile-pip {
      width: 7px !important;
      height: 7px !important;
    }
    @media (max-width: 480px) {
      #yourPileCards, #oppPileCards {
        top: 82px !important;
      }
      #yourMarkText, #oppMarkText {
        top: 146px !important;
        font-size: 11px !important;
      }
      .pile-card-6d, .pile-card-back {
        width: 40px !important;
        height: 56px !important;
      }
    }
  `;
  document.head.appendChild(style);
}

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

function isPartnerSittingOut(playerIdx) {
  if (!state.singleHandActive || state.singleHandCaller === null) return false;
  const partnerIdx = (state.singleHandCaller + 2) % 4;
  return playerIdx === partnerIdx;
}

// বিডিং টার্গেট হিসাব:
// Bidder টিমের Marriage হলে টার্গেট -4 কমে; Opponent (Defender) টিমের Marriage হলে টার্গেট +4 বাড়ে।
// Marriage পয়েন্ট সরাসরি trickPoints-এ যোগ করা হয় না।
function getEffectiveBidTarget(bidderTeam) {
  if (bidderTeam === null || bidderTeam === undefined) return state.currentBid;
  const defenderTeam = bidderTeam === 0 ? 1 : 0;
  const bidderM = state.marriageDeclared[bidderTeam] ? MARRIAGE_BONUS : 0;
  const defenderM = state.marriageDeclared[defenderTeam] ? MARRIAGE_BONUS : 0;
  return state.currentBid - bidderM + defenderM;
}

// প্রতিটি প্লেয়ারের সর্বশেষ বিড বা PASS ব্যাজ রেন্ডার করা
function renderPlayerBidCallouts() {
  const oldLogBar = document.getElementById("bidHistoryBar");
  if (oldLogBar) oldLogBar.remove();

  const seatContainers = [
    els.myHand ? els.myHand.parentElement : null,
    els.seatP2,
    els.seatP3,
    els.seatP4,
  ];

  for (let i = 0; i < 4; i++) {
    const parent = seatContainers[i];
    if (!parent) continue;

    let callout = document.getElementById(`bidCalloutP${i + 1}`);
    if (!callout) {
      callout = document.createElement("div");
      callout.id = `bidCalloutP${i + 1}`;
      callout.style.cssText =
        "display:inline-flex;align-items:center;gap:4px;margin-top:3px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:0.2px;box-shadow:0 2px 6px rgba(0,0,0,0.3);pointer-events:none;";
      if (i === 0 && els.myHand && els.myHand.parentNode) {
        els.myHand.parentNode.insertBefore(callout, els.myHand);
      } else {
        parent.appendChild(callout);
      }
    }

    const val = state.playerBids[i];
    const showCallout =
      val !== null &&
      (state.phase === "bidding" ||
        state.phase === "double" ||
        state.phase === "trump" ||
        state.phase === "playing");

    if (!showCallout) {
      callout.style.display = "none";
      callout.textContent = "";
      continue;
    }

    callout.style.display = "inline-flex";
    if (val === "PASS") {
      callout.style.background = "rgba(51,65,85,0.92)";
      callout.style.color = "#cbd5e1";
      callout.style.border = "1px solid #64748b";
      callout.textContent = "PASS";
    } else {
      const isHighest = state.bidder === i;
      callout.style.background = isHighest
        ? "linear-gradient(90deg,#f59e0b,#eab308)"
        : "rgba(2,132,199,0.92)";
      callout.style.color = isHighest ? "#0f172a" : "#ffffff";
      callout.style.border = isHighest ? "1px solid #fef08a" : "1px solid #7dd3fc";
      callout.textContent = `BID ${val}`;
    }
  }
}

function hasEightOfSameSuit(hands) {
  for (let p = 0; p < 4; p++) {
    const h = hands[p] || [];
    if (h.length < 8) continue;
    for (const suit of SUITS) {
      const count = h.filter((c) => c.suit === suit).length;
      if (count >= 8) {
        return { player: p, suit };
      }
    }
  }
  return null;
}

function hasGuaranteedEightTricks(callerIdx, hands) {
  const callerHand = hands[callerIdx] || [];
  if (callerHand.length < 8) return false;

  const opponents = [0, 1, 2, 3].filter(
    (idx) => idx !== callerIdx && idx !== (callerIdx + 2) % 4
  );

  for (const suit of SUITS) {
    const mySuitCards = callerHand
      .filter((c) => c.suit === suit)
      .sort((a, b) => rankPower(a) - rankPower(b));

    if (mySuitCards.length === 0) continue;

    const oppSuitCards = [];
    for (const opp of opponents) {
      for (const c of hands[opp] || []) {
        if (c.suit === suit) oppSuitCards.push(c);
      }
    }

    for (const myCard of mySuitCards) {
      const strongerOpp = oppSuitCards.some(
        (oc) => rankPower(oc) < rankPower(myCard)
      );
      if (strongerOpp) {
        return false;
      }
    }
  }

  return true;
}

function canCallSingleHand(playerIdx, hands) {
  if (hasGuaranteedEightTricks(playerIdx, hands)) {
    return { allowed: false, reason: "Guaranteed 8-trick hand cannot call Single Hand (no risk)." };
  }
  return { allowed: true, reason: "" };
}

function botShouldCallSingleHand(playerIdx, hands) {
  const check = canCallSingleHand(playerIdx, hands);
  if (!check.allowed) return false;

  const hand = hands[playerIdx] || [];
  let j9aCount = 0;
  const suitCount = {};
  for (const s of SUITS) suitCount[s] = 0;

  for (const c of hand) {
    suitCount[c.suit]++;
    if (c.rank === "J" || c.rank === "9" || c.rank === "A") j9aCount++;
  }

  const hasLongSuit = Object.values(suitCount).some((cnt) => cnt >= 5);
  return j9aCount >= 5 && hasLongSuit;
}

function ensureSingleHandModal() {
  let modal = document.getElementById("singleHandModal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "singleHandModal";
  modal.className = "modal-backdrop hidden";
  modal.style.cssText =
    "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(2,6,23,0.78);z-index:9998;";
  modal.innerHTML = `
    <div class="modal-card" style="width:100%;max-width:360px;text-align:center;background:#0f172a;border:2px solid #f59e0b;color:#fff;border-radius:14px;padding:16px;box-sizing:border-box;">
      <h3 style="color:#fbbf24;margin:0 0 6px;font-size:18px;">Single Hand?</h3>
      <p id="singleHandDesc" class="modal-sub" style="color:#e2e8f0;margin:0 0 10px;line-height:1.45;font-size:13px;"></p>
      <p id="singleHandRuleNote" style="font-size:11px;color:#94a3b8;margin:0 0 14px;line-height:1.4;">
        Win all 8 tricks (No Trump, Partner sits out): +3 Marks | Caught on any trick: -3 Marks immediately.<br/>
        Guaranteed 8-trick hand is blocked; leading a suit held by neither opponent cancels the round.
      </p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button id="declineSingleHandBtn" type="button" class="pill-btn" style="background:#475569;color:#fff;padding:8px 14px;border-radius:999px;border:none;font-weight:700;cursor:pointer;">No (Normal)</button>
        <button id="acceptSingleHandBtn" type="button" class="pill-btn primary-btn" style="background:#d97706;color:#fff;padding:8px 14px;border-radius:999px;border:none;font-weight:700;cursor:pointer;">Call Single Hand</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function promptHumanSingleHand() {
  return new Promise((resolve) => {
    const modal = ensureSingleHandModal();
    const descEl = document.getElementById("singleHandDesc");
    const acceptBtn = document.getElementById("acceptSingleHandBtn");
    const declineBtn = document.getElementById("declineSingleHandBtn");

    const eligibility = canCallSingleHand(HUMAN, state.hands);
    if (!eligibility.allowed) {
      descEl.textContent =
        "Your hand can win all 8 tricks with no risk — Single Hand is not allowed on a guaranteed win.";
      acceptBtn.disabled = true;
      acceptBtn.style.opacity = "0.5";
    } else {
      descEl.textContent =
        "Do you want to play Single Hand? If caught on any trick, round ends immediately (-3 Marks).";
      acceptBtn.disabled = false;
      acceptBtn.style.opacity = "1";
    }

    const cleanup = () => {
      modal.classList.add("hidden");
      acceptBtn.onclick = null;
      declineBtn.onclick = null;
    };

    acceptBtn.onclick = () => {
      if (!eligibility.allowed) return;
      soundFX.click();
      cleanup();
      state.singleHandResolver = null;
      resolve(true);
    };

    declineBtn.onclick = () => {
      soundFX.click();
      cleanup();
      state.singleHandResolver = null;
      resolve(false);
    };

    state.singleHandResolver = resolve;
    modal.classList.remove("hidden");
  });
}

function activateSingleHand(callerIdx) {
  state.singleHandActive = true;
  state.singleHandCaller = callerIdx;
  state.singleHandCallerTricks = 0;
  state.stakeMultiplier = 1;
  state.doubledBy = null;
  state.redoubledBy = null;
  state.trump = null;
  state.trumpRevealed = false;
  state.leader = callerIdx;
  soundFX.trumpSelect();
  renderTable();
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

  if (state.singleHandActive) {
    banner.style.display = "inline-block";
    const callerName =
      state.singleHandCaller !== null ? getPlayerName(state.singleHandCaller) : "Caller";
    banner.textContent = `🃏 SINGLE HAND (${callerName}: ${state.singleHandCallerTricks}/8 Tricks • +3/-3)`;
    return;
  }

  const bidderTeam = state.bidder !== null ? state.bidder % 2 : null;
  const activeTeams = [];

  for (let t = 0; t < 2; t++) {
    if (!state.marriageDeclared[t]) continue;
    const holder = state.marriageHolderName[t] || getShortTeamName(t);
    if (bidderTeam !== null) {
      const effectText =
        t === bidderTeam
          ? `Bidder Target -${MARRIAGE_BONUS}`
          : `Bidder Target +${MARRIAGE_BONUS}`;
      activeTeams.push(`${holder} Marriage (${effectText})`);
    } else {
      activeTeams.push(`${holder} Marriage (${MARRIAGE_BONUS} pts factor)`);
    }
  }

  if (activeTeams.length === 0 || state.phase === "idle") {
    banner.style.display = "none";
    banner.textContent = "";
    return;
  }

  banner.style.display = "inline-block";
  banner.textContent = `💍 ${activeTeams.join(" • ")}`;
}

// প্লেয়ার যখন ট্রাম্প স্যুটের K বা Q (Marriage card) খেলে তখন ওই প্লেয়ারকে রেকর্ড করা
function recordMarriageCardPlayed(playerIdx, card) {
  if (state.singleHandActive || !state.trumpRevealed || !state.trump || state.trump === "JOKER") {
    return;
  }
  if (card.suit === state.trump && (card.rank === "K" || card.rank === "Q")) {
    const team = playerIdx % 2;
    state.marriageCardPlayedBy[team] = playerIdx;
  }
}

// একই প্লেয়ারের হাতে K ও Q আছে কি না তা যাচাই করা
function playerHasBothKQ(playerIdx) {
  if (playerIdx === null || playerIdx === undefined) return false;
  const sourceHands =
    state.dealtHands && state.dealtHands[0].length > 0
      ? state.dealtHands
      : state.hands;
  const h = sourceHands[playerIdx] || [];
  const hasK = h.some((c) => c.suit === state.trump && c.rank === "K");
  const hasQ = h.some((c) => c.suit === state.trump && c.rank === "Q");
  return hasK && hasQ;
}

// শর্ত:
// 1. ট্রাম্প রিভিল থাকতে হবে
// 2. একই প্লেয়ারের হাতে ট্রাম্প স্যুটের K এবং Q দুটোই থাকতে হবে
// 3. ওই প্লেয়ার নিজেই K বা Q (Marriage card) খেলে থাকতে হবে
// 4. ওই টিমের অন্তত ১টি Pit (Trick) জেতা থাকতে হবে
// পয়েন্ট সরাসরি যোগ হবে না; বিড হিসাবকে প্রভাবিত করবে।
function evaluateInternationalMarriage(announceNow = true) {
  if (state.singleHandActive) {
    updateMarriageBanner();
    return;
  }
  if (!state.trumpRevealed || !state.trump || state.trump === "JOKER") {
    updateMarriageBanner();
    return;
  }

  const newlyAnnounced = [];

  for (let team = 0; team < 2; team++) {
    if (state.marriageDeclared[team]) continue;
    if ((state.teamTricksWon[team] || 0) < 1) continue;

    const playedPlayer = state.marriageCardPlayedBy[team];
    if (playedPlayer === null || playedPlayer === undefined) continue;

    if (playerHasBothKQ(playedPlayer)) {
      state.marriageDeclared[team] = true;
      const holderName = getPlayerName(playedPlayer);
      state.marriageHolderName[team] = holderName;

      const bidderTeam = state.bidder !== null ? state.bidder % 2 : null;
      const calcNote =
        bidderTeam === null
          ? `${MARRIAGE_BONUS} pts calc`
          : team === bidderTeam
            ? `Bidder target -${MARRIAGE_BONUS}`
            : `Bidder target +${MARRIAGE_BONUS}`;

      newlyAnnounced.push(
        `Marriage shown by ${holderName} (K${state.trump} + Q${state.trump}, ${calcNote})`
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
    state.phase !== "idle" &&
    !state.singleHandActive;

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

// সম্পূর্ণ নিরপেক্ষ (Unbiased) Shuffle — কোনো rigged বা forced card নেই
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
    } else if (!state.singleHandActive && trumpRevealed && trump === "JOKER" && bs !== played[0].card.suit) {
      if (rankPower(p.card) < rankPower(best.card)) best = p;
    } else if (!state.singleHandActive && trumpRevealed && cs === trump && bs !== trump) {
      best = p;
    }
  }
  return best.player;
}

// ৪ কার্ডের বাস্তবসম্মত বিডিং লজিক (আন্দাজে ২০ ডাকে না)
function botBid(hand, currentBid) {
  if (!Array.isArray(hand) || hand.length === 0) return "pass";

  let rawPoints = 0;
  let hasJack = false;
  let hasNine = false;
  let hasAce = false;
  const suitCounts = {};
  for (const s of SUITS) suitCounts[s] = 0;

  for (const c of hand) {
    rawPoints += c.points;
    suitCounts[c.suit] += 1;
    if (c.rank === "J") hasJack = true;
    if (c.rank === "9") hasNine = true;
    if (c.rank === "A") hasAce = true;
  }

  const maxSuitCount = Math.max(...Object.values(suitCounts));

  let estimatedStrength = rawPoints * 2.1 + 10.5;
  if (maxSuitCount >= 2) estimatedStrength += (maxSuitCount - 1) * 1.4;
  if (hasJack && hasNine) estimatedStrength += 2.0;
  else if (hasJack && hasAce) estimatedStrength += 1.2;

  if (!hasJack && !hasNine && rawPoints <= 1 && maxSuitCount < 2) {
    estimatedStrength -= 2.5;
  }

  let maxAffordableBid = 0;
  if (estimatedStrength >= 20.5 && (hasJack || (hasNine && maxSuitCount >= 2))) {
    maxAffordableBid = 20;
  } else if (estimatedStrength >= 18.8 && (hasJack || hasNine)) {
    maxAffordableBid = 18;
  } else if (estimatedStrength >= 17.5 && (hasJack || hasNine || hasAce)) {
    maxAffordableBid = 17;
  } else if (estimatedStrength >= 16.3 && (rawPoints >= 2 || maxSuitCount >= 2)) {
    maxAffordableBid = 16;
  }

  const nextNeeded = currentBid === 0 ? 16 : currentBid + 1;
  if (maxAffordableBid < nextNeeded || maxAffordableBid > 21) {
    return "pass";
  }

  return nextNeeded;
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
  let strongCards = 0;
  for (const c of hand) {
    if (c.rank === "J" || c.rank === "9") strongCards++;
  }
  return strongCards >= 2 && currentBid >= 18;
}

// বাস্তব মানুষের মতো কার্ড খেলার লজিক (আন্দাজে 9 ফেলে দেয় না)
function botPlay(playerIdx, hand, played, trump, trumpRevealed) {
  const legal = [...legalCards(hand, played)];
  if (legal.length === 1) return legal[0];

  const myTeam = playerIdx % 2;
  const currentTrickPts = played.reduce((sum, item) => sum + item.card.points, 0);

  if (played.length === 0) {
    const jackWithNine = legal.find(
      (c) =>
        c.rank === "J" &&
        c.suit !== trump &&
        hand.some((other) => other.suit === c.suit && other.rank === "9")
    );
    if (jackWithNine) return jackWithNine;

    const safeAces = legal
      .filter((c) => c.suit !== trump && c.rank === "A")
      .sort((a, b) => rankPower(a) - rankPower(b));
    if (safeAces.length > 0) return safeAces[0];

    const nonPointSafe = legal
      .filter((c) => c.suit !== trump && c.points === 0)
      .sort((a, b) => rankPower(b) - rankPower(a));
    if (nonPointSafe.length > 0) return nonPointSafe[0];

    const lowNoNine = legal
      .filter((c) => c.rank !== "9" && c.rank !== "J")
      .sort((a, b) => a.points - b.points || rankPower(b) - rankPower(a));
    if (lowNoNine.length > 0) return lowNoNine[0];

    return [...legal].sort((a, b) => a.points - b.points || rankPower(b) - rankPower(a))[0];
  }

  const currentBestPlayer = trickWinner(played, trump, trumpRevealed);
  const partnerCurrentlyWinning = currentBestPlayer % 2 === myTeam;

  const winningCards = legal.filter((card) => {
    const simulated = [...played, { player: playerIdx, card }];
    return trickWinner(simulated, trump, trumpRevealed) === playerIdx;
  });

  if (partnerCurrentlyWinning) {
    if (currentTrickPts >= 2) {
      const feedCards = [...legal]
        .filter((c) => c.points > 0 && c.rank !== "9")
        .sort((a, b) => b.points - a.points || rankPower(b) - rankPower(a));
      if (feedCards.length > 0) return feedCards[0];
    }

    const dumpSafe = [...legal]
      .filter((c) => c.rank !== "9")
      .sort((a, b) => a.points - b.points || rankPower(b) - rankPower(a));
    if (dumpSafe.length > 0) return dumpSafe[0];

    return [...legal].sort((a, b) => a.points - b.points || rankPower(b) - rankPower(a))[0];
  }

  if (winningCards.length > 0) {
    const nonTrumpWins = winningCards.filter((c) => c.suit !== trump);
    const pool = nonTrumpWins.length > 0 ? nonTrumpWins : winningCards;

    const nonNineWins = pool.filter((c) => c.rank !== "9");
    const effectivePool =
      nonNineWins.length > 0 && currentTrickPts < 3 ? nonNineWins : pool;

    if (currentTrickPts >= 2 || played.length === 3) {
      effectivePool.sort((a, b) => rankPower(b) - rankPower(a));
      return effectivePool[0];
    }

    const cheapWins = [...effectivePool].sort(
      (a, b) => a.points - b.points || rankPower(b) - rankPower(a)
    );
    return cheapWins[0];
  }

  const discardWithoutNine = [...legal]
    .filter((c) => c.rank !== "9")
    .sort((a, b) => a.points - b.points || rankPower(b) - rankPower(a));
  if (discardWithoutNine.length > 0) {
    return discardWithoutNine[0];
  }

  return [...legal].sort((a, b) => a.points - b.points || rankPower(b) - rankPower(a))[0];
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

function renderBacks(container, count, sittingOut = false) {
  container.innerHTML = "";
  if (sittingOut) {
    const tag = document.createElement("span");
    tag.style.cssText =
      "font-size:10px;font-weight:700;color:#fbbf24;background:rgba(15,23,42,0.75);padding:2px 6px;border-radius:6px;";
    tag.textContent = "SITTING OUT";
    container.appendChild(tag);
    return;
  }
  for (let i = 0; i < count; i++) {
    const b = document.createElement("div");
    b.className = "mini-back";
    container.appendChild(b);
  }
}

function renderSidePile(cardsEl, labelEl, markVal, prefixText = "") {
  ensureTopLargeMarkPiles();
  const signed = formatSignedValue(markVal);
  labelEl.textContent = prefixText ? `${prefixText} (${signed})` : signed;
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

  if (state.singleHandActive && state.singleHandCaller !== null) {
    els.stakeLabel.classList.remove("hidden");
    els.stakeLabel.textContent = `SINGLE HAND • ${getPlayerName(state.singleHandCaller)} (+3/-3)`;
    return;
  }

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
  els.yourScore.textContent =
    state.trickPoints[0] > 0 ? `+${state.trickPoints[0]}` : "0";
  els.oppScore.textContent =
    state.trickPoints[1] > 0 ? `+${state.trickPoints[1]}` : "0";

  renderSidePile(els.yourPileCards, els.yourMarkText, state.teamMarks[0], "Your team");
  renderSidePile(els.oppPileCards, els.oppMarkText, state.teamMarks[1], "Opponent");

  if (state.singleHandActive && state.singleHandCaller !== null) {
    els.bidderLabel.textContent = `Single: ${getPlayerName(state.singleHandCaller)}`;
    els.bidValue.textContent = `${state.singleHandCallerTricks}/8`;
  } else {
    if (state.trumpMaker !== null) {
      els.bidderLabel.textContent = `Trump: ${getPlayerName(state.trumpMaker)}`;
    } else if (state.bidder !== null) {
      els.bidderLabel.textContent = `Bid: ${getPlayerName(state.bidder)}`;
    } else {
      els.bidderLabel.textContent = "Bid: --";
    }
    els.bidValue.textContent = state.currentBid > 0 ? state.currentBid : "--";
  }

  renderStakeBadge();

  const animCls = state.animateTrumpReveal ? " reveal-anim" : "";
  const makerSuffix =
    state.trumpMaker !== null ? ` • ${getPlayerName(state.trumpMaker)}` : "";

  if (state.singleHandActive) {
    els.trumpCardFace.className = "trump-mini-card back";
    els.trumpCardFace.textContent = "✕";
    els.trumpSubLabel.textContent = "NO TRUMP";
  } else if (state.trumpRevealed && state.trump) {
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
  renderPlayerBidCallouts();

  const canReveal =
    !state.singleHandActive &&
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
  renderBacks(els.p2Backs, state.hands[1].length, isPartnerSittingOut(1));
  renderBacks(els.p3Backs, state.hands[2].length, isPartnerSittingOut(2));
  renderBacks(els.p4Backs, state.hands[3].length, isPartnerSittingOut(3));

  const tagSingle = (idx) =>
    state.singleHandActive && state.singleHandCaller === idx
      ? " [SINGLE]"
      : isPartnerSittingOut(idx)
        ? " [OUT]"
        : "";

  const fmtBidTag = (idx, prefix = "") => {
    const b = state.playerBids[idx];
    if (typeof b === "number") return ` [${prefix}${b}]`;
    if (b === "PASS") return ` [PASS]`;
    return "";
  };

  els.p1Label.textContent = `${getPlayerName(0)} — Team 1${fmtBidTag(0, "Bid ")}${tagSingle(0)}`;
  els.p2Label.textContent = `${getPlayerName(1)}${fmtBidTag(1)}${tagSingle(1)}`;
  els.p3Label.textContent = `${getPlayerName(2)}${fmtBidTag(2)}${tagSingle(2)}`;
  els.p4Label.textContent = `${getPlayerName(3)}${fmtBidTag(3)}${tagSingle(3)}`;

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

  if (isPartnerSittingOut(HUMAN)) {
    const note = document.createElement("div");
    note.style.cssText =
      "padding:8px 14px;border-radius:10px;background:rgba(15,23,42,0.8);color:#fbbf24;font-size:12px;font-weight:700;";
    note.textContent = `${getPlayerName((HUMAN + 2) % 4)} called Single Hand — You sit out this round`;
    els.myHand.appendChild(note);
    return;
  }

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
  if (state.singleHandActive) return;
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
    soundFX.trumpSelect();
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
  soundFX.trumpSelect();
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
  soundFX.trumpSelect();
  els.trumpModal.classList.add("hidden");
  if (state.trumpResolver) {
    const r = state.trumpResolver;
    state.trumpResolver = null;
    r({ trump: "JOKER", fromSeventh: false, card: null });
  }
});

els.showTrumpBtn.addEventListener("click", () => {
  if (!state.singleHandActive && !state.trumpRevealed && state.trump) {
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
  ensureTopLargeMarkPiles();
  ensureEditNamesButton();
  ensureSingleHandModal();
  els.resultModal.classList.add("hidden");
  els.bidModal.classList.add("hidden");
  els.doubleModal.classList.add("hidden");
  els.trumpModal.classList.add("hidden");
  els.lastHandModal.classList.add("hidden");
  const shModal = document.getElementById("singleHandModal");
  if (shModal) shModal.classList.add("hidden");

  if (resetMatch) {
    state.teamMarks = [0, 0];
    state.matchOver = false;
    state.matchWinnerTeam = null;
    state.dealer = secureRandomInt(4);
  } else {
    state.dealer = (state.dealer + 1) % 4;
  }

  soundFX.shuffle();
  state.deck = shuffle(createDeck());
  state.hands = [[], [], [], []];
  state.dealtHands = [[], [], [], []];
  state.currentBid = 0;
  state.bidder = null;
  state.playerBids = [null, null, null, null];
  state.trumpMaker = null;
  state.stakeMultiplier = 1;
  state.doubledBy = null;
  state.redoubledBy = null;
  state.trump = null;
  state.trumpRevealed = false;
  state.animateTrumpReveal = false;
  state.revealedSeventhCard = null;
  state.teamTricksWon = [0, 0];
  state.marriageCardPlayedBy = [null, null];
  state.marriageDeclared = [false, false];
  state.marriageHolderName = ["", ""];
  state.singleHandActive = false;
  state.singleHandCaller = null;
  state.singleHandCallerTricks = 0;
  state.singleHandCaughtEarly = false;
  state.roundCancelled = false;
  state.cancelReason = "";
  state.leader = (state.dealer + 1) % 4;
  state.trickNumber = 1;
  state.played = [];
  state.lastTrick = null;
  state.trickPoints = [0, 0];
  state.activePlayer = null;
  state.lastPlayedPlayer = null;
  state.phase = "bidding";

  for (let i = 0; i < 16; i++) {
    state.hands[i % 4].push(state.deck.shift());
    if (i % 4 === 0) soundFX.cardDeal();
  }
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
        state.playerBids[turn] = "PASS";
        els.statusText.textContent = `${getPlayerName(turn)} passed`;
      } else {
        state.currentBid = bid;
        state.bidder = turn;
        state.playerBids[turn] = bid;
        els.statusText.textContent = `${getPlayerName(turn)} bid ${bid}`;
        if (bid === 28) break;
      }
      renderTable();
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
    soundFX.trumpSelect();
    els.statusText.textContent = `Trump selected by ${getPlayerName(state.bidder)} (hidden until shown)`;
    await sleep(450);
  }
  renderHUD();

  for (let i = 0; i < 16; i++) {
    const card = state.deck.shift();
    if (card) {
      state.hands[i % 4].push(card);
      if (i % 4 === 0) soundFX.cardDeal();
    }
  }
  state.dealtHands = state.hands.map((h) => [...h]);
  els.statusText.textContent = "All 8 cards dealt! Checking rules...";
  renderTable();
  await sleep(450);

  const eightSameSuit = hasEightOfSameSuit(state.hands);
  if (eightSameSuit) {
    state.phase = "finished";
    state.roundCancelled = true;
    state.cancelReason = `${getPlayerName(eightSameSuit.player)} holds all 8 cards of ${eightSameSuit.suit} — Round Cancelled!`;
    els.statusText.textContent = state.cancelReason;
    els.resultTitle.textContent = "Round Cancelled!";
    els.resultDetail.textContent = `${state.cancelReason} No marks changed.`;
    els.continueBtn.textContent = "Redeals Next Round";
    els.resultModal.classList.remove("hidden");
    return;
  }

  // যেকোনো প্লেয়ার (HUMAN বা যেকোনো বট) চাইলে Single Hand ডাকতে পারবে
  const callOrder = [0, 1, 2, 3].map((offset) => (state.bidder + offset) % 4);
  for (const pIdx of callOrder) {
    if (state.singleHandActive) break;

    if (pIdx === HUMAN) {
      const wantsSingle = await promptHumanSingleHand();
      if (wantsSingle) {
        activateSingleHand(HUMAN);
        els.statusText.textContent = `${getPlayerName(HUMAN)} called SINGLE HAND! Must win all 8/8 tricks.`;
        await sleep(550);
        break;
      }
    } else if (botShouldCallSingleHand(pIdx, state.hands)) {
      activateSingleHand(pIdx);
      els.statusText.textContent = `${getPlayerName(pIdx)} called SINGLE HAND! Must win all 8/8 tricks.`;
      await sleep(550);
      break;
    }
  }

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

      if (isPartnerSittingOut(p)) {
        continue;
      }

      state.activePlayer = p;

      const hasLead =
        state.played.length === 0 ||
        state.hands[p].some((c) => c.suit === state.played[0].card.suit);

      if (!state.singleHandActive && !hasLead && !state.trumpRevealed && p !== HUMAN) {
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

      recordMarriageCardPlayed(p, card);
      evaluateInternationalMarriage(true);

      els.statusText.textContent = `Trick ${trick}/8 — ${getPlayerName(p)} played ${card.rank}${card.suit}`;
      renderTable();
      await sleep(220);

      if (
        state.singleHandActive &&
        trick === 1 &&
        state.played.length === 1 &&
        p === state.singleHandCaller
      ) {
        const leadSuit = card.suit;
        const opponents = [0, 1, 2, 3].filter(
          (idx) => idx !== p && idx !== (p + 2) % 4
        );
        const oppHasSuit = opponents.some((opp) =>
          (state.hands[opp] || []).some((c) => c.suit === leadSuit)
        );

        if (!oppHasSuit) {
          state.phase = "finished";
          state.roundCancelled = true;
          state.cancelReason = `Single Hand Caller ${getPlayerName(p)} led ${leadSuit} which neither opponent holds — Round Cancelled!`;
          els.statusText.textContent = state.cancelReason;
          els.resultTitle.textContent = "Single Hand Cancelled!";
          els.resultDetail.textContent = `${state.cancelReason} No marks changed.`;
          els.continueBtn.textContent = "Redeals Next Round";
          els.resultModal.classList.remove("hidden");
          return;
        }
      }
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

    if (state.singleHandActive) {
      if (winner === state.singleHandCaller) {
        state.singleHandCallerTricks += 1;
      } else {
        state.singleHandCaughtEarly = true;
        soundFX.leadWin(false);
        els.statusText.textContent = `Single Hand caught on Trick ${trick} by ${getPlayerName(winner)}! (-${SINGLE_HAND_MARK} Mark)`;
        renderHUD();
        renderTurnIndicators();
        await sleep(600);
        break;
      }
    }

    soundFX.leadWin(winTeam === 0);
    els.statusText.textContent = `${getPlayerName(winner)} got lead (+${earned})`;
    renderHUD();
    renderTurnIndicators();

    evaluateInternationalMarriage(true);
    renderHUD();

    await sleep(750);
  }

  state.phase = "finished";
  state.activePlayer = null;
  state.lastPlayedPlayer = null;

  if (state.singleHandActive && state.singleHandCaller !== null) {
    const callerTeam = state.singleHandCaller % 2;
    const callerWonAllEight =
      !state.singleHandCaughtEarly && state.singleHandCallerTricks === 8;

    if (callerWonAllEight) {
      state.teamMarks[callerTeam] += SINGLE_HAND_MARK;
    } else {
      state.teamMarks[callerTeam] -= SINGLE_HAND_MARK;
    }

    renderHUD();
    renderTurnIndicators();

    const winnerTeam = checkMatchWinner();
    const callerName = getPlayerName(state.singleHandCaller);

    if (winnerTeam !== null) {
      state.matchOver = true;
      state.matchWinnerTeam = winnerTeam;
      soundFX.win();
      const winnerName = getTeamDisplayName(winnerTeam);
      els.resultTitle.textContent = `${winnerName} Won the Game!`;
      els.statusText.textContent = `GAME OVER — ${winnerName} Won!`;
      els.resultDetail.textContent = `Single Hand by ${callerName} (${state.singleHandCallerTricks}/8 tricks) -> Final Marks: Your Team ${formatSignedValue(state.teamMarks[0])} | Opponent ${formatSignedValue(state.teamMarks[1])}`;
      els.continueBtn.textContent = "Play New Game";
      els.resultModal.classList.remove("hidden");
      return;
    }

    if (callerTeam === 0 && callerWonAllEight) soundFX.win();

    els.resultTitle.textContent = callerWonAllEight
      ? `Single Hand Won! (${callerName} +${SINGLE_HAND_MARK})`
      : `Single Hand Caught! (${callerName} -${SINGLE_HAND_MARK})`;
    els.resultDetail.textContent = `${callerName} won ${state.singleHandCallerTricks}/8 tricks before stopping | ${getShortTeamName(callerTeam)} Mark: ${callerWonAllEight ? `+${SINGLE_HAND_MARK}` : `-${SINGLE_HAND_MARK}`} | Marks -> You: ${formatSignedValue(state.teamMarks[0])} vs Opp: ${formatSignedValue(state.teamMarks[1])}`;
    els.continueBtn.textContent = "Continue";
    els.resultModal.classList.remove("hidden");
    return;
  }

  if (!state.trumpRevealed && state.trump) {
    state.trumpRevealed = true;
  }
  evaluateInternationalMarriage(false);

  const effectiveBidTarget = getEffectiveBidTarget(bidderTeam);
  const bidderPts = state.trickPoints[bidderTeam];
  const bidSucceeded = bidderPts >= effectiveBidTarget;

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
    els.resultDetail.textContent = `Final Marks -> Your Team: ${formatSignedValue(state.teamMarks[0])} | Opponent: ${formatSignedValue(state.teamMarks[1])} | Last Hand: ${bidderTeamName} bid ${state.currentBid} (Target ${effectiveBidTarget}) | Pts: ${state.trickPoints[0]} vs ${state.trickPoints[1]}`;
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
  if (state.marriageDeclared[0]) {
    marriageNotes.push(`${state.marriageHolderName[0] || "Your Team"} Marriage (${MARRIAGE_BONUS} pts)`);
  }
  if (state.marriageDeclared[1]) {
    marriageNotes.push(`${state.marriageHolderName[1] || "Opponent"} Marriage (${MARRIAGE_BONUS} pts)`);
  }
  const marriageText = marriageNotes.length > 0 ? marriageNotes.join(", ") : "No Marriage";

  els.resultDetail.textContent = `${bidderTeamName} Bid ${state.currentBid} (Target ${effectiveBidTarget}, ${stakeStatusText}) | Pts: ${state.trickPoints[0]} vs ${state.trickPoints[1]} | ${bidderTeamName} Mark: ${bidSucceeded ? `+${markDelta}` : `-${markDelta}`} | ${marriageText}`;
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

ensureTopLargeMarkPiles();
ensureEditNamesButton();
startRound(true);
