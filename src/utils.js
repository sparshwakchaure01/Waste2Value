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

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.size > MAX_PHOTO_BYTES) {
      reject(new Error(`Image is ${(file.size / 1024 / 1024).toFixed(2)}MB — please upload a photo under 1MB.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result); // data:image/...;base64,xxxx
    reader.onerror = reject;
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
