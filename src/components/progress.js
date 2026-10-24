// Slim top progress bar shown while a page loads.
let bar = null;
let timer = null;
let pending = 0;

function ensure() {
  if (!bar) { bar = document.createElement('div'); bar.className = 'top-progress'; document.body.appendChild(bar); }
  return bar;
}

export function startProgress() {
  const b = ensure();
  pending++;
  clearInterval(timer);
  b.classList.add('on');
  b.style.width = '12%';
  let w = 12;
  timer = setInterval(() => { w += (90 - w) * 0.12; b.style.width = `${w}%`; }, 180);
}

export function doneProgress() {
  pending = Math.max(0, pending - 1);
  if (pending) return;
  clearInterval(timer);
  const b = ensure();
  b.style.width = '100%';
  setTimeout(() => { b.classList.remove('on'); setTimeout(() => { b.style.width = '0'; }, 300); }, 220);
}
