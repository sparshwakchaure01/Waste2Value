import { el, initials, formatDate, counter } from '../utils.js';
import { getAllUsers, getPlatformStats } from '../services/admin.js';
import { ADMIN_EMAILS } from '../data/categories.js';
import { isAdminEmail } from '../auth.js';
import { state } from '../state.js';

export async function renderAdmin(container) {
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', {}, 'Admin Panel'), el('p', {}, 'User list, platform analytics, and settings.')])
  ]));

  const [stats, users] = await Promise.all([getPlatformStats(), getAllUsers()]);

  container.appendChild(el('div', { class: 'stat-row' }, [
    statCard(stats.totalUsers, 'Total Users'),
    statCard(stats.totalIndustry, 'Industry Users'),
    statCard(stats.totalLogistics, 'Logistics Users'),
    statCard(stats.totalListings, 'Total Listings'),
    statCard(stats.totalAvailable, 'Available'),
    statCard(stats.totalMatched, 'Matched'),
    statCard(stats.totalRequests, 'Total Requests'),
    statCard(stats.totalAccepted, 'Accepted Deals'),
  ]));

  container.appendChild(el('h3', { class: 'mt-16' }, 'By-category breakdown'));
  const catRow = el('div', { class: 'flex gap-8', style: 'flex-wrap:wrap;' });
  Object.entries(stats.byCategory).forEach(([cat, count]) => {
    catRow.appendChild(el('span', { class: 'pill pill-neutral' }, `${cat}: ${count}`));
  });
  container.appendChild(catRow);

  container.appendChild(el('h3', { class: 'mt-16' }, 'Users'));
  const table = el('table', { class: 'admin-table' }, [
    el('thead', {}, el('tr', {}, [
      el('th', {}, 'User'), el('th', {}, 'Role'), el('th', {}, 'Company'),
      el('th', {}, 'Email'), el('th', {}, 'District'), el('th', {}, 'Joined')
    ])),
    el('tbody', {}, users.map(u => el('tr', {}, [
      el('td', {}, el('div', { class: 'flex gap-8', style: 'align-items:center;' }, [
        el('div', { class: 'nav-avatar', style: 'width:28px;height:28px;font-size:11px;' }, initials(u.name || '?')),
        u.name || '—'
      ])),
      el('td', {}, el('span', { class: 'pill pill-neutral' }, u.role || '—')),
      el('td', {}, u.companyName || '—'),
      el('td', {}, u.email || '—'),
      el('td', {}, u.district || '—'),
      el('td', {}, formatDate(u.createdAt))
    ])))
  ]);
  container.appendChild(table);

  container.appendChild(el('h3', { class: 'mt-16' }, 'Settings'));
  container.appendChild(el('div', { class: 'card' }, [
    el('p', {}, [
      'Admin access is granted by email, via ',
      el('code', {}, 'src/data/categories.js'),
      ' → ',
      el('code', {}, 'ADMIN_EMAILS'),
      '.'
    ]),
    el('p', { class: 'text-faint mt-8' }, `Signed in as: ${state.firebaseUser?.email} ${isAdminEmail(state.firebaseUser?.email) ? '(admin)' : ''}`)
  ]));
}

function statCard(n, label) {
  return el('div', { class: 'stat-card' }, [counter(n), el('div', { class: 'l' }, label)]);
}
