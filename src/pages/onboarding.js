import { el, toast } from '../utils.js';
import { state, setState } from '../state.js';
import { createUserProfile } from '../auth.js';
import { navigate } from '../router.js';
import { icon } from '../components/logo.js';
import { MAHARASHTRA_DISTRICTS } from '../data/districts.js';

export function renderOnboarding(container) {
  let selectedRole = null;

  function draw() {
    container.innerHTML = '';
    const wrap = el('div', { class: 'container', style: 'max-width:640px;padding-top:60px;' });

    wrap.appendChild(el('div', { class: 'hero-eyebrow' }, 'Create your account'));
    wrap.appendChild(el('h1', { style: 'font-size:28px;' }, `Welcome, ${state.firebaseUser?.displayName?.split(' ')[0] || 'there'}.`));
    wrap.appendChild(el('p', {}, 'Choose how you’ll use Waste2Value. You’ll sign in with the same Google account next time.'));

    if (!selectedRole) {
      const grid = el('div', { class: 'role-pick-grid', style: 'margin-top:28px;' }, [
        el('div', { class: 'role-pick-card', onclick: () => { selectedRole = 'industry'; draw(); } }, [
          el('div', { class: 'ic' }, icon('factory', 30)),
          el('h3', {}, 'Industry'),
          el('p', {}, 'Buy or sell plastic scrap and by-products.')
        ]),
        el('div', { class: 'role-pick-card', onclick: () => { selectedRole = 'logistics'; draw(); } }, [
          el('div', { class: 'ic' }, icon('truck', 30)),
          el('h3', {}, 'Logistics'),
          el('p', {}, 'List your vehicle and pick up completed deals.')
        ])
      ]);
      wrap.appendChild(grid);
    } else {
      const form = el('form', { class: 'card mt-24' });
      const districtOptions = [el('option', { value: '' }, 'Select district')]
        .concat(MAHARASHTRA_DISTRICTS.map(d => el('option', { value: d }, d)));

      form.append(
        el('div', { class: 'pill pill-neutral mt-8', style: 'margin-bottom:18px;' }, `Role: ${selectedRole}`),
        el('div', { class: 'field' }, [
          el('label', {}, 'Company / Business Name'),
          el('input', { type: 'text', id: 'f-company', required: true, placeholder: 'e.g. Deccan Polymers Pvt Ltd' })
        ]),
        el('div', { class: 'field' }, [
          el('label', {}, 'Phone Number'),
          el('input', { type: 'tel', id: 'f-phone', required: true, placeholder: '10-digit mobile number' })
        ]),
        el('div', { class: 'field' }, [
          el('label', {}, selectedRole === 'logistics' ? 'Base District' : 'District'),
          el('select', { id: 'f-district', required: true }, districtOptions)
        ]),
        el('div', { class: 'flex gap-12' }, [
          el('button', { type: 'button', class: 'btn btn-outline', onclick: () => { selectedRole = null; draw(); } }, 'Back'),
          el('button', { type: 'submit', class: 'btn btn-primary btn-block' }, 'Finish setup')
        ])
      );

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const companyName = form.querySelector('#f-company').value.trim();
        const phone = form.querySelector('#f-phone').value.trim();
        const district = form.querySelector('#f-district').value;
        if (!companyName || !phone || !district) { toast('Please fill in every field.', 'error'); return; }

        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true; btn.textContent = 'Setting up…';

        const userDoc = await createUserProfile(state.firebaseUser.uid, {
          role: selectedRole,
          companyName, phone, district,
          email: state.firebaseUser.email,
          name: state.firebaseUser.displayName,
          photoURL: state.firebaseUser.photoURL
        });
        setState({ userDoc });
        toast('Profile created — welcome aboard!', 'success');
        navigate('dashboard');
      });

      wrap.appendChild(form);
    }
    container.appendChild(wrap);
  }

  draw();
}
