import { el } from '../utils.js';
import { signInWithGoogle } from '../auth.js';
import { brandLockup, icon } from '../components/logo.js';

const STEPS = [
  { ic: 'list', title: 'List', text: 'Industries post plastic scrap with resin type, grade, quantity and indicative price.' },
  { ic: 'send', title: 'Offer', text: 'A buyer sends one message with a quantity and price. The seller can counter-offer.' },
  { ic: 'phone', title: 'Discuss', text: 'If the seller opts in, phone numbers unlock so both sides can agree terms.' },
  { ic: 'check', title: 'Accept', text: 'On acceptance full details unlock — then pick a transport partner for the route.' },
];

const FEATURES = [
  ['shieldcheck', 'Blind reveal', 'Identities stay hidden until both sides agree — then unlock in two animated steps.'],
  ['chart', 'Market price benchmark', 'See the average ₹/kg per resin and whether a listing is above or below market.'],
  ['truck', 'Transport partners', 'Pick a logistics partner for your route; contacts unlock when they accept.'],
  ['compare', 'Compare listings', 'Put up to three lots side by side by price, volume and distance.'],
  ['bell', 'Saved-search alerts', 'Get flagged when new listings match what you’re looking for.'],
  ['filetext', 'Printable deal sheet', 'A clean summary of parties, terms and transport — Save as PDF.'],
];

// Animated "match network": factory → truck → recycler, drawn inline.
function heroArt() {
  const wrap = el('div', { class: 'hero-art', 'aria-hidden': 'true' });
  wrap.innerHTML = `
    <svg viewBox="0 0 640 190">
      <path class="ha-path" d="M120 95 C 190 20, 250 20, 320 95"/>
      <path class="ha-path" d="M320 95 C 390 170, 450 170, 520 95"/>
      <circle class="ha-pulse" r="5"><animateMotion dur="3.2s" repeatCount="indefinite" path="M120 95 C 190 20, 250 20, 320 95"/></circle>
      <circle class="ha-pulse" r="5"><animateMotion dur="3.2s" begin="1.6s" repeatCount="indefinite" path="M320 95 C 390 170, 450 170, 520 95"/></circle>
      <g class="float"><circle class="ha-node" cx="100" cy="95" r="38"/>
        <path class="ha-ic" d="M82 112V88l11 6v-6l11 6V80h8v32zM82 112h30"/></g>
      <g class="float d2"><circle class="ha-node" cx="320" cy="95" r="38"/>
        <path class="ha-ic" d="M300 84h26v20h-26zM326 90h9l7 7v7h-16"/><circle class="ha-ic" cx="308" cy="108" r="3.5"/><circle class="ha-ic" cx="334" cy="108" r="3.5"/></g>
      <g class="float d3"><circle class="ha-node" cx="540" cy="95" r="38"/>
        <path class="ha-ic" d="M528 86a14 14 0 1 1 6 22M528 86l-1 9 9-1"/></g>
      <text class="ha-label" x="100" y="152">Seller</text>
      <text class="ha-label" x="320" y="152">Transport</text>
      <text class="ha-label" x="540" y="152">Buyer</text>
    </svg>`;
  return wrap;
}

function observeReveal(root) {
  const nodes = root.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { nodes.forEach(n => n.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  nodes.forEach(n => io.observe(n));
}

export function renderLanding(container) {
  container.appendChild(
    el('nav', { class: 'topnav' }, [
      el('div', { class: 'topnav-inner' }, [
        el('div', { class: 'brand' }, brandLockup()),
        el('div', { class: 'flex gap-8 landing-nav-actions' }, [
          el('button', { class: 'btn btn-ghost-light btn-sm', onclick: () => signInWithGoogle('signin') }, 'Sign in'),
          el('button', { class: 'btn btn-google btn-sm', onclick: () => signInWithGoogle('signup') }, 'Create account')
        ])
      ])
    ])
  );

  const hero = el('div', { class: 'container hero' }, [
    el('div', { class: 'hero-eyebrow' }, 'Circular manufacturing · Plastics'),
    el('h1', {}, ['One factory’s plastic waste, ', el('em', {}, 'another’s raw material.')]),
    el('p', {}, 'List scrap plastic, get matched with buyers nearby, and connect only once both sides agree — identities stay private until then.'),
    el('div', { class: 'hero-actions' }, [
      el('button', { class: 'btn btn-primary', onclick: () => signInWithGoogle('signup') }, 'Create account with Google'),
      el('button', { class: 'btn btn-outline', onclick: () => signInWithGoogle('signin') }, 'Sign in'),
    ]),
    heroArt(),
    el('div', { class: 'trust-strip' }, [
      el('div', {}, [el('strong', {}, '9'), el('span', {}, 'resin categories')]),
      el('div', {}, [el('strong', {}, '36'), el('span', {}, 'districts')]),
      el('div', {}, [el('strong', {}, '2-step'), el('span', {}, 'blind reveal')]),
    ]),
  ]);
  container.appendChild(hero);

  container.appendChild(el('section', { class: 'container landing-section' }, [
    el('h2', { class: 'section-title reveal' }, 'How a match works'),
    el('div', { class: 'how-grid' }, STEPS.map((s, i) =>
      el('div', { class: `how-step reveal d${Math.min(i, 3)}` }, [
        el('div', { class: 'how-ic' }, icon(s.ic, 22)),
        el('div', { class: 'how-num' }, `0${i + 1}`),
        el('h3', {}, s.title),
        el('p', {}, s.text)
      ])
    ))
  ]));

  container.appendChild(el('section', { class: 'container landing-section' }, [
    el('h2', { class: 'section-title reveal' }, 'Built to close deals faster'),
    el('div', { class: 'feature-grid' }, FEATURES.map(([ic, title, text], i) =>
      el('div', { class: `feature reveal d${i % 3}` }, [icon(ic, 24), el('h3', {}, title), el('p', {}, text)])
    ))
  ]));

  container.appendChild(el('section', { class: 'container landing-section' }, [
    el('h2', { class: 'section-title reveal' }, 'Built for two kinds of operators'),
    el('div', { class: 'role-pick-grid reveal' }, [
      el('div', { class: 'role-pick-card' }, [
        el('div', { class: 'ic' }, icon('factory', 30)),
        el('h3', {}, 'Industry'),
        el('p', {}, 'Sell plastic scrap, or browse the marketplace to source recycled input.')
      ]),
      el('div', { class: 'role-pick-card' }, [
        el('div', { class: 'ic' }, icon('truck', 30)),
        el('h3', {}, 'Logistics'),
        el('p', {}, 'Declare your districts and vehicle. Get requests only from buyers and sellers who pick you.')
      ])
    ]),
    el('p', { class: 'text-faint landing-note' }, 'New here? Create an account with Google and pick your role. Already registered? Just sign in.')
  ]));

  container.appendChild(el('footer', { class: 'site-footer' }, [
    el('div', { class: 'container' }, [
      el('span', { class: 'brand-word' }, ['Waste', el('span', { class: 'brand-two' }, '2'), 'Value']),
      el('span', {}, ['Industrial by-product exchange · Team SYNC · Pragyan 2K26 · ', el('a', { href: '#/admin-login', class: 'footer-link' }, 'Admin')])
    ])
  ]));

  requestAnimationFrame(() => observeReveal(container));
}
