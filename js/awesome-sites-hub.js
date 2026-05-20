(function () {
  var PROD_CATALOG = 'https://awesomesites.neorgon.com/api/v1/catalog.json';
  var DEV_CATALOG = 'http://localhost:8831/api/v1/catalog.json';

  function catalogUrl() {
    var host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return DEV_CATALOG;
    return PROD_CATALOG;
  }

  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hexRgb(hex) {
    var h = String(hex).replace('#', '').slice(0, 6);
    if (h.length !== 6) return '249, 115, 22';
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some(function (n) { return Number.isNaN(n); })) return '249, 115, 22';
    return r + ', ' + g + ', ' + b;
  }

  function domainFromUrl(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  }

  function hubExternalCard(site) {
    var accent = site.accent || '#f97316';
    var glow = accent.indexOf('#') === 0 ? accent.replace('#', '') : 'f97316';
    var domain = domainFromUrl(site.url);
    var tags = (site.labels || [])
      .map(function (l) {
        return '<span class="card-tag">' + escHtml(l) + '</span>';
      })
      .join('');
    return (
      '<a class="site-card external-card" data-card-id="as-' +
      escHtml(site.id) +
      '" href="' +
      escHtml(site.url) +
      '" target="_blank" rel="noopener noreferrer" style="--card-glow: rgba(' +
      hexRgb(glow) +
      ',.28); --card-glow-border: rgba(' +
      hexRgb(glow) +
      ',.38); --card-accent: ' +
      escHtml(accent) +
      ';">' +
      '<div class="card-content">' +
      '<div class="card-top">' +
      '<div class="card-icon-wrap"><span class="card-initial" aria-hidden="true">' +
      escHtml((site.name || '?').charAt(0).toUpperCase()) +
      '</span></div>' +
      '<span class="external-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>External</span>' +
      '</div>' +
      '<div class="card-domain">' +
      escHtml(domain) +
      '</div>' +
      '<h3 class="card-name">' +
      escHtml(site.name) +
      '</h3>' +
      '<div class="card-desc">' +
      escHtml(site.description) +
      '</div>' +
      '<div class="card-tags">' +
      tags +
      '</div>' +
      '</div>' +
      '</a>'
    );
  }

  function init() {
    var group = document.getElementById('awesomeSitesHubGroup');
    var grid = document.getElementById('awesomeSitesHubGrid');
    if (!group || !grid) return;

    fetch(catalogUrl(), { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var hub = data.hub || {};
        var siteMap = {};
        (data.sites || []).forEach(function (s) {
          siteMap[s.id] = s;
        });
        var featured = (hub.featuredSiteIds || [])
          .map(function (id) { return siteMap[id]; })
          .filter(Boolean);

        if (hub.sectionColor) {
          group.style.setProperty('--group-color', hub.sectionColor);
        }
        var label = group.querySelector('.group-label');
        if (label && hub.sectionTitle) {
          var dot = label.querySelector('.group-dot');
          label.textContent = '';
          if (dot) label.appendChild(dot);
          label.appendChild(document.createTextNode(' ' + hub.sectionTitle));
        }

        grid.innerHTML = featured.map(hubExternalCard).join('');
        group.hidden = featured.length === 0;
        document.dispatchEvent(new CustomEvent('neorgon:catalog-updated'));
      })
      .catch(function (err) {
        console.warn('Awesome Sites hub feed:', err);
        group.hidden = true;
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
