import { el } from '../utils.js';
import { navigate } from '../router.js';
import { state } from '../state.js';
import { signInWithGoogle, isAdminEmail } from '../auth.js';
import { brandLockup, icon } from '../components/logo.js';

export function renderAdminLogin(container) {
  if (state.firebaseUser && isAdminEmail(state.firebaseUser.email)) { navigate('admin'); return; }

  container.appendChild(el('div', { class: 'auth-screen' }, [
    el('div', { class: 'auth-card' }, [
      el('div', { class: 'brand', onclick: () => navigate('') }, brandLockup()),
      el('div', { class: 'how-ic', style: 'margin:0 auto 14px;' }, icon('shield', 22)),
      el('h1', {}, 'Admin sign in'),
      el('p', {}, 'Restricted to authorized team accounts. Sign in with the Google account you were granted access with.'),
      el('button', { class: 'btn btn-primary btn-block', onclick: () => signInWithGoogle('admin') }, 'Continue with Google'),
      el('p', { class: 'text-faint', style: 'margin:18px 0 0;' }, [
        el('a', { style: 'cursor:pointer;', onclick: () => navigate('') }, '← Back to Waste2Value')
      ])
    ])
  ]));
}
