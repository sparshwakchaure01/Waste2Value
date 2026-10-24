import { el, toast, timeAgo, skeletonRows, confirmDialog } from '../utils.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import {
  getIncomingTransports, acceptTransport, declineTransport, markInTransit, markDelivered,
  transportRevealLevel, TRANSPORT_LABEL
} from '../services/transports.js';
import { fetchUserDoc } from '../auth.js';
import { renderRevealCard } from '../components/blindReveal.js';
import { emptyState } from '../components/emptyState.js';
import { routeLine, transportStepper } from '../components/route.js';

const pillFor = s => (s === 'pending' ? 'reserved' : s === 'declined' ? 'declined' : s === 'completed' ? 'neutral' : 'matched');

// A logistics partner only ever sees transport requests addressed to them by the buyer or
// seller of an accepted deal — never the marketplace, never other partners' jobs.
export async function renderLogistics(container) {
  const me = state.userDoc;
  const covers = me.servesAll ? 'any district' : `${(me.districts || []).length} district${(me.districts || []).length === 1 ? '' : 's'}`;

  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', {}, 'Transport Jobs'), el('p', {}, 'Requests sent to you by buyers and sellers of confirmed deals.')]),
    el('button', { class: 'btn btn-outline', onclick: () => navigate('profile') }, `Service area: ${covers}`)
  ]));

  if (!me.servesAll && !(me.districts || []).length) {
    container.appendChild(el('div', { class: 'card' }, [
      el('h3', {}, 'Set your service area first'),
      el('p', {}, 'Buyers and sellers can only find you once you add the districts you cover (or tick “any district”).'),
      el('button', { class: 'btn btn-primary', onclick: () => navigate('profile') }, 'Open My Profile')
    ]));
  }

  const body = el('div', {});
  container.appendChild(body);

  function heading(text, note) {
    return el('div', { class: 'section-head' }, [el('h3', {}, text), note ? el('span', { class: 'text-faint' }, note) : null]);
  }

  async function jobCard(t) {
    const unlocked = transportRevealLevel(t.status) !== 'none';
    const requestedBy = t.requesterId === t.sellerId ? 'seller' : 'buyer';
    const meta = el('div', { class: 'meta-chips' }, [
      el('span', { class: 'pill pill-neutral' }, `Requested by ${requestedBy}`),
      t.pickupDate ? el('span', { class: 'pill pill-reserved' }, `Pickup by ${t.pickupDate}`) : null
    ]);

    const card = el('div', { class: 'request-card' }, [
      el('div', { class: 'flex-between' }, [
        el('div', {}, [
          el('strong', {}, `${t.category} · ${t.quantity} ${t.unit}`),
          el('div', { class: 'text-faint' }, timeAgo(t.createdAt))
        ]),
        el('span', { class: `pill pill-${pillFor(t.status)}` }, TRANSPORT_LABEL[t.status] || t.status)
      ]),
      routeLine(t.fromDistrict, t.toDistrict),
      meta,
      t.note ? el('p', { class: 'mt-16', style: 'font-style:italic;' }, `“${t.note}”`) : null
    ]);

    if (t.status !== 'declined') card.appendChild(transportStepper(t.status));

    if (!unlocked) {
      card.appendChild(renderRevealCard('none', null, 'Seller & buyer'));
    } else {
      const [seller, buyer] = await Promise.all([fetchUserDoc(t.sellerId), fetchUserDoc(t.buyerId)]);
      card.appendChild(el('div', { class: 'two-col' }, [
        el('div', {}, [el('div', { class: 'reveal-title' }, 'Pickup — seller'), renderRevealCard('full', seller, 'Seller')]),
        el('div', {}, [el('div', { class: 'reveal-title' }, 'Drop — buyer'), renderRevealCard('full', buyer, 'Buyer')])
      ]));
    }

    const actions = [];
    const run = (btns, fn, msg) => async () => {
      btns.forEach(b => { b.disabled = true; });
      try {
        await fn();
        toast(msg, 'success');
        draw();
      } catch (err) {
        console.error(err);
        const taken = err.code === 'permission-denied';
        toast(taken ? 'Not allowed — this deal may already have a partner, or the latest rules aren’t published.' : `Could not update${err.code ? ` (${err.code})` : ''}.`, 'error');
        btns.forEach(b => { b.disabled = false; });
      }
    };

    if (t.status === 'pending') {
      const decline = el('button', { class: 'btn btn-outline btn-sm' }, 'Decline');
      const accept = el('button', { class: 'btn btn-primary btn-sm' }, 'Accept job');
      decline.addEventListener('click', async () => {
        if (!(await confirmDialog({ title: 'Decline this job?', text: 'The requester will see that you declined and can pick another partner.', confirmLabel: 'Decline', danger: true }))) return;
        run([decline, accept], () => declineTransport(t.id), 'Request declined.')();
      });
      accept.addEventListener('click', run([decline, accept], () => acceptTransport(t), 'Job accepted — contacts unlocked.'));
      actions.push(decline, accept);
    } else if (t.status === 'accepted') {
      const btn = el('button', { class: 'btn btn-primary btn-sm' }, 'Mark picked up');
      btn.addEventListener('click', run([btn], () => markInTransit(t.id), 'Marked as picked up — in transit.'));
      actions.push(btn);
    } else if (t.status === 'in_transit') {
      const btn = el('button', { class: 'btn btn-primary btn-sm' }, 'Mark delivered');
      btn.addEventListener('click', run([btn], () => markDelivered(t), 'Delivered — deal completed.'));
      actions.push(btn);
    }
    if (actions.length) card.appendChild(el('div', { class: 'flex gap-12 mt-16 wrap' }, actions));
    return card;
  }

  async function draw() {
    body.replaceChildren(skeletonRows(2));
    let jobs;
    try {
      jobs = await getIncomingTransports(state.firebaseUser.uid);
    } catch (err) {
      console.error(err);
      body.replaceChildren(emptyState('deals', 'Could not load your jobs — check your connection and Firestore rules.'));
      return;
    }

    const pending = jobs.filter(t => t.status === 'pending');
    const active = jobs.filter(t => t.status === 'accepted' || t.status === 'in_transit');
    const done = jobs.filter(t => t.status === 'completed');
    const declined = jobs.filter(t => t.status === 'declined');

    const out = [];
    out.push(heading('New requests', `${pending.length} waiting`));
    if (!pending.length) out.push(emptyState('partners', 'No new requests. When a buyer or seller picks you for a deal, it shows up here.'));
    for (const t of pending) out.push(await jobCard(t));

    out.push(heading('Active jobs', `${active.length}`));
    if (!active.length) out.push(emptyState('deals', 'Accepted jobs appear here with both parties’ contact details.'));
    for (const t of active) out.push(await jobCard(t));

    if (done.length) {
      out.push(heading('Delivered', `${done.length}`));
      for (const t of done) out.push(await jobCard(t));
    }
    if (declined.length) {
      out.push(heading('Declined', `${declined.length}`));
      for (const t of declined) out.push(await jobCard(t));
    }
    body.replaceChildren(...out);
  }

  await draw();
}
