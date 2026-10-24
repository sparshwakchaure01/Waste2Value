import { el, initials, formatDate, timeAgo, counter, debounce, toast, confirmDialog, skeletonRows, skeletonStats } from '../utils.js';
import {
  loadAdminData, computeStats, dailySeries, setUserFlag, adminSetListingStatus, adminDeleteListing,
  logAdmin, getAdminLog
} from '../services/admin.js';
import { getAnnouncement, setAnnouncement } from '../services/announcement.js';
import { ADMIN_EMAILS } from '../data/categories.js';
import { isAdminEmail } from '../auth.js';
import { state } from '../state.js';
import { barChart, lineChart } from '../components/charts.js';
import { emptyState } from '../components/emptyState.js';
import { icon } from '../components/logo.js';
import { TRANSPORT_LABEL } from '../services/transports.js';

const TABS = [['overview', 'Overview'], ['users', 'Users'], ['listings', 'Listings'], ['deals', 'Deals & transport'], ['activity', 'Activity log'], ['settings', 'Settings']];
const RANGES = [['7', '7 days', 7], ['30', '30 days', 30], ['90', '90 days', 90], ['all', 'All time', 0]];

const csvCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
const createdMs = x => (x.createdAt?.toMillis ? x.createdAt.toMillis() : 0);

