import { el } from '../utils.js';
import { signInWithGoogle } from '../auth.js';

export function renderLanding(container) {
  container.appendChild(
    el('nav', { class: 'topnav' }, [
      el('div', { class: 'topnav-inner' }, [
        el('div', { class: 'brand' }, [
          el('div', { class: 'brand-mark' }, '♻️'),
          'Waste2Value'
        ]),
        el('button', { class: 'btn btn-google btn-sm', onclick: signInWithGoogle }, [
          '🇬 Continue with Google'
        ])
      ])
    ])
  );

  const hero = el('div', { class: 'container hero' }, [
    el('div', { class: 'hero-eyebrow' }, '♻ Industrial By-Product Exchange'),
    el('h1', {}, ['One factory’s plastic waste, ', el('em', {}, 'another’s raw material.')]),
    el('p', {}, 'List scrap plastic, get matched with nearby buyers, and connect once both sides agree — identities stay private until then.'),
    el('div', { class: 'hero-actions' }, [
      el('button', { class: 'btn btn-google', onclick: signInWithGoogle }, '🇬 Continue with Google'),
    ]),
    el('div', { class: 'role-pick-grid' }, [
      el('div', { class: 'role-pick-card' }, [
        el('div', { class: 'ic' }, '🏭'),
        el('h3', {}, 'Industry'),
        el('p', {}, 'List plastic scrap to sell, or browse the marketplace to buy.')
      ]),
      el('div', { class: 'role-pick-card' }, [
        el('div', { class: 'ic' }, '🚚'),
        el('h3', {}, 'Logistics'),
        el('p', {}, 'List your vehicle and service districts, pick up completed deals.')
      ])
    ]),
    el('p', { class: 'text-faint', style: 'margin-top:28px;' }, 'Sign in with Google — you’ll choose your role next.')
  ]);
  container.appendChild(hero);
}
