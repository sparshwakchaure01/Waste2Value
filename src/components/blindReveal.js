import { el, toast, copyText } from '../utils.js';

// The signature "blind reveal" moment — a locked card that opens into real
// contact details once the request status allows it. `level` is computed by
// requests.revealLevel(status): 'none' | 'phone' | 'full'.

function contactRow(label, value, { href = null, copy = false } = {}) {
  const shown = value || 'Not provided';
  const valueNode = href && value
    ? el('a', { class: 'reveal-contact-value reveal-link', href }, shown)
    : el('span', { class: 'reveal-contact-value' }, shown);
  const row = el('div', { class: 'reveal-contact-row' }, [
    el('span', { class: 'reveal-contact-label' }, label),
    valueNode
  ]);
  if (copy && value) {
    row.appendChild(el('button', {
      type: 'button',
      class: 'copy-btn',
      title: `Copy ${label.toLowerCase()}`,
      onclick: async () => {
        const ok = await copyText(value);
        toast(ok ? `${label} copied` : 'Could not copy', ok ? 'success' : 'error');
      }
    }, 'Copy'));
  }
  return row;
}

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

  const phone = otherUser?.phone;

  if (level === 'phone') {
    return el('div', { class: 'reveal-card' }, [
      el('div', { class: 'reveal-lock-icon unlocking', style: 'text-align:center;' }, '🔓'),
      contactRow('Phone', phone, { href: phone ? `tel:${phone}` : null, copy: true }),
      el('p', { style: 'color:rgba(255,255,255,.6);margin:12px 0 0;font-size:12px;' },
        'Phone unlocked for discussion. Full company details unlock once the deal is fully accepted.')
    ]);
  }

  // level === 'full'
  return el('div', { class: 'reveal-card' }, [
    el('div', { class: 'reveal-lock-icon unlocking', style: 'text-align:center;' }, '✅'),
    contactRow('Company', otherUser?.companyName || otherUser?.name || '—'),
    contactRow('Phone', phone, { href: phone ? `tel:${phone}` : null, copy: true }),
    contactRow('Email', otherUser?.email, { href: otherUser?.email ? `mailto:${otherUser.email}` : null, copy: true }),
    contactRow('District', otherUser?.district || '—')
  ]);
}
