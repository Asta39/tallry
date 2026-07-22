# Zeno — Design Direction (reference lock)

Brief: Designing an accounting + light-ERP/CRM web app for Kenyan SMB owners (non-accountants)
on desktop web. Goal: get paid and stay KRA-compliant without learning accounting.
Tone: calm, trustworthy, quietly premium. Main objection: "accounting software is hectic."
Must remember: plain-language money labels with big quiet numerals; jargon on demand.

## Reference lock

- **Primary reference/direction:** Apple HIG desktop apps (macOS System Settings, Numbers,
  Apple Card statement views) — light `#f5f5f7` canvas, SF-adjacent type, hairline
  (0.5px) separators, 12px-radius white cards with barely-there shadows, translucent
  blurred sidebar, tabular numerals for money, restrained single accent.
- **Preserve:** (1) hairline-and-whitespace structure instead of heavy borders/dividers;
  (2) one accent color used only for primary actions and active nav; (3) large quiet
  money numerals (Apple Card style) as the signature dashboard move; (4) low-contrast
  gray secondary text hierarchy (#86868b); (5) no gradients, no decorative illustration.
- **Borrow only:** Linear's sidebar density + keyboard-first "+ New" quick-create;
  Stripe Dashboard's status-pill vocabulary for document states (paid/overdue/draft).
- **Role rules:** accent (#0f766e deep teal) = primary buttons, active nav, links only —
  never backgrounds or headings. Red/amber/green reserved for money semantics
  (overdue/pending/paid), never decoration.
- **Media strategy:** code-native UI only; no imagery. Empty states use SF-Symbol-style
  line icons + one-sentence guidance.
- **Reject:** indigo/violet SaaS defaults, cream/terracotta "calm editorial", card grids
  with heavy shadows, dense Zoho-style toolbar rows, uppercase micro-labels everywhere.

## Decision ledger

| Decision | Source | Role | Why |
|---|---|---|---|
| #f5f5f7 canvas + white cards, 0.5px borders | Apple HIG/macOS | surfaces | calm, reduces perceived complexity vs Zoho's dense chrome |
| SF system font stack, -0.02em tracking on numerals | Apple HIG | type | native-feeling, no webfont cost |
| Deep teal #0f766e single accent | brief (Kenya-forest) + HIG restraint | CTA/nav only | distinct from generic SaaS blue/indigo |
| Big tabular numerals for balances | Apple Card | dashboard signature | the "must remember" move; money legible at a glance |
| Status pills (paid/partial/overdue/draft) | Stripe Dashboard | document lists | scannable state without reading |
| Sidebar: translucent, grouped Sales/Purchases/Money/Reports | macOS System Settings + Linear density | navigation | mirrors mental model (money in / money out), not Zoho's 15 flat modules |
| Plain-language labels, accounting term as subtitle | brief/user research (Zoho complaints) | copy | non-accountant audience |
| Print invoice: black-on-white, no chrome, QR bottom-right | KRA eTIMS requirements | compliance doc | regulator-legible, verifiable |
