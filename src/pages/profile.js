import { el, toast, formatDate, initials, counter } from '../utils.js';
import { state } from '../state.js';
import { navigate, renderRoute } from '../router.js';
import { signOutUser, isAdminEmail } from '../auth.js';
import { saveProfile, profileCompleteness } from '../services/profile.js';
import { getUserListings, totalKg } from '../services/listings.js';
import { getIncomingRequests, getOutgoingRequests } from '../services/requests.js';
import { getIncomingTransports } from '../services/transports.js';
import { districtPicker } from '../components/districtPicker.js';
import { MAHARASHTRA_DISTRICTS } from '../data/districts.js';

const VEHICLE_TYPES = ['Mini Truck (Tata Ace / similar)', 'Pickup', 'Truck (6-10 tonne)', 'Trailer (10+ tonne)', 'Tempo / Van'];
const PHONE_RE = /^[+]?[\d][\d\s-]{8,14}$/;
const GSTIN_RE = /^[0-9A-Z]{15}$/;

export async function renderProfile(container) {
  const user = state.firebaseUser;
  const profile = state.userDoc;
  const admin = isAdminEmail(user.email);

  if (!profile && !admin) { navigate('onboarding'); return; }

  const role = profile?.role || (admin ? 'admin' : '');
  const displayName = profile?.name || user.displayName || user.email;

  container.appendChild(el('div', { class: 'page-header' }, [
    el('div', {}, [el('h1', {}, 'My Profile'), el('p', {}, 'How you appear to the people you do deals with.')])
  ]));

  // ---------- header card ----------
  const completeness = profileCompleteness(profile);
  const photo = profile?.photoURL || user.photoURL;
  container.appendChild(el('div', { class: 'card profile-hero' }, [
    photo
      ? el('img', { class: 'profile-avatar', src: photo, alt: displayName, referrerpolicy: 'no-referrer' })
      : el('div', { class: 'profile-avatar profile-avatar-ph' }, initials(displayName)),
    el('div', { class: 'profile-hero-body' }, [
      el('h2', {}, displayName),
      el('div', { class: 'text-faint' }, user.email),
      el('div', { class: 'meta-chips' }, [
        el('span', { class: 'pill pill-matched' }, role),
        admin ? el('span', { class: 'pill pill-reserved' }, 'admin') : null,
        profile?.district ? el('span', { class: 'pill pill-neutral' }, profile.district) : null,
        profile?.createdAt ? el('span', { class: 'pill pill-neutral' }, `Member since ${formatDate(profile.createdAt)}`) : null
      ]),
      profile ? el('div', { class: 'progress-wrap' }, [
        el('div', { class: 'progress-head' }, [
          el('span', {}, 'Profile completeness'), el('strong', {}, `${completeness.percent}%`)
        ]),
        el('div', { class: 'progress' }, el('div', { class: 'progress-fill', style: `width:${completeness.percent}%` })),
        completeness.missing.length
          ? el('div', { class: 'text-faint mt-8' }, `Add: ${completeness.missing.join(', ')}`)
          : el('div', { class: 'text-faint mt-8' }, 'Profile complete — you look great to partners.')
      ]) : null
    ])
  ]));

  // ---------- admin without a business profile ----------
  if (!profile) {
    container.appendChild(el('div', { class: 'card mt-16' }, [
      el('h3', {}, 'Admin account'),
      el('p', {}, 'You’re signed in with an authorized admin Google account. Admin accounts don’t need a business profile.'),
      el('div', { class: 'flex gap-8 wrap' }, [
        el('button', { class: 'btn btn-primary', onclick: () => navigate('admin') }, 'Open Admin Panel'),
        el('button', { class: 'btn btn-outline', onclick: signOutUser }, 'Sign out')
      ])
    ]));
    return;
  }

  // ---------- business details ----------
  const field = (label, node, hint) => el('div', { class: 'field' }, [el('label', {}, label), node, hint ? el('div', { class: 'field-hint' }, hint) : null]);
  const text = (id, value, ph = '', type = 'text') => el('input', { type, id, value: value || '', placeholder: ph });

  const nameIn = text('p-name', profile.name, 'Your name');
  const companyIn = text('p-company', profile.companyName, role === 'logistics' ? 'Transport company / owner' : 'Company / business name');
  const phoneIn = text('p-phone', profile.phone, '10-digit mobile number', 'tel');
  const districtSel = el('select', { id: 'p-district' },
    [el('option', { value: '' }, 'Select district')].concat(MAHARASHTRA_DISTRICTS.map(d => el('option', { value: d, selected: d === profile.district ? true : false }, d))));
  const addressIn = el('textarea', { id: 'p-address', placeholder: 'Plant / yard address — shared only after a deal is accepted', style: 'min-height:70px;' });
  addressIn.value = profile.address || '';
  const aboutIn = el('textarea', { id: 'p-about', maxlength: '280', placeholder: 'What you make, what you recycle, what you move… (280 chars)', style: 'min-height:80px;' });
  aboutIn.value = profile.about || '';
  const gstIn = text('p-gstin', profile.gstin, '15-character GSTIN (optional)');
  const siteIn = text('p-site', profile.website, 'https://… (optional)');
  const aboutCount = el('span', { class: 'field-hint' }, `${aboutIn.value.length}/280`);
  aboutIn.addEventListener('input', () => { aboutCount.textContent = `${aboutIn.value.length}/280`; });

  // logistics-only fields
  let vehicleSel = null, vehicleNoIn = null, capacityIn = null, anyDistrict = null, picker = null;
  const selected = new Set(profile.districts || []);
  if (role === 'logistics') {
    vehicleSel = el('select', { id: 'p-vehicle' },
      [el('option', { value: '' }, 'Select vehicle')].concat(VEHICLE_TYPES.map(v => el('option', { value: v, selected: v === profile.vehicleType ? true : false }, v))));
    vehicleNoIn = text('p-vehicle-no', profile.vehicleNumber, 'e.g. MH 12 AB 1234');
    capacityIn = text('p-capacity', profile.capacityTonnes, 'e.g. 8', 'number');
    capacityIn.min = '0'; capacityIn.step = 'any';
    picker = districtPicker(selected);
    anyDistrict = el('input', { type: 'checkbox', id: 'p-any', checked: profile.servesAll === true ? true : false });
    anyDistrict.addEventListener('change', () => picker.setDisabled(anyDistrict.checked));
    picker.setDisabled(profile.servesAll === true);
  }

  const saveBtn = el('button', { class: 'btn btn-primary' }, 'Save Profile');

  const detailsCard = el('div', { class: 'card' }, [
    el('h3', {}, 'Business details'),
    el('div', { class: 'field-row mt-16' }, [field('Your name', nameIn), field(role === 'logistics' ? 'Company / owner' : 'Company', companyIn)]),
    el('div', { class: 'field-row' }, [field('Phone', phoneIn), field('District', districtSel)]),
    field('Address', addressIn, 'Only revealed to the other party after a deal is accepted.'),
    field('About', aboutIn), aboutCount,
    role === 'industry' ? el('div', { class: 'field-row mt-16' }, [field('GSTIN', gstIn), field('Website', siteIn)]) : null,
    role === 'logistics' ? el('div', { class: 'field-row mt-16' }, [field('GSTIN', gstIn), field('Website', siteIn)]) : null
  ]);

  const cards = [detailsCard];

  if (role === 'logistics') {
    cards.push(el('div', { class: 'card' }, [
      el('h3', {}, 'Vehicle & service area'),
      el('div', { class: 'field-row mt-16' }, [field('Vehicle type', vehicleSel), field('Vehicle number', vehicleNoIn)]),
      field('Capacity (tonnes)', capacityIn),
      el('label', { class: 'switch-row' }, [anyDistrict, el('span', {}, [
        el('strong', {}, 'I operate in any district'),
        el('span', { class: 'text-faint' }, ' — you’ll be suggested for every deal on any route.')
      ])]),
      el('p', { class: 'text-faint mt-16' }, 'Or pick the districts you cover. Buyers and sellers whose deal starts or ends in one of them can request you. Nobody else sees your availability.'),
      picker.element
    ]));
  }

  const form = el('div', { class: 'stack' }, cards);
  form.appendChild(el('div', { class: 'flex gap-8 wrap' }, [saveBtn]));

  // ---------- side column ----------
  const side = el('div', { class: 'stack' });

  const statsHost = el('div', { class: 'card' }, [el('h3', {}, 'Your activity'), el('div', { class: 'stat-row', style: 'margin:12px 0 0;' })]);
  side.appendChild(statsHost);
  side.appendChild(el('div', { class: 'card' }, [
    el('h3', {}, 'Account'),
    el('div', { class: 'kv' }, [el('span', {}, 'Signed in with'), el('strong', {}, 'Google')]),
    el('div', { class: 'kv' }, [el('span', {}, 'Email'), el('strong', {}, user.email)]),
    el('div', { class: 'kv' }, [el('span', {}, 'Role'), el('strong', {}, `${role} (permanent)`)]),
    el('div', { class: 'flex gap-8 wrap mt-16' }, [
      admin ? el('button', { class: 'btn btn-outline btn-sm', onclick: () => navigate('admin') }, 'Admin Panel') : null,
      el('button', { class: 'btn btn-outline btn-sm', onclick: signOutUser }, 'Sign out')
    ])
  ]));

  container.appendChild(el('div', { class: 'profile-grid mt-16' }, [form, side]));

  // ---------- save ----------
  saveBtn.addEventListener('click', async () => {
    const patch = {
      name: nameIn.value.trim(),
      companyName: companyIn.value.trim(),
      phone: phoneIn.value.trim(),
      district: districtSel.value,
      address: addressIn.value.trim(),
      about: aboutIn.value.trim().slice(0, 280),
      gstin: gstIn.value.trim().toUpperCase(),
      website: siteIn.value.trim()
    };
    if (!patch.companyName || !patch.phone || !patch.district) { toast('Company, phone and district are required.', 'error'); return; }
    if (!PHONE_RE.test(patch.phone)) { toast('Enter a valid phone number.', 'error'); return; }
    if (patch.gstin && !GSTIN_RE.test(patch.gstin)) { toast('GSTIN must be 15 letters/digits.', 'error'); return; }
    if (patch.website && !/^https?:\/\//i.test(patch.website)) { toast('Website must start with http:// or https://', 'error'); return; }

    if (role === 'logistics') {
      patch.vehicleType = vehicleSel.value;
      patch.vehicleNumber = vehicleNoIn.value.trim().toUpperCase();
      patch.capacityTonnes = capacityIn.value ? Number(capacityIn.value) : null;
      patch.servesAll = anyDistrict.checked;
      patch.districts = Array.from(selected);
      if (!patch.servesAll && !patch.districts.length) { toast('Pick at least one district, or choose “any district”.', 'error'); return; }
      if (!patch.vehicleType) { toast('Select your vehicle type.', 'error'); return; }
    }

    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
    try {
      await saveProfile(user.uid, patch);
      toast('Profile saved.', 'success');
      renderRoute();
    } catch (err) {
      console.error(err);
      toast(`Could not save${err.code ? ` (${err.code})` : ''}. ${err.code === 'permission-denied' ? 'Publish the latest Firestore rules.' : 'Try again.'}`, 'error');
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Save Profile';
    }
  });

  // ---------- activity snapshot ----------
  try {
    const statRow = statsHost.querySelector('.stat-row');
    const stat = (n, l) => el('div', { class: 'stat-card' }, [counter(n), el('div', { class: 'l' }, l)]);
    if (role === 'industry') {
      const [listings, incoming, outgoing] = await Promise.all([getUserListings(user.uid), getIncomingRequests(user.uid), getOutgoingRequests(user.uid)]);
      const deals = [...incoming, ...outgoing].filter(r => r.status === 'accepted' || r.status === 'completed');
      statRow.append(stat(listings.length, 'Listings'), stat(deals.length, 'Deals'),
        stat(Math.round(listings.filter(l => l.status === 'Matched').reduce((s, l) => s + totalKg(l), 0)), 'kg matched'));
    } else if (role === 'logistics') {
      const jobs = await getIncomingTransports(user.uid);
      statRow.append(stat(jobs.length, 'Requests'), stat(jobs.filter(j => j.status === 'completed').length, 'Delivered'),
        stat(jobs.filter(j => j.status === 'accepted' || j.status === 'in_transit').length, 'Active'));
    } else {
      statsHost.remove();
    }
  } catch (err) {
    console.error(err);
    statsHost.querySelector('.stat-row')?.replaceChildren(el('p', { class: 'text-faint' }, 'Activity unavailable right now.'));
  }
}
