import { el } from '../utils.js';

// The signature "blind reveal" moment — a locked card that opens into real
// contact details once the request status allows it. `level` is computed by
// requests.revealLevel(status): 'none' | 'phone' | 'full'.
export function renderRevealCard(level, otherUser, otherLabel = 'Other party') {
  if (level === 'none') {
    return el('div', { class: 'reveal-card' }, [
      el('div', { class: 'reveal-locked' }, [
        el('div', { class: 'reveal-lock-icon' }, '🔒'),
        el('div', {}, [
          el('strong', {}, `${otherLabel}'s details are hidden`),
        ]),
        el('p', { style: 'color:rgba(255,255,255,.65);margin:0;font-size:12.5px;' },
          'Identity stays private until both sides accept the match.')
      ])
    ]);
  }

  if (level === 'phone') {
    return el('div', { class: 'reveal-card' }, [
      el('div', { class: 'reveal-lock-icon unlocking', style: 'text-align:center;' }, '🔓'),
      el('div', { class: 'reveal-contact-row' }, [
        el('span', { class: 'reveal-contact-label' }, 'Phone'),
        el('span', { class: 'reveal-contact-value' }, otherUser?.phone || 'Not provided')
      ]),
      el('p', { style: 'color:rgba(255,255,255,.6);margin:12px 0 0;font-size:12px;' },
        'Phone unlocked for discussion. Full company details unlock once the deal is fully accepted.')
    ]);
  }

  // level === 'full'
  return el('div', { class: 'reveal-card' }, [
    el('div', { class: 'reveal-lock-icon unlocking', style: 'text-align:center;' }, '✅'),
    el('div', { class: 'reveal-contact-row' }, [
      el('span', { class: 'reveal-contact-label' }, 'Company'),
      el('span', { class: 'reveal-contact-value' }, otherUser?.companyName || otherUser?.name || '—')
    ]),
    el('div', { class: 'reveal-contact-row' }, [
      el('span', { class: 'reveal-contact-label' }, 'Phone'),
      el('span', { class: 'reveal-contact-value' }, otherUser?.phone || 'Not provided')
    ]),
    el('div', { class: 'reveal-contact-row' }, [
      el('span', { class: 'reveal-contact-label' }, 'Email'),
      el('span', { class: 'reveal-contact-value' }, otherUser?.email || 'Not provided')
    ]),
    el('div', { class: 'reveal-contact-row' }, [
      el('span', { class: 'reveal-contact-label' }, 'District'),
      el('span', { class: 'reveal-contact-value' }, otherUser?.district || '—')
    ])
  ]);
}