function downloadCsv(name, rows) {
  const blob = new Blob([rows.map(r => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.appendChild(a); a.click(); a.remove();
}

export async function renderAdmin(container) {
  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', {}, 'Admin Panel'), el('p', {}, 'Moderate users and listings, watch the platform, and talk to everyone.')])
  ]));

  const skeleton = el('div', {}, [skeletonStats(4), skeletonRows(2)]);
  container.appendChild(skeleton);
  let data;
  try {
    data = await loadAdminData();
  } catch (err) {
    console.error(err);
    skeleton.remove();
    container.appendChild(emptyState('search', 'Could not load admin data — publish the latest Firestore rules and try again.'));
    return;
  }
  skeleton.remove();

  const users = new Map(data.users.map(u => [u.id, u]));
  const nameOf = (id) => { const u = users.get(id); return u ? (u.companyName || u.name || u.email || id.slice(0, 6)) : (id || '—').slice(0, 6); };
  let tab = 'overview';
  let range = '30';

  const tabBar = el('div', { class: 'admin-tabs' });
  const body = el('div', {});
  container.append(tabBar, body);

  function drawTabs() {
    tabBar.replaceChildren(...TABS.map(([key, label]) => el('button', {
      class: `tab-btn ${tab === key ? 'active' : ''}`,
      onclick: () => { tab = key; drawTabs(); draw(); }
    }, label)));
  }
  const draw = () => ({ overview, users: usersTab, listings: listingsTab, deals: dealsTab, activity: activityTab, settings: settingsTab }[tab])();

  const stat = (n, l) => el('div', { class: 'stat-card' }, [counter(n), el('div', { class: 'l' }, l)]);

  // ================= overview =================
  function overview() {
    const r = RANGES.find(x => x[0] === range);
    const since = r[2] ? Date.now() - r[2] * 86400000 : 0;
    const s = computeStats(data, since);
    const days = r[2] || 90;

    const seg = el('div', { class: 'range-seg' }, RANGES.map(([k, label]) => el('button', { class: range === k ? 'active' : '', onclick: () => { range = k; overview(); } }, label)));
    const statuses = {};
    data.requests.filter(x => !since || createdMs(x) >= since).forEach(x => { statuses[x.status] = (statuses[x.status] || 0) + 1; });
    const districts = {};
    data.listings.filter(x => !since || createdMs(x) >= since).forEach(x => { districts[x.district] = (districts[x.district] || 0) + 1; });
    const topDistricts = Object.entries(districts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const cats = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]);

    body.replaceChildren(
      el('div', { class: 'flex-between wrap', style: 'margin-bottom:16px;' }, [el('h3', { style: 'margin:0;' }, `Platform · ${r[1]}`), seg]),
      el('div', { class: 'stat-row' }, [
        stat(s.totalUsers, 'New users'), stat(s.totalIndustry, 'Industry'), stat(s.totalLogistics, 'Logistics'),
        stat(s.totalListings, 'Listings'), stat(s.totalRequests, 'Requests'), stat(s.totalAccepted, 'Accepted deals'),
        stat(s.totalDelivered, 'Delivered'), stat(s.totalTransports, 'Transport jobs'), stat(s.kgListed, 'kg listed'), stat(s.kgMatched, 'kg in deals')
      ]),
      el('div', { class: 'dash-grid' }, [
        el('div', { class: 'card' }, [el('h3', {}, 'Signups'), lineChart(dailySeries(data.users, days))]),
        el('div', { class: 'card' }, [el('h3', {}, 'Listings created'), lineChart(dailySeries(data.listings, days))])
      ]),
      el('div', { class: 'dash-grid mt-16' }, [
        el('div', { class: 'card' }, [el('h3', {}, 'Listings by resin'), cats.length ? barChart(cats) : emptyState('listings', 'No listings in this range.')]),
        el('div', { class: 'card' }, [el('h3', {}, 'Deals by status'), Object.keys(statuses).length ? barChart(Object.entries(statuses)) : emptyState('requests', 'No requests in this range.')])
      ]),
      el('div', { class: 'card mt-16' }, [el('h3', {}, 'Top districts by listings'), topDistricts.length ? barChart(topDistricts) : emptyState('search', 'Nothing yet.')])
    );
  }

  // ================= users =================
  function usersTab() {
    const search = el('input', { type: 'search', class: 'input', placeholder: 'Search name, company, email, district…', style: 'flex:1;min-width:200px;' });
    const roleSel = el('select', { class: 'input', style: 'width:auto;' }, [['', 'All roles'], ['industry', 'Industry'], ['logistics', 'Logistics']].map(([v, l]) => el('option', { value: v }, l)));
    const flagSel = el('select', { class: 'input', style: 'width:auto;' }, [['', 'Any status'], ['verified', 'Verified'], ['suspended', 'Suspended'], ['unverified', 'Unverified']].map(([v, l]) => el('option', { value: v }, l)));
    const exportBtn = el('button', { class: 'btn btn-outline btn-sm' }, [icon('download', 14), 'Export CSV']);
    const host = el('div', {});
    let shown = [];

    function apply() {
      const q = search.value.trim().toLowerCase();
      shown = data.users.filter(u =>
        (!roleSel.value || u.role === roleSel.value) &&
        (!flagSel.value || (flagSel.value === 'verified' ? u.verified : flagSel.value === 'suspended' ? u.disabled : !u.verified)) &&
        (!q || [u.name, u.companyName, u.email, u.district].some(v => (v || '').toLowerCase().includes(q))));
      paint();
    }

    async function flag(u, patch, verb) {
      if (patch.disabled && isAdminEmail(u.email)) { toast('Admin accounts can’t be suspended.', 'error'); return; }
      if (patch.disabled && !(await confirmDialog({ title: 'Suspend this user?', text: `${u.companyName || u.name || u.email} won’t be able to create listings, requests or reviews until reactivated.`, confirmLabel: 'Suspend', danger: true }))) return;
      try {
        await setUserFlag(u.id, patch);
        Object.assign(u, patch);
        await logAdmin(verb, u.email || u.id, u.companyName || u.name || '');
        toast('Updated.', 'success');
        apply();
      } catch (err) {
        console.error(err);
        toast(`Could not update${err.code ? ` (${err.code})` : ''} — publish the latest rules.`, 'error');
      }
    }

    function paint() {
      if (!shown.length) { host.replaceChildren(emptyState('search', 'No users match.')); return; }
      host.replaceChildren(el('div', { class: 'table-wrap' }, el('table', {}, [
        el('thead', {}, el('tr', {}, ['User', 'Role', 'Company', 'Email', 'District', 'Joined', 'Status', ''].map(h => el('th', {}, h)))),
        el('tbody', {}, shown.map(u => el('tr', {}, [
          el('td', {}, el('div', { class: 'flex gap-8', style: 'align-items:center;' }, [el('div', { class: 'nav-avatar', style: 'width:28px;height:28px;font-size:11px;' }, initials(u.name || '?')), u.name || '—'])),
          el('td', {}, el('span', { class: 'pill pill-neutral' }, u.role || '—')),
          el('td', {}, u.companyName || '—'), el('td', {}, u.email || '—'), el('td', {}, u.district || '—'),
          el('td', {}, formatDate(u.createdAt)),
          el('td', {}, el('div', { class: 'meta-chips', style: 'margin:0;' }, [
            u.verified ? el('span', { class: 'pill pill-verified' }, '✓ verified') : null,
            u.disabled ? el('span', { class: 'pill pill-suspended' }, 'suspended') : null,
            !u.verified && !u.disabled ? el('span', { class: 'text-faint' }, '—') : null
          ])),
          el('td', {}, el('div', { class: 'row-actions' }, [
            el('button', { class: 'btn btn-outline btn-sm', onclick: () => flag(u, { verified: !u.verified }, u.verified ? 'unverify user' : 'verify user') }, u.verified ? 'Unverify' : 'Verify'),
            el('button', { class: `btn btn-sm ${u.disabled ? 'btn-primary' : 'btn-outline'}`, onclick: () => flag(u, { disabled: !u.disabled }, u.disabled ? 'reactivate user' : 'suspend user') }, u.disabled ? 'Reactivate' : 'Suspend')
          ]))
        ])))
      ])));
    }

    exportBtn.addEventListener('click', () => {
      downloadCsv(`waste2value-users-${new Date().toISOString().slice(0, 10)}.csv`,
        [['Name', 'Role', 'Company', 'Email', 'Phone', 'District', 'Verified', 'Suspended', 'Joined'],
          ...shown.map(u => [u.name, u.role, u.companyName, u.email, u.phone, u.district, u.verified ? 'yes' : '', u.disabled ? 'yes' : '', formatDate(u.createdAt)])]);
      toast(`Exported ${shown.length} user${shown.length === 1 ? '' : 's'}.`, 'success');
    });
    search.addEventListener('input', debounce(apply, 200));
    roleSel.addEventListener('change', apply); flagSel.addEventListener('change', apply);
    body.replaceChildren(el('div', { class: 'district-tools' }, [search, roleSel, flagSel, exportBtn]), host);
    apply();
  }

  // ================= listings =================
  function listingsTab() {
    const search = el('input', { type: 'search', class: 'input', placeholder: 'Search resin, district, owner…', style: 'flex:1;min-width:200px;' });
    const statusSel = el('select', { class: 'input', style: 'width:auto;' }, ['', 'Available', 'Reserved', 'Matched', 'Unavailable'].map(v => el('option', { value: v }, v || 'Any status')));
    const host = el('div', {});
    let shown = [];

    function apply() {
      const q = search.value.trim().toLowerCase();
      shown = data.listings.filter(l =>
        (!statusSel.value || l.status === statusSel.value) &&
        (!q || `${l.category} ${l.district} ${nameOf(l.ownerId)}`.toLowerCase().includes(q))).sort((a, b) => createdMs(b) - createdMs(a));
      paint();
    }

    async function setStatus(l, status) {
      try {
        await adminSetListingStatus(l.id, status);
        l.status = status;
        await logAdmin(status === 'Unavailable' ? 'hide listing' : 'restore listing', `${l.category} ${l.quantity} ${l.unit}`, nameOf(l.ownerId));
        toast('Listing updated.', 'success'); apply();
      } catch (err) { console.error(err); toast(`Could not update${err.code ? ` (${err.code})` : ''} — publish the latest rules.`, 'error'); }
    }
    async function remove(l) {
      if (!(await confirmDialog({ title: 'Delete this listing?', text: `${l.category} · ${l.quantity} ${l.unit} by ${nameOf(l.ownerId)} will be permanently removed.`, confirmLabel: 'Delete', danger: true }))) return;
      try {
        await adminDeleteListing(l.id);
        data.listings = data.listings.filter(x => x.id !== l.id);
        await logAdmin('delete listing', `${l.category} ${l.quantity} ${l.unit}`, nameOf(l.ownerId));
        toast('Listing deleted.', 'success'); apply();
      } catch (err) { console.error(err); toast(`Could not delete${err.code ? ` (${err.code})` : ''}.`, 'error'); }
    }

    function paint() {
      if (!shown.length) { host.replaceChildren(emptyState('listings', 'No listings match.')); return; }
      host.replaceChildren(el('div', { class: 'table-wrap' }, el('table', {}, [
        el('thead', {}, el('tr', {}, ['Material', 'Qty', '₹/kg', 'District', 'Owner', 'Status', 'Listed', ''].map(h => el('th', {}, h)))),
        el('tbody', {}, shown.map(l => el('tr', {}, [
          el('td', {}, `${l.category} · Grade ${l.grade}`), el('td', {}, `${l.quantity} ${l.unit}`), el('td', {}, `₹${l.costPerKg}`),
          el('td', {}, l.district), el('td', {}, nameOf(l.ownerId)),
          el('td', {}, el('span', { class: `pill pill-${(l.status || '').toLowerCase()}` }, l.status)),
          el('td', {}, timeAgo(l.createdAt)),
          el('td', {}, el('div', { class: 'row-actions' }, [
            l.status === 'Unavailable'
              ? el('button', { class: 'btn btn-outline btn-sm', onclick: () => setStatus(l, 'Available') }, 'Restore')
              : el('button', { class: 'btn btn-outline btn-sm', onclick: () => setStatus(l, 'Unavailable') }, 'Hide'),
            el('button', { class: 'btn btn-outline btn-sm', onclick: () => remove(l) }, [icon('trash', 13), 'Delete'])
          ]))
        ])))
      ])));
    }
    search.addEventListener('input', debounce(apply, 200)); statusSel.addEventListener('change', apply);
    body.replaceChildren(el('div', { class: 'district-tools' }, [search, statusSel]), host);
    apply();
  }

  // ================= deals & transport =================
  let dealView = 'deals';
  function dealsTab() {
    const toggle = el('div', { class: 'range-seg' }, [['deals', 'Deals'], ['transports', 'Transport jobs']].map(([k, l]) => el('button', { class: dealView === k ? 'active' : '', onclick: () => { dealView = k; dealsTab(); } }, l)));
    const search = el('input', { type: 'search', class: 'input', placeholder: 'Search resin, district, company…', style: 'flex:1;min-width:200px;' });
    const statuses = dealView === 'deals' ? ['', 'pending', 'discussing', 'accepted', 'completed', 'declined'] : ['', 'pending', 'accepted', 'in_transit', 'completed', 'declined'];
    const statusSel = el('select', { class: 'input', style: 'width:auto;' }, statuses.map(v => el('option', { value: v }, v ? (TRANSPORT_LABEL[v] || v) : 'Any status')));
    const exportBtn = el('button', { class: 'btn btn-outline btn-sm' }, [icon('download', 14), 'Export CSV']);
    const host = el('div', {});
    let shown = [];

    function apply() {
      const q = search.value.trim().toLowerCase();
      const src = dealView === 'deals' ? data.requests : data.transports;
      shown = src.filter(x => (!statusSel.value || x.status === statusSel.value) &&
        (!q || `${x.category} ${x.district || ''} ${x.fromDistrict || ''} ${x.toDistrict || ''} ${nameOf(x.sellerId)} ${nameOf(x.buyerId)} ${nameOf(x.logisticsId)}`.toLowerCase().includes(q)))
        .sort((a, b) => createdMs(b) - createdMs(a));
      paint();
    }

    function paint() {
      if (!shown.length) { host.replaceChildren(emptyState('requests', 'Nothing matches.')); return; }
      const head = dealView === 'deals'
        ? ['Material', 'Qty', 'District', 'Seller', 'Buyer', 'Terms', 'Status', 'Partner', 'Created']
        : ['Material', 'Qty', 'Route', 'Partner', 'Requested by', 'Status', 'Created'];
      const row = x => dealView === 'deals'
        ? [x.category, `${x.quantity} ${x.unit}`, x.district, nameOf(x.sellerId), nameOf(x.buyerId),
            x.counter?.status === 'accepted' ? `₹${x.counter.price} (counter)` : x.offerPrice ? `₹${x.offerPrice} (offer)` : `₹${x.costPerKg}`,
            x.status, x.logisticsId ? nameOf(x.logisticsId) : '—', timeAgo(x.createdAt)]
        : [x.category, `${x.quantity} ${x.unit}`, `${x.fromDistrict} → ${x.toDistrict}`, nameOf(x.logisticsId), nameOf(x.requesterId), TRANSPORT_LABEL[x.status] || x.status, timeAgo(x.createdAt)];
      host.replaceChildren(el('div', { class: 'table-wrap' }, el('table', {}, [
        el('thead', {}, el('tr', {}, head.map(h => el('th', {}, h)))),
        el('tbody', {}, shown.map(x => el('tr', {}, row(x).map((c, i) => el('td', {}, (head[i] === 'Status') ? el('span', { class: 'pill pill-neutral' }, c) : c)))))
      ])));
    }

    exportBtn.addEventListener('click', () => {
      const head = dealView === 'deals' ? ['Material', 'Qty', 'District', 'Seller', 'Buyer', 'Status', 'Created'] : ['Material', 'Qty', 'From', 'To', 'Partner', 'Status', 'Created'];
      const rows = shown.map(x => dealView === 'deals'
        ? [x.category, `${x.quantity} ${x.unit}`, x.district, nameOf(x.sellerId), nameOf(x.buyerId), x.status, formatDate(x.createdAt)]
        : [x.category, `${x.quantity} ${x.unit}`, x.fromDistrict, x.toDistrict, nameOf(x.logisticsId), x.status, formatDate(x.createdAt)]);
      downloadCsv(`waste2value-${dealView}-${new Date().toISOString().slice(0, 10)}.csv`, [head, ...rows]);
      toast(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'}.`, 'success');
    });
    search.addEventListener('input', debounce(apply, 200)); statusSel.addEventListener('change', apply);
    body.replaceChildren(el('div', { class: 'flex-between wrap', style: 'margin-bottom:14px;' }, [toggle, el('span', { class: 'text-faint' }, `${(dealView === 'deals' ? data.requests : data.transports).length} total`)]),
      el('div', { class: 'district-tools' }, [search, statusSel, exportBtn]), host);
    apply();
  }

  // ================= activity log =================
  async function activityTab() {
    body.replaceChildren(skeletonRows(3));
    let log;
    try { log = await getAdminLog(100); } catch (err) {
      console.error(err);
      body.replaceChildren(emptyState('search', 'Could not load the log — publish the latest Firestore rules.'));
      return;
    }
    if (!log.length) { body.replaceChildren(emptyState('requests', 'No admin actions recorded yet. Verify, suspend, hide or delete something and it appears here.')); return; }
    body.replaceChildren(el('div', { class: 'table-wrap' }, el('table', {}, [
      el('thead', {}, el('tr', {}, ['When', 'Admin', 'Action', 'Target', 'Detail'].map(h => el('th', {}, h)))),
      el('tbody', {}, log.map(e => el('tr', {}, [el('td', {}, timeAgo(e.at)), el('td', {}, e.adminEmail), el('td', {}, el('span', { class: 'pill pill-neutral' }, e.action)), el('td', {}, e.target), el('td', {}, e.detail || '—')])))
    ])));
  }

  // ================= settings (announcement) =================
  async function settingsTab() {
    body.replaceChildren(skeletonRows(2));
    const current = (await getAnnouncement(true)) || { text: '', tone: 'info', active: false };
    const text = el('textarea', { maxlength: '240', placeholder: 'e.g. Scheduled maintenance Sunday 2–4 AM. New: transport partners can now set pickup dates.', style: 'min-height:80px;' });
    text.value = current.text || '';
    const tone = el('select', {}, [['info', 'Info (emerald)'], ['warn', 'Notice (brass)'], ['alert', 'Alert (red)']].map(([v, l]) => el('option', { value: v, selected: current.tone === v ? true : false }, l)));
    const active = el('input', { type: 'checkbox', checked: current.active ? true : false });
    const preview = el('div', {});
    const drawPreview = () => preview.replaceChildren(text.value.trim() ? el('div', { class: `announce ${tone.value === 'info' ? '' : tone.value}`, style: 'border-radius:12px;border:1px solid var(--line);' }, [el('span', {}, text.value.trim())]) : el('p', { class: 'text-faint' }, 'Preview appears here.'));
    text.addEventListener('input', drawPreview); tone.addEventListener('change', drawPreview); drawPreview();
    const save = el('button', { class: 'btn btn-primary' }, 'Publish announcement');
    save.addEventListener('click', async () => {
      save.disabled = true; save.textContent = 'Saving…';
      try {
        await setAnnouncement({ text: text.value.trim(), tone: tone.value, active: active.checked && !!text.value.trim() });
        await logAdmin(active.checked ? 'publish announcement' : 'clear announcement', text.value.trim().slice(0, 60));
        toast(active.checked ? 'Announcement is live for everyone.' : 'Announcement saved (hidden).', 'success');
      } catch (err) { console.error(err); toast(`Could not save${err.code ? ` (${err.code})` : ''} — publish the latest rules.`, 'error'); }
      finally { save.disabled = false; save.textContent = 'Publish announcement'; }
    });

    body.replaceChildren(
      el('div', { class: 'card form-card' }, [
        el('h3', {}, 'Platform announcement'),
        el('p', {}, 'Shows as a banner at the top of every page for all signed-in users, until they dismiss it.'),
        el('div', { class: 'field mt-16' }, [el('label', {}, 'Message'), text]),
        el('div', { class: 'field' }, [el('label', {}, 'Style'), tone]),
        el('label', { class: 'switch-row', style: 'margin-bottom:16px;' }, [active, el('span', {}, [el('strong', {}, 'Show to users'), el('span', { class: 'text-faint' }, ' — untick to hide without deleting')])]),
        el('div', { class: 'field' }, [el('label', {}, 'Preview'), preview]),
        save
      ]),
      el('div', { class: 'card form-card mt-16' }, [
        el('h3', {}, 'Admin access'),
        el('p', {}, [`${ADMIN_EMAILS.length} Google accounts are admins (set in `, el('code', {}, 'src/data/categories.js'), ' and mirrored in ', el('code', {}, 'firestore.rules'), ').']),
        el('div', { class: 'meta-chips' }, ADMIN_EMAILS.map(e => el('span', { class: 'pill pill-neutral' }, e))),
        el('p', { class: 'text-faint mt-8' }, `Signed in as ${state.firebaseUser?.email}`)
      ])
    );
  }

  drawTabs();
  draw();
}
