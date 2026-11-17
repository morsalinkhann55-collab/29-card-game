// ===== ২৯ খেলা: নিয়ম অনুযায়ী সম্পূর্ণ স্বয়ংক্রিয় গেম =====
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["J", "9", "A", "10", "K", "Q", "8", "7"]; // বড় থেকে ছোট
const POINTS = { J: 3, "9": 2, A: 1, "10": 1, K: 0, Q: 0, "8": 0, "7": 0 };

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

function show(card) {
  return card.rank + card.suit;
}

function showHand(hand) {
  return hand.map(show).join("  ");
}

// কার্ডের শক্তি: ছোট সংখ্যা = বড় কার্ড
function rankPower(card) {
  return RANKS.indexOf(card.rank);
}

// ---------- ডাক ----------
function botBid(hand, currentBid) {
  let total = 0;
  for (const c of hand) total += c.points;

  let wanted = 0;
  if (total >= 5) wanted = 20;
  else if (total >= 4) wanted = 18;
  else if (total >= 3) wanted = 16;

  return wanted > currentBid ? wanted : "pass";
}

function runBidding(hands, dealer) {
  let currentBid = 0;
  let bidder = null;
  const passed = [false, false, false, false];
  let turn = (dealer + 1) % 4;

  while (true) {
    const active = passed.filter((p) => !p).length;
    if (bidder !== null && active === 1) break;
    if (active === 0) break;

    if (!passed[turn]) {
      const bid = botBid(hands[turn], currentBid);
      if (bid === "pass") {
        passed[turn] = true;
        console.log("প্লেয়ার " + (turn + 1) + ": পাস");
      } else {
        currentBid = bid;
        bidder = turn;
        console.log("প্লেয়ার " + (turn + 1) + ": ডাক " + bid);
        if (bid === 28) break;
      }
    }
    turn = (turn + 1) % 4;
  }

  return { bidder, currentBid };
}

// ---------- তুরুপ বেছে নেওয়া ----------
function chooseTrump(hand) {
  const score = {};
  for (const s of SUITS) score[s] = 0;
  for (const c of hand) score[c.suit] += c.points + 1;

  let best = SUITS[0];
  for (const s of SUITS) {
    if (score[s] > score[best]) best = s;
  }
  return best;
}

// ---------- জোড়া (K + Q of Trump) চেক ----------
function checkCouple(hands, trump) {
  // টিম ০ = প্লেয়ার ১ ও ৩ ; টিম ১ = প্লেয়ার ২ ও ৪
  const coupleBonus = [0, 0];
  let foundAny = false;

  for (let team = 0; team < 2; team++) {
    const combined = [...hands[team], ...hands[team + 2]];
    const hasK = combined.some((c) => c.suit === trump && c.rank === "K");
    const hasQ = combined.some((c) => c.suit === trump && c.rank === "Q");
    if (hasK && hasQ) {
      coupleBonus[team] = 4;
      foundAny = true;
      console.log(
        "জোড়া! টিম " +
          (team + 1) +
          " এর হাতে তুরুপ (" +
          trump +
          ") এর K ও Q আছে (+4 বোনাস)"
      );
    }
  }

  if (!foundAny) {
    console.log("কোনো টিমের হাতে তুরুপের জোড়া (K+Q) নেই।");
  }

  return coupleBonus;
}

// ---------- একটা হাতের বিজয়ী ----------
function trickWinner(played, trump, trumpRevealed) {
  let best = played[0];

  for (const p of played.slice(1)) {
    const cs = p.card.suit;
    const bs = best.card.suit;

    if (cs === bs) {
      if (rankPower(p.card) < rankPower(best.card)) best = p;
    } else if (trumpRevealed && cs === trump && bs !== trump) {
      best = p; // তুরুপ প্রকাশ থাকলে তুরুপ কেটে দেবে
    }
  }
  return best.player;
}

// ---------- কোন কার্ড খেলা যাবে ----------
function legalCards(hand, played) {
  if (played.length === 0) return hand;
  const leadSuit = played[0].card.suit;
  const same = hand.filter((c) => c.suit === leadSuit);
  return same.length > 0 ? same : hand;
}

// ---------- বট: কোন কার্ড খেলবে ----------
function botPlay(hand, played, trump, trumpRevealed) {
  const legal = [...legalCards(hand, played)];
  legal.sort((a, b) => rankPower(b) - rankPower(a)); // ছোট কার্ড আগে

  if (played.length === 3) {
    for (const c of legal) {
      const test = [...played, { player: -1, card: c }];
      if (trickWinner(test, trump, trumpRevealed) === -1) return c;
    }
  }
  return legal[0];
}

