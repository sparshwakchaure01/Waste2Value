export const PLASTIC_CATEGORIES = [
  { code: "PET", label: "PET — Polyethylene Terephthalate" },
  { code: "HDPE", label: "HDPE — High-Density Polyethylene" },
  { code: "PVC", label: "PVC — Polyvinyl Chloride" },
  { code: "LDPE", label: "LDPE — Low-Density Polyethylene" },
  { code: "PP", label: "PP — Polypropylene" },
  { code: "PS", label: "PS — Polystyrene" },
  { code: "ABS", label: "ABS — Acrylonitrile Butadiene Styrene" },
  { code: "PA", label: "PA — Polyamide (Nylon)" },
  { code: "OTHER", label: "Other Engineering Plastic" }
];

export const GRADES = [
  { code: "A", label: "Grade A — High purity / consistent" },
  { code: "B", label: "Grade B — Mixed / moderate purity" },
  { code: "C", label: "Grade C — Low purity / contaminated" }
];

export const FREQUENCIES = ["One-time", "Daily", "Weekly", "Monthly"];

export const LISTING_STATUSES = ["Available", "Reserved", "Matched", "Unavailable"];

export const UNITS = ["kg", "tonnes"];

// Admin emails — these Google accounts see the Admin link in the nav.
// Keep in sync with isAdmin() in firestore.rules.
export const ADMIN_EMAILS = [
  "wakchauresparsh77@gmail.com",
  "yashhande9529@gmail.com",
  "mahalechetan648@gmail.com",
  "ndfirodiya@gmail.com",
];
