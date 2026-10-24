import { el } from '../utils.js';
import { signInWithGoogle } from '../auth.js';
import { brandLockup, icon } from '../components/logo.js';

const STEPS = [
  { ic: 'list', title: 'List', text: 'Industries post plastic scrap with resin type, grade, quantity and indicative price.' },
  { ic: 'send', title: 'Request', text: 'A buyer sends one message. No open chat, no spam — identities stay hidden.' },
  { ic: 'phone', title: 'Discuss', text: 'If the seller opts in, phone numbers unlock so both sides can agree terms.' },
  { ic: 'check', title: 'Accept', text: 'On acceptance full details unlock and logistics operators see the pickup.' },
];

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
    el('div', { class: 'trust-strip' }, [
      el('div', {}, [el('strong', {}, '9'), el('span', {}, 'resin categories')]),
      el('div', {}, [el('strong', {}, '36'), el('span', {}, 'districts')]),
      el('div', {}, [el('strong', {}, '2-step'), el('span', {}, 'blind reveal')]),
    ]),
  ]);
  container.appendChild(hero);

  container.appendChild(el('section', { class: 'container landing-section' }, [
    el('h2', { class: 'section-title' }, 'How a match works'),
    el('div', { class: 'how-grid' }, STEPS.map((s, i) =>
      el('div', { class: 'how-step' }, [
        el('div', { class: 'how-ic' }, icon(s.ic, 22)),
        el('div', { class: 'how-num' }, `0${i + 1}`),
        el('h3', {}, s.title),
        el('p', {}, s.text)
      ])
    ))
  ]));

  container.appendChild(el('section', { class: 'container landing-section' }, [
    el('h2', { class: 'section-title' }, 'Built for two kinds of operators'),
    el('div', { class: 'role-pick-grid' }, [
      el('div', { class: 'role-pick-card' }, [
        el('div', { class: 'ic' }, icon('factory', 30)),
        el('h3', {}, 'Industry'),
        el('p', {}, 'Sell plastic scrap, or browse the marketplace to source recycled input.')
      ]),
      el('div', { class: 'role-pick-card' }, [
        el('div', { class: 'ic' }, icon('truck', 30)),
        el('h3', {}, 'Logistics'),
        el('p', {}, 'Declare your districts and vehicle, and pick up accepted deals.')
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
}