// ---------- পুরো একটা গেম ----------
function playGame() {
  const deck = shuffle(createDeck());
  const dealer = 0;
  const hands = [[], [], [], []];

  // প্রথম ৪টা করে কার্ড
  for (let i = 0; i < 16; i++) hands[i % 4].push(deck.shift());
  console.log("--- প্রথম ৪টা কার্ড ---");
  hands.forEach((h, i) => console.log("প্লেয়ার " + (i + 1) + ":", showHand(h)));

  console.log("--- ডাক ---");
  const { bidder, currentBid } = runBidding(hands, dealer);
  if (bidder === null) {
    console.log("সবাই পাস, নতুন করে কার্ড বিতরণ হবে।");
    return;
  }
  console.log("ডাকদাতা: প্লেয়ার " + (bidder + 1) + ", ডাক: " + currentBid);

  // তুরুপ ঠিক করা (শুরুতে গোপন থাকে)
  const trump = chooseTrump(hands[bidder]);
  let trumpRevealed = false;
  console.log("গোপন তুরুপ সেট হয়েছে (পরীক্ষার জন্য দেখানো হচ্ছে): " + trump);

  // বাকি ৪টা করে কার্ড, এখন সবার ৮টা
  for (let i = 0; i < 16; i++) hands[i % 4].push(deck.shift());
  console.log("--- ৮টা করে কার্ড ---");
  hands.forEach((h, i) => console.log("প্লেয়ার " + (i + 1) + ":", showHand(h)));

  // জোড়া চেক
  console.log("--- জোড়া (K+Q) যাচাই ---");
  const coupleBonus = checkCouple(hands, trump);

  const teamPoints = [0, 0]; // টিম ১ = প্লেয়ার ১,৩ ; টিম ২ = প্লেয়ার ২,৪
  let leader = (dealer + 1) % 4;
  console.log("--- খেলা শুরু ---");

  for (let trick = 1; trick <= 8; trick++) {
    const played = [];
    for (let k = 0; k < 4; k++) {
      const p = (leader + k) % 4;
      const hasLead =
        played.length === 0 ||
        hands[p].some((c) => c.suit === played[0].card.suit);

      // লিড রঙের কার্ড না থাকলে এবং তুরুপ এখনো প্রকাশ না হলে তুরুপ দেখানোর নিয়ম
      if (!hasLead && !trumpRevealed) {
        trumpRevealed = true;
        console.log(
          "  >> প্লেয়ার " +
            (p + 1) +
            " লিড রঙ পায়নি! তুরুপ প্রকাশ করা হলো: " +
            trump
        );
      }

      const card = botPlay(hands[p], played, trump, trumpRevealed);
      hands[p] = hands[p].filter((c) => c !== card);
      played.push({ player: p, card });
    }

    const winner = trickWinner(played, trump, trumpRevealed);
    const pts = played.reduce((s, x) => s + x.card.points, 0);
    const bonus = trick === 8 ? 1 : 0; // শেষ হাতে ১ পয়েন্ট বোনাস
    teamPoints[winner % 2] += pts + bonus;

    console.log(
      "হাত " +
        trick +
        ": " +
        played.map((x) => "P" + (x.player + 1) + ":" + show(x.card)).join("  ") +
        "  → জিতল P" +
        (winner + 1) +
        " (+" +
        (pts + bonus) +
        ")"
    );
    leader = winner;
  }

  const finalPoints = [
    teamPoints[0] + coupleBonus[0],
    teamPoints[1] + coupleBonus[1],
  ];

  console.log("--- ফলাফল ---");
  console.log("টিম ১ (প্লেয়ার ১,৩): " + finalPoints[0] + " পয়েন্ট");
  console.log("টিম ২ (প্লেয়ার ২,৪): " + finalPoints[1] + " পয়েন্ট");
  console.log(
    "কার্ড + শেষ হাতের পয়েন্ট: " +
      (teamPoints[0] + teamPoints[1]) +
      " (২৯ হওয়া উচিত)"
  );

  const bidderTeam = bidder % 2;
  if (finalPoints[bidderTeam] >= currentBid) {
    console.log("ডাকদাতার টিম জিতেছে! (লক্ষ্য ছিল " + currentBid + ")");
  } else {
    console.log("ডাকদাতার টিম হেরেছে। (লক্ষ্য ছিল " + currentBid + ")");
  }
}

playGame();