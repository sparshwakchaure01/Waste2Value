export const $ = (sel, root = document) => root.querySelector(sel);
export const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c === null || c === undefined) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
}

const MAX_PHOTO_BYTES = 1024 * 1024; // 1MB hard limit, as specified

// Base64 inflates size by ~33% and a Firestore document is capped at 1MiB, so after the
// 1MB upload check the image is downscaled to a JPEG (max 1200px) before being stored.
const MAX_PHOTO_DIMENSION = 1200;

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      reject(new Error(`Image is ${(file.size / 1024 / 1024).toFixed(2)}MB — please upload a photo under 1MB.`));
      return;
    }
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8)); // data:image/jpeg;base64,xxxx
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function toast(message, type = 'default') {
  const root = $('#toast-root');
  const node = el('div', { class: `toast ${type === 'success' ? 'success' : type === 'error' ? 'error' : ''}` }, message);
  node.style.position = 'fixed';
  node.style.left = '50%';
  root.appendChild(node);
  setTimeout(() => { node.remove(); }, 3200);
}

export function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
}

export function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

const reducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Animated number for stat cards.
export function countUp(node, to, duration = 750) {
  const target = Number(to) || 0;
  if (reducedMotion() || target === 0) { node.textContent = String(target); return; }
  const start = performance.now();
  node.textContent = '0';
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    node.textContent = String(Math.round(target * eased));
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export function counter(n) {
  const node = el('div', { class: 'n' }, '0');
  countUp(node, n);
  return node;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ---------- skeleton loaders ----------
const sk = (cls = '') => el('div', { class: `skeleton ${cls}` });

export function skeletonCards(n = 6) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < n; i++) {
    frag.appendChild(el('div', { class: 'card skeleton-card' }, [
      sk('sk-photo'),
      el('div', { class: 'listing-body' }, [sk('sk-line sk-short'), sk('sk-line'), sk('sk-line sk-mid')])
    ]));
  }
  return frag;
}

export function skeletonRows(n = 3) {
  const wrap = el('div', {});
  for (let i = 0; i < n; i++) {
    wrap.appendChild(el('div', { class: 'request-card' }, [sk('sk-line sk-mid'), sk('sk-line'), sk('sk-line sk-short')]));
  }
  return wrap;
}

export function skeletonStats(n = 3) {
  const wrap = el('div', { class: 'stat-row' });
  for (let i = 0; i < n; i++) wrap.appendChild(el('div', { class: 'stat-card' }, [sk('sk-num'), sk('sk-line sk-short')]));
  return wrap;
}
