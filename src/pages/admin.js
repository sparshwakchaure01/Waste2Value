import { el, initials, formatDate, counter, debounce, toast } from '../utils.js';
import { getAllUsers, getPlatformStats } from '../services/admin.js';
import { ADMIN_EMAILS } from '../data/categories.js';
import { isAdminEmail } from '../auth.js';
import { state } from '../state.js';
import { barChart } from '../components/charts.js';
import { emptyState } from '../components/emptyState.js';
import { icon } from '../components/logo.js';

export async function renderAdmin(container) {
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', {}, 'Admin Panel'), el('p', {}, 'User list, platform analytics, and settings.')])
  ]));

  let stats, users;
  try {
    [stats, users] = await Promise.all([getPlatformStats(), getAllUsers()]);
  } catch (err) {
    console.error(err);
    container.appendChild(emptyState('search', 'Could not load admin data — publish the latest Firestore rules and try again.'));
    return;
  }

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

  const categoryEntries = Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]);
  const statusEntries = [['Available', stats.totalAvailable], ['Matched', stats.totalMatched],
    ['Other', Math.max(0, stats.totalListings - stats.totalAvailable - stats.totalMatched)]];
  container.appendChild(el('div', { class: 'dash-grid' }, [
    el('div', { class: 'card' }, [el('h3', {}, 'Listings by category'),
      categoryEntries.length ? barChart(categoryEntries) : emptyState('listings', 'No listings yet.')]),
    el('div', { class: 'card' }, [el('h3', {}, 'Listings by status'), barChart(statusEntries)])
  ]));

  // ---- users table: search, role filter, CSV export ----
  container.appendChild(el('div', { class: 'section-head' }, [el('h3', {}, 'Users')]));
  const search = el('input', { type: 'search', class: 'input', placeholder: 'Search name, company, email, district…', style: 'flex:1;min-width:200px;' });
  const roleSelect = el('select', { class: 'input', style: 'width:auto;' }, [
    el('option', { value: '' }, 'All roles'), el('option', { value: 'industry' }, 'Industry'), el('option', { value: 'logistics' }, 'Logistics')
  ]);
  const exportBtn = el('button', { class: 'btn btn-outline btn-sm' }, [icon('chart', 14), 'Export CSV']);
  container.appendChild(el('div', { class: 'district-tools' }, [search, roleSelect, exportBtn]));

  const tableHost = el('div', {});
  container.appendChild(tableHost);
  let shown = users;

  function applyFilters() {
    const q = search.value.trim().toLowerCase();
    shown = users.filter(u =>
      (!roleSelect.value || u.role === roleSelect.value) &&
      (!q || [u.name, u.companyName, u.email, u.district].some(v => (v || '').toLowerCase().includes(q))));
    drawTable();
  }

  function drawTable() {
    if (!shown.length) { tableHost.replaceChildren(emptyState('search', 'No users match.')); return; }
    tableHost.replaceChildren(el('div', { class: 'table-wrap' }, el('table', {}, [
      el('thead', {}, el('tr', {}, ['User', 'Role', 'Company', 'Email', 'District', 'Joined'].map(h => el('th', {}, h)))),
      el('tbody', {}, shown.map(u => el('tr', {}, [
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
    ])));
  }

  const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  exportBtn.addEventListener('click', () => {
    const rows = [['Name', 'Role', 'Company', 'Email', 'Phone', 'District', 'Joined'],
      ...shown.map(u => [u.name, u.role, u.companyName, u.email, u.phone, u.district, formatDate(u.createdAt)])];
    const blob = new Blob([rows.map(r => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `waste2value-users-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast(`Exported ${shown.length} user${shown.length === 1 ? '' : 's'}.`, 'success');
  });

  search.addEventListener('input', debounce(applyFilters, 200));
  roleSelect.addEventListener('change', applyFilters);
  drawTable();

  container.appendChild(el('div', { class: 'section-head' }, [el('h3', {}, 'Settings')]));
  container.appendChild(el('div', { class: 'card' }, [
    el('p', {}, [
      'Admin access is granted by email, via ',
      el('code', {}, 'src/data/categories.js'),
      ' → ',
      el('code', {}, 'ADMIN_EMAILS'),
      ` (${ADMIN_EMAILS.length} accounts), and mirrored in `,
      el('code', {}, 'firestore.rules'),
      '.'
    ]),
    el('p', { class: 'text-faint mt-8' }, `Signed in as: ${state.firebaseUser?.email} ${isAdminEmail(state.firebaseUser?.email) ? '(admin)' : ''}`)
  ]));
}

function statCard(n, label) {
  return el('div', { class: 'stat-card' }, [counter(n), el('div', { class: 'l' }, label)]);
}
