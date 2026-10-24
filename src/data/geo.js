// Approximate district headquarters (lat, lng) — used for distance and the route map only.
export const DISTRICT_COORDS = {
  'Mumbai City': [18.94, 72.84], 'Mumbai Suburban': [19.11, 72.87], 'Thane': [19.22, 72.98],
  'Palghar': [19.70, 72.77], 'Raigad': [18.64, 72.87], 'Ratnagiri': [16.99, 73.31],
  'Sindhudurg': [16.0, 73.67], 'Pune': [18.52, 73.86], 'Satara': [17.68, 74.02],
  'Sangli': [16.85, 74.58], 'Kolhapur': [16.7, 74.24], 'Solapur': [17.66, 75.91],
  'Nashik': [20.0, 73.79], 'Dhule': [20.9, 74.77], 'Nandurbar': [21.37, 74.24],
  'Jalgaon': [21.01, 75.56], 'Ahilyanagar (Ahmednagar)': [19.1, 74.75],
  'Chhatrapati Sambhajinagar (Aurangabad)': [19.88, 75.34], 'Jalna': [19.83, 75.88],
  'Beed': [18.99, 75.76], 'Latur': [18.41, 76.56], 'Dharashiv (Osmanabad)': [18.19, 76.04],
  'Nanded': [19.14, 77.32], 'Parbhani': [19.26, 76.77], 'Hingoli': [19.72, 77.15],
  'Akola': [20.7, 77.01], 'Amravati': [20.94, 77.78], 'Buldhana': [20.53, 76.18],
  'Washim': [20.11, 77.13], 'Yavatmal': [20.39, 78.13], 'Nagpur': [21.15, 79.09],
  'Wardha': [20.75, 78.6], 'Chandrapur': [19.96, 79.3], 'Gadchiroli': [20.18, 80.0],
  'Gondia': [21.46, 80.19], 'Bhandara': [21.17, 79.65]
};

const toRad = d => (d * Math.PI) / 180;

// Straight-line distance × 1.25 road factor, in km. Same-district hops count as 20 km.
export function distanceKm(a, b) {
  const A = DISTRICT_COORDS[a], B = DISTRICT_COORDS[b];
  if (!A || !B) return null;
  if (a === b) return 20;
  const dLat = toRad(B[0] - A[0]), dLng = toRad(B[1] - A[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(A[0])) * Math.cos(toRad(B[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371 * Math.asin(Math.sqrt(h)) * 1.25);
}

// Indicative freight estimate by vehicle class. Not a quote — partners price their own jobs.
export function estimateTransport(km, kg) {
  if (km == null) return null;
  const t = (Number(kg) || 0) / 1000;
  const tier = t <= 1.5 ? { vehicle: 'Mini truck', rate: 15 }
    : t <= 7 ? { vehicle: 'Truck (6–10 t)', rate: 26 }
    : t <= 15 ? { vehicle: 'Truck (10–15 t)', rate: 38 }
    : { vehicle: 'Trailer', rate: 52 };
  const mid = Math.max(1500, km * tier.rate);
  const round100 = n => Math.round(n / 100) * 100;
  return { vehicle: tier.vehicle, low: round100(mid * 0.85), high: round100(mid * 1.2) };
}
