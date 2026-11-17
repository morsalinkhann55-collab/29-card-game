// ===== ২৯ খেলার ডাক (বিড) সিস্টেম =====

// ছোট একটা সাহায্যকারী: একজন প্লেয়ারের হাত দেখে সে কত ডাকবে সেটা ঠিক করে
// (এটা সহজ বট, পরে আমরা আরও স্মার্ট করব)
function botBid(hand, currentBid) {
  // হাতের পয়েন্ট যোগ করি
  let total = 0;
  for (const c of hand) total += c.points;

  // সহজ নিয়ম: পয়েন্ট বেশি থাকলে ডাকে, কম থাকলে পাস
  let wanted = 0;
  if (total >= 5) wanted = 20;
  else if (total >= 4) wanted = 18;
  else if (total >= 3) wanted = 16;

  if (wanted > currentBid) return wanted;
  return "pass";
}

// পুরো ডাকের রাউন্ড চালানো
// dealer = ডিলার কে (০ থেকে ৩), hands = চারজনের ৪টা করে কার্ড
function runBidding(hands, dealer) {
  let currentBid = 0;      // এখন পর্যন্ত সর্বোচ্চ ডাক
  let bidder = null;       // কে সর্বোচ্চ ডেকেছে
  const passed = [false, false, false, false];

  // ডিলারের বাঁ পাশের প্লেয়ার প্রথমে ডাকে
  let turn = (dealer + 1) % 4;

  while (true) {
    // যারা পাস করেনি তাদের গোনা
    const active = passed.filter((p) => !p).length;

    // একজন ছাড়া সবাই পাস করলে এবং কেউ ডেকে থাকলে ডাক শেষ
    if (bidder !== null && active === 1) break;
    // সবাই পাস করলে ডাক শেষ (কেউ ডাকেনি)
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
        if (bid === 28) break; // ২৮ এর বেশি ডাকা যায় না
      }
    }
    turn = (turn + 1) % 4;
  }

  return { bidder, currentBid };
}

// ===== পরীক্ষা =====
// cards.js এর কাজগুলো এখানে আবার লিখছি, যাতে এই ফাইল আলাদা চলে
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["J", "9", "A", "10", "K", "Q", "8", "7"];
const POINTS = { J: 3, "9": 2, A: 1, "10": 1, K: 0, Q: 0, "8": 0, "7": 0 };

function createDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const rank of RANKS) deck.push({ suit, rank, points: POINTS[rank] });
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
function deal(deck, count) {
  const hands = [[], [], [], []];
  for (let i = 0; i < count * 4; i++) hands[i % 4].push(deck.shift());
  return hands;
}
function showHand(hand) {
  return hand.map((c) => c.rank + c.suit).join("  ");
}

const deck = shuffle(createDeck());
const hands = deal(deck, 4);
const dealer = 0; // প্লেয়ার ১ ডিলার

hands.forEach((h, i) => console.log("প্লেয়ার " + (i + 1) + ":", showHand(h)));
console.log("--- ডাক শুরু ---");

const result = runBidding(hands, dealer);

console.log("--- ফলাফল ---");
if (result.bidder === null) {
  console.log("সবাই পাস করেছে, নতুন করে কার্ড বিতরণ হবে।");
} else {
  console.log(
    "প্লেয়ার " + (result.bidder + 1) + " জিতেছে, ডাক: " + result.currentBid
  );
}