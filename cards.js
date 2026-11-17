// ===== ২৯ খেলার কার্ড ও ডেক =====

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["J", "9", "A", "10", "K", "Q", "8", "7"]; // বড় থেকে ছোট
const POINTS = { J: 3, "9": 2, A: 1, "10": 1, K: 0, Q: 0, "8": 0, "7": 0 };

// ৩২ কার্ডের ডেক বানানো
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, points: POINTS[rank] });
    }
  }
  return deck;
}

// কার্ড শাফল করা (Fisher-Yates পদ্ধতি)
function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ৪ জনকে কার্ড দেওয়া (প্রত্যেককে count টা করে)
function deal(deck, count) {
  const hands = [[], [], [], []];
  for (let i = 0; i < count * 4; i++) {
    hands[i % 4].push(deck.shift());
  }
  return hands;
}

// কার্ড সুন্দর করে দেখানোর জন্য
function showHand(hand) {
  return hand.map((c) => c.rank + c.suit).join("  ");
}

// ===== পরীক্ষা =====
let deck = shuffle(createDeck());
console.log("মোট কার্ড:", deck.length);

const hands = deal(deck, 4); // প্রথমে ৪টা করে
const names = ["প্লেয়ার ১", "প্লেয়ার ২ (বিপক্ষ)", "প্লেয়ার ৩ (পার্টনার)", "প্লেয়ার ৪ (বিপক্ষ)"];

hands.forEach((hand, i) => {
  console.log(names[i] + ":", showHand(hand));
});

console.log("ডেকে বাকি কার্ড:", deck.length);