import { el, timeAgo, skeletonRows } from '../utils.js';
import { state } from '../state.js';
import { navigate, renderRoute } from '../router.js';
import { getInsights, buildNotifications, unreadCount } from '../services/insights.js';
import { saveProfile } from '../services/profile.js';
import { emptyState } from '../components/emptyState.js';
import { icon } from '../components/logo.js';
import { refreshBell } from '../components/nav.js';

const ICON = { ok: 'check', hot: 'bell', warn: 'spark' };

export async function renderNotifications(container) {
  const header = el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', {}, 'Notifications'), el('p', {}, 'Requests, counter-offers, transport updates and saved-search matches.')])
  ]);
  container.appendChild(header);
  const host = el('div', {});
  container.appendChild(host);
  host.appendChild(skeletonRows(3));

  let events;
  try {
    events = buildNotifications(await getInsights(true));
  } catch (err) {
    console.error(err);
    host.replaceChildren(emptyState('requests', 'Could not load notifications — check your connection.'));
    return;
  }

  const seenAt = state.userDoc?.notifSeenAt || 0;
  const unread = unreadCount(events, seenAt);

  const markRead = async () => {
    try { await saveProfile(state.firebaseUser.uid, { notifSeenAt: Date.now() }); } catch { /* non-critical */ }
    refreshBell();
  };

  if (unread) {
    header.appendChild(el('button', { class: 'btn btn-outline btn-sm', onclick: async () => { await markRead(); renderRoute(); } }, `Mark ${unread} as read`));
  }

  if (!events.length) {
    host.replaceChildren(emptyState('requests', 'You’re all caught up. New activity shows up here.'));
    return;
  }

  host.replaceChildren(el('div', { class: 'card list-card' }, events.map(e => el('div', {
    class: `notif ${e.ts > seenAt ? 'unread' : ''}`,
    onclick: () => e.path && navigate(e.path)
  }, [
    el('span', { class: `notif-ic ${e.tone}` }, icon(ICON[e.tone] || 'bell', 18)),
    el('div', { class: 'notif-body' }, [el('strong', {}, e.title), el('span', {}, e.text)]),
    el('span', { class: 'notif-time' }, timeAgo(e.ts))
  ]))));

  // Opening the page counts as reading — but leave the unread dots visible for this visit.
  setTimeout(markRead, 1500);
}
