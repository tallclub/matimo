// Google Analytics 4. Renders nothing unless a measurement ID (G-XXXXXXXXXX) is set at build time:
//   PUBLIC_GA_ID=G-XXXXXXXXXX pnpm build
// In CI it comes from the repository variable GA_MEASUREMENT_ID (see .github/workflows/website.yml).
//
// Consent: analytics storage is denied by default for visitors in the EEA, the UK and Switzerland, so GA
// runs without cookies there. There is no consent banner yet; once one exists it should call
//   gtag('consent', 'update', { analytics_storage: 'granted' })
// A browser that sends Do Not Track is not measured at all.
const REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH',
];

export function gaId(raw) {
  return /^G-[A-Z0-9]{6,}$/.test(raw ?? '') ? raw : '';
}

export function gaInline(id) {
  return `if (navigator.doNotTrack !== '1' && window.doNotTrack !== '1') {
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('consent', 'default', { analytics_storage: 'denied', region: ${JSON.stringify(REGIONS)} });
  gtag('js', new Date());
  gtag('config', '${id}');
}`;
}

// Entries for Starlight's `head` option. Empty when no ID is set.
export function gaHead(raw) {
  const id = gaId(raw);
  if (!id) return [];
  return [
    { tag: 'script', attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${id}` } },
    { tag: 'script', content: gaInline(id) },
  ];
}
