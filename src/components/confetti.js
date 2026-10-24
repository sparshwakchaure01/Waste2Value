import { el } from '../utils.js';

const COLORS = ['#19C597', '#0B8A68', '#C9A24E', '#0A1220', '#8ADBC4', '#F2C879'];
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function burst() {
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const originX = window.innerWidth / 2, originY = window.innerHeight * 0.38;
  const pieces = Array.from({ length: 150 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    return {
      x: originX, y: originY,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 5,
      w: 5 + Math.random() * 7, h: 3 + Math.random() * 5,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    };
  });

  const start = performance.now();
  (function frame(now) {
    const t = now - start;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    pieces.forEach(p => {
      p.vy += 0.28; p.vx *= 0.992;
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 2600);
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (t < 2600) requestAnimationFrame(frame); else canvas.remove();
  })(start);
}

// Confetti + an animated check badge. Used when a deal is accepted, delivered, or a listing goes live.
export function celebrate(title = 'Done!', text = '') {
  if (!reduced()) burst();
  const badge = el('div', { class: 'celebrate' });
  badge.innerHTML = `
    <svg viewBox="0 0 52 52" class="celebrate-check" aria-hidden="true">
      <circle cx="26" cy="26" r="23" fill="none" stroke-width="3"/>
      <path d="M15 27l8 8 14-16" fill="none" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  badge.appendChild(el('div', {}, [el('strong', {}, title), text ? el('span', {}, text) : null]));
  document.body.appendChild(badge);
  setTimeout(() => badge.classList.add('out'), 2300);
  setTimeout(() => badge.remove(), 2700);
}
