// Google Analytics 4, opt-in only. Renders nothing unless a measurement ID (G-XXXXXXXXXX) is set at build time:
//   PUBLIC_GA_ID=G-XXXXXXXXXX pnpm build
// In CI it comes from the repository variable GA_MEASUREMENT_ID (see .github/workflows/website.yml).
//
// Consent model (the same everywhere, so it does not depend on guessing a visitor's location):
//  - Nothing is requested from Google and no cookie is set until the visitor presses "Accept analytics".
//  - "Decline" and "Accept" are equally prominent. The choice is kept in localStorage under matimo-analytics.
//  - The choice can be changed at any time: window.matimoAnalytics.open() re-shows the banner (the privacy page has a button).
//  - A browser that sends Do Not Track is never shown the banner and never measured.
//  - Declining or withdrawing deletes the _ga and _ga_* cookies and disables the tag for the page.
export function gaId(raw) {
  return /^G-[A-Z0-9]{6,}$/.test(raw ?? '') ? raw : '';
}

export function gaInline(id) {
  return `(function () {
  var ID = ${JSON.stringify(id)}, KEY = 'matimo-analytics';
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function put(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function load() {
    if (window.__matimoGa) return;
    window.__matimoGa = true;
    window['ga-disable-' + ID] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ID);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);
  }
  function clear() {
    window['ga-disable-' + ID] = true;
    var host = location.hostname, parts = host.split('.');
    var domains = ['', host, '.' + host, '.' + parts.slice(-2).join('.')];
    document.cookie.split(';').forEach(function (c) {
      var n = c.split('=')[0].trim();
      if (n !== '_ga' && n.indexOf('_ga_') !== 0) return;
      domains.forEach(function (d) {
        document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
      });
    });
  }
  function banner() {
    if (document.getElementById('matimo-consent')) return;
    var st = document.createElement('style');
    st.textContent = '#matimo-consent{position:fixed;left:1rem;right:1rem;bottom:1rem;z-index:2147483000;max-width:34rem;margin:0 auto;background:#101015;color:#ececf1;border:1px solid #3a3a46;border-radius:12px;padding:1rem 1.1rem;font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.5)}#matimo-consent p{margin:0 0 .8rem}#matimo-consent a{color:#ff7aa8}#matimo-consent .row{display:flex;gap:.6rem}#matimo-consent button{flex:1;font:inherit;font-weight:600;padding:.55rem .9rem;border-radius:8px;border:1px solid #4a4a58;background:#2a2a35;color:#fff;cursor:pointer}#matimo-consent button.yes{background:#d81b60;border-color:#d81b60}#matimo-consent button:focus-visible{outline:2px solid #ff7aa8;outline-offset:2px}';
    var box = document.createElement('div');
    box.id = 'matimo-consent';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Analytics choice');
    box.innerHTML = '<p>We would like to use Google Analytics to count visits and see which pages help. It sets cookies and sends data to Google only if you accept. See the <a href="/privacy/">privacy notice</a>. You can change your choice at any time.</p><div class="row"><button type="button" class="no">Decline</button><button type="button" class="yes">Accept analytics</button></div>';
    function done(v) {
      put(v);
      box.remove();
      st.remove();
      if (v === 'granted') load(); else clear();
    }
    box.querySelector('.no').addEventListener('click', function () { done('denied'); });
    box.querySelector('.yes').addEventListener('click', function () { done('granted'); });
    document.head.appendChild(st);
    document.body.appendChild(box);
  }
  window.matimoAnalytics = { open: banner, status: get };
  var v = get();
  if (v === 'granted') load();
  else if (v === null) { if (document.body) banner(); else document.addEventListener('DOMContentLoaded', banner); }
})();`;
}

// Entries for Starlight's head option. Empty when no ID is set.
export function gaHead(raw) {
  const id = gaId(raw);
  if (!id) return [];
  return [{ tag: 'script', content: gaInline(id) }];
}
