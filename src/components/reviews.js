import { el, toast } from '../utils.js';
import { state } from '../state.js';
import { submitReview } from '../services/reviews.js';

// ★★★★☆ display. `avg` may be fractional.
export function stars(avg, { count = null, size = 14 } = {}) {
  const full = Math.round(avg);
  const wrap = el('span', { class: 'stars', title: avg ? `${avg.toFixed(1)} out of 5` : 'No reviews yet', style: `font-size:${size}px` }, [
    ...[1, 2, 3, 4, 5].map(n => el('span', { class: n <= full ? 'on' : '' }, '★')),
    count !== null ? el('span', { class: 'stars-count' }, count ? `${avg.toFixed(1)} (${count})` : 'New') : null
  ]);
  return wrap;
}

// Modal to leave a 1–5 star review with an optional note.
export function openReviewModal({ request, revieweeId, kind, label, onDone }) {
  let rating = 0;
  const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const starBtns = [1, 2, 3, 4, 5].map(n => el('button', { type: 'button', class: 'star-pick', 'aria-label': `${n} star${n > 1 ? 's' : ''}`, onclick: () => { rating = n; paint(); } }, '★'));
  const paint = () => starBtns.forEach((b, i) => b.classList.toggle('on', i < rating));
  const note = el('textarea', { maxlength: '200', placeholder: 'Optional — how was the experience?' });
  const send = el('button', { class: 'btn btn-primary btn-block' }, 'Submit review');

  overlay.appendChild(el('div', { class: 'modal' }, [
    el('h3', {}, `Rate the ${label}`),
    el('p', { class: 'text-faint' }, `${request.category} · ${request.quantity} ${request.unit} — delivered`),
    el('div', { class: 'star-row' }, starBtns),
    el('div', { class: 'field mt-16' }, [el('label', {}, 'Comment'), note]),
    send
  ]));
  document.body.appendChild(overlay);

  send.addEventListener('click', async () => {
    if (!rating) { toast('Pick a star rating first.', 'error'); return; }
    send.disabled = true; send.textContent = 'Saving…';
    try {
      await submitReview({ request, reviewerId: state.firebaseUser.uid, revieweeId, kind, rating, text: note.value.trim() });
      overlay.remove();
      toast('Thanks — review saved.', 'success');
      onDone?.();
    } catch (err) {
      console.error(err);
      toast(err.code === 'permission-denied' ? 'Not allowed — you may have already reviewed, or the latest rules aren’t published.' : 'Could not save the review.', 'error');
      send.disabled = false; send.textContent = 'Submit review';
    }
  });
}
