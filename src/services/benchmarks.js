import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';

// Market price benchmark per resin, computed from every listing on the platform (₹/kg).
let cache = null;
let cachedAt = 0;

export async function getMarketStats(force = false) {
  if (!force && cache && Date.now() - cachedAt < 60000) return cache;
  const snap = await getDocs(collection(db, 'listings'));
  const byCat = {};
  snap.docs.forEach(d => {
    const l = d.data();
    const price = Number(l.costPerKg);
    if (l.status === 'Unavailable' || !(price > 0)) return;
    (byCat[l.category] ||= []).push(price);
  });
  const stats = {};
  Object.entries(byCat).forEach(([cat, prices]) => {
    prices.sort((a, b) => a - b);
    const sum = prices.reduce((s, p) => s + p, 0);
    stats[cat] = {
      count: prices.length,
      min: prices[0],
      max: prices[prices.length - 1],
      avg: sum / prices.length,
      median: prices[Math.floor(prices.length / 2)]
    };
  });
  cache = stats;
  cachedAt = Date.now();
  return stats;
}

// How a price compares with the market average for its resin.
export function priceVerdict(price, stat) {
  if (!stat || stat.count < 2 || !(price > 0)) return null;
  const diff = ((price - stat.avg) / stat.avg) * 100;
  const label = diff < -8 ? 'Below market' : diff > 8 ? 'Above market' : 'In line with market';
  const tone = diff < -8 ? 'good' : diff > 8 ? 'warn' : 'ok';
  return { diff: Math.round(diff), label, tone };
}
