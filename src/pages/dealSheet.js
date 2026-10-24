import { el, formatINR, formatDate, skeletonRows } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { getRequestById, dealTerms } from '../services/requests.js';
import { getListingById } from '../services/listings.js';
import { getTransportsForUser } from '../services/transports.js';
import { fetchUserDoc } from '../auth.js';
import { distanceKm, estimateTransport } from '../data/geo.js';
import { emptyState } from '../components/emptyState.js';
import { brandLockup, icon } from '../components/logo.js';
import { routeMap } from '../components/routeMap.js';

const kvRow = (k, v) => el('div', { class: 'kv' }, [el('span', {}, k), el('strong', {}, v || '—')]);

function party(title, u) {
  return el('div', {}, [
    el('h4', {}, title),
    kvRow('Company', u?.companyName || u?.name),
    kvRow('Contact', u?.name),
    kvRow('Phone', u?.phone),
    kvRow('Email', u?.email),
    kvRow('District', u?.district),
    kvRow('Address', u?.address),
    u?.gstin ? kvRow('GSTIN', u.gstin) : null
  ]);
}

// Printable deal summary for an accepted / delivered deal. Both parties can open it; Print → Save as PDF.
export async function renderDealSheet(container, params) {
  const skeleton = skeletonRows(3);
  container.appendChild(skeleton);
  let r;
  try { r = await getRequestById(params.id); } catch (err) { console.error(err); }
  skeleton.remove();

  const uid = state.firebaseUser.uid;
  if (!r || (r.sellerId !== uid && r.buyerId !== uid)) { container.appendChild(emptyState('search', 'Deal not found.')); return; }
  if (r.status !== 'accepted' && r.status !== 'completed') {
    container.appendChild(emptyState('requests', 'The deal sheet is available once a request is accepted.',
      el('button', { class: 'btn btn-primary', onclick: () => navigate('matches') }, 'Back to matches')));
    return;
  }

  const [seller, buyer, listing, transports] = await Promise.all([
    fetchUserDoc(r.sellerId), fetchUserDoc(r.buyerId), getListingById(r.listingId).catch(() => null), getTransportsForUser(uid).catch(() => [])
  ]);
  const terms = dealTerms(r);
  const total = Number(terms.price) * Number(terms.qty) * (r.unit === 'tonnes' ? 1000 : 1);
  const t = transports.find(x => x.requestId === r.id && ['accepted', 'in_transit', 'completed'].includes(x.status));
  const partner = t ? await fetchUserDoc(t.logisticsId) : null;
  const km = distanceKm(r.district, buyer?.district);
  const kg = Number(terms.qty) * (r.unit === 'tonnes' ? 1000 : 1);
  const est = estimateTransport(km, kg);

  container.appendChild(el('div', { class: 'page-header no-print' }, [
    el('div', {}, [el('h1', {}, 'Deal sheet'), el('p', {}, 'A summary both sides can keep. Use Print → Save as PDF.')]),
    el('div', { class: 'flex gap-8 wrap' }, [
      el('button', { class: 'btn btn-outline', onclick: () => navigate('matches') }, 'Back'),
      el('button', { class: 'btn btn-primary', onclick: () => window.print() }, [icon('filetext', 16), 'Print / Save PDF'])
    ])
  ]));

  const sheet = el('div', { class: 'sheet' }, [
    el('div', { class: 'sheet-head' }, [
      el('div', {}, [el('div', { class: 'brand', style: 'color:var(--navy);margin-bottom:10px;' }, brandLockup()), el('h1', {}, 'Deal sheet')]),
      el('div', { class: 'sheet-ref' }, [
        el('div', {}, `Ref: ${r.id.slice(0, 10).toUpperCase()}`),
        el('div', {}, `Accepted: ${formatDate(r.updatedAt || r.createdAt)}`),
        el('div', {}, `Status: ${r.status === 'completed' ? 'Delivered' : 'Accepted'}`)
      ])
    ]),

    el('h4', {}, 'Material'),
    el('div', { class: 'table-wrap' }, el('table', { class: 'sheet-table' }, [
      el('thead', {}, el('tr', {}, ['Resin', 'Grade', 'Quantity', 'Price / kg', 'Pickup district'].map(h => el('th', {}, h)))),
      el('tbody', {}, el('tr', {}, [
        el('td', {}, r.category), el('td', {}, listing ? `Grade ${listing.grade}` : '—'),
        el('td', {}, `${terms.qty} ${r.unit}`), el('td', {}, `₹${terms.price}`), el('td', {}, r.district)
      ]))
    ])),
    el('div', { class: 'sheet-total' }, [el('span', {}, `Agreed terms (${terms.source})`), el('div', {}, ['Estimated value ', el('strong', {}, formatINR(total))])]),

    el('div', { class: 'sheet-cols' }, [party('Seller', seller), party('Buyer', buyer)]),

    el('h4', {}, 'Transport'),
    partner
      ? el('div', { class: 'sheet-cols' }, [
          el('div', {}, [
            kvRow('Partner', partner.companyName || partner.name), kvRow('Phone', partner.phone), kvRow('Vehicle', [partner.vehicleType, partner.vehicleNumber].filter(Boolean).join(' · ')),
            kvRow('Status', t.status === 'completed' ? 'Delivered' : t.status === 'in_transit' ? 'In transit' : 'Confirmed'),
            t.pickupDate ? kvRow('Pickup by', t.pickupDate) : null
          ]),
          el('div', {}, [kvRow('Route', `${t.fromDistrict} → ${t.toDistrict}`), km != null ? kvRow('Distance', `≈ ${km} km`) : null])
        ])
      : el('p', { class: 'text-faint' }, 'No transport partner has been confirmed yet.'),
    km != null && buyer?.district ? el('div', { class: 'no-print' }, routeMap(r.district, buyer.district, { kg, compact: true })) : null,
    est ? el('p', { class: 'text-faint mt-8' }, `Indicative freight ${formatINR(est.low)} – ${formatINR(est.high)} (${est.vehicle}). Partners set their own price.`) : null,

    el('div', { class: 'sign-row' }, [el('div', {}, `Seller — ${seller?.companyName || ''}`), el('div', {}, `Buyer — ${buyer?.companyName || ''}`)]),
    el('div', { class: 'sheet-foot' }, 'Generated by Waste2Value. Prices are indicative and this summary is for record-keeping; it is not a legal contract.')
  ]);
  container.appendChild(sheet);
}
