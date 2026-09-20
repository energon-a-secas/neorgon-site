// Antenne uses the published feed and local catalog artwork. Mobile loads on demand.
// No iframe or remote favicon service: the hub owns its small, accessible view.
(function () {
  'use strict';
  if (window.__neoDispatchPopup) return;
  window.__neoDispatchPopup = true;

  var KEY = 'neorgon-dispatch-seen';
  var local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  var BASE = local ? 'http://localhost:8873/' : 'https://dispatch.neorgon.com/';
  var desktop = window.matchMedia('(min-width: 900px)');
  var kinds = {
    launch: { label: 'Launch', path: 'M3 6l9-4 9 4v12l-9 4-9-4V6zm0 0l9 4 9-4M12 10v12M7.5 4l9 4' },
    feature: { label: 'Feature', path: 'M12 3l2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3z' },
    fix: { label: 'Fix', path: 'M12 5v14M5 12h14' },
    note: { label: 'Note', path: 'M6 3h12v18H6V3zm3 5h6M9 12h6M9 16h4' }
  };

  function node(tag, cls, text) {
    var el = document.createElement(tag);
    el.className = cls;
    if (text) el.textContent = text;
    return el;
  }

  function kindIcon(kind) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + kinds[kind].path + '"/></svg>';
  }

  // Validate the fields this view uses; feed text is always assigned as text.
  function normalize(doc) {
    var seen = new Set();
    return (doc && Array.isArray(doc.posts) ? doc.posts : []).filter(function (p) {
      if (!p || typeof p.id !== 'string' || !p.id.trim() ||
          typeof p.title !== 'string' || !p.title.trim() ||
          !Object.prototype.hasOwnProperty.call(kinds, p.kind) ||
          typeof p.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return false;
      var date = new Date(p.date + 'T12:00:00Z');
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== p.date || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    }).sort(function (a, b) {
      return a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date);
    }).slice(0, 3);
  }

  function accentInto(el) {
    var card = document.querySelector('#tools [data-card-id="dispatch"]');
    var accent = card && getComputedStyle(card).getPropertyValue('--card-accent').trim();
    el.style.setProperty('--pop-accent', accent || '#3b82f6');
  }

  function satSvg(cls, size) {
    return '<svg class="' + cls + '" viewBox="0 0 22 22" width="' + size + '" height="' + size + '" fill="none" aria-hidden="true" focusable="false">'
      + '<g fill="currentColor" transform="rotate(-45 11 11)">'
      + '<rect x="9" y="2.6" width="4" height="4.6" rx=".7"/>'
      + '<rect x="10.6" y="7.2" width=".8" height="1.2"/>'
      + '<rect x="8.6" y="8.4" width="4.8" height="5.2" rx="1.1"/>'
      + '<rect x="10.6" y="13.6" width=".8" height="1.2"/>'
      + '<rect x="9" y="14.8" width="4" height="4.6" rx=".7"/>'
      + '<rect x="7.6" y="10.8" width="1.4" height="1.2"/>'
      + '<path d="M7.9 8.2 A3.3 3.3 0 0 0 7.9 14.6 Z"/>'
      + '<circle cx="4.3" cy="11.4" r=".9"/>'
      + '</g>'
      + '<path class="dispatch-pop__wave dispatch-pop__wave--2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M6.55 19 A3 3 0 0 1 3.55 16"/>'
      + '<path class="dispatch-pop__wave dispatch-pop__wave--3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M6.55 21.2 A5.2 5.2 0 0 1 1.35 16"/>'
      + '</svg>';
  }

  // Match destination URLs first: repository slugs and card IDs can differ.
  // Artwork comes only from our DOM, never a feed-supplied image URL.
  function storyCards(post) {
    var links = Array.isArray(post.links) ? post.links : [];
    var cards = Array.from(document.querySelectorAll('#tools .site-card[data-card-id]'));
    var matches = [];
    var id = typeof post.site === 'string' ? post.site.replace(/-site$/, '') : '';
    var primary = cards.find(function (card) { return card.dataset.cardId === id; });
    if (primary) matches.push(primary);
    for (var i = 0; i < links.length; i++) {
      try {
        var url = new URL(links[i].url);
        if (url.protocol !== 'https:') continue;
        var match = cards.find(function (card) {
          var href = card.getAttribute('href');
          if (!href) return false;
          var destination = new URL(href, location.href);
          return destination.hostname === url.hostname &&
            (url.hostname.endsWith('.neorgon.com') ||
             destination.pathname.replace(/\/$/, '') === url.pathname.replace(/\/$/, ''));
        });
        if (match && matches.indexOf(match) === -1) matches.push(match);
      } catch (e) { /* Malformed optional link: continue with the next. */ }
    }
    return matches;
  }

  function storyItem(post, index) {
    var li = node('li', 'dispatch-story');
    var link = node('a', 'dispatch-story__link');
    link.href = BASE + '#p=' + encodeURIComponent(post.id);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    var cards = storyCards(post);
    var card = cards[0];
    var art = node('span', 'dispatch-story__art');
    art.setAttribute('aria-hidden', 'true');
    var icon = card && card.querySelector('.card-site-icon, .card-initial');
    if (icon) {
      art.style.setProperty('--card-accent', getComputedStyle(card).getPropertyValue('--card-accent'));
      art.appendChild(icon.cloneNode(true));
    } else {
      art.innerHTML = satSvg('dispatch-story__fallback', 24);
    }
    var badge = node('span', 'dispatch-story__badge dispatch-kind--' + post.kind);
    badge.innerHTML = kindIcon(post.kind);
    art.appendChild(badge);

    var copy = node('span', 'dispatch-story__copy');
    var meta = node('span', 'dispatch-story__meta');
    meta.appendChild(node('span', 'dispatch-story__kind dispatch-kind--' + post.kind, kinds[post.kind].label));
    var time = node('time', '', new Date(post.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }));
    time.dateTime = post.date;
    time.title = post.date;
    meta.appendChild(time);
    copy.appendChild(meta);
    copy.appendChild(node('span', 'dispatch-story__title', post.title));
    if (cards.length) {
      var sources = node('span', 'dispatch-story__sources');
      cards.forEach(function (sourceCard) {
        var source = node('span', 'dispatch-story__source');
        source.style.setProperty('--card-accent', getComputedStyle(sourceCard).getPropertyValue('--card-accent'));
        var sourceIcon = sourceCard.querySelector('.card-site-icon, .card-initial');
        if (sourceIcon) {
          var mark = node('span', 'dispatch-story__source-icon');
          mark.setAttribute('aria-hidden', 'true');
          mark.appendChild(sourceIcon.cloneNode(true));
          source.appendChild(mark);
        }
        var name = sourceCard.querySelector('.card-name');
        source.appendChild(node('span', '', name ? name.textContent.trim() : sourceCard.dataset.cardId));
        sources.appendChild(source);
      });
      copy.appendChild(sources);
    }
    if (index === 0 && typeof post.summary === 'string' && post.summary.trim()) {
      copy.appendChild(node('span', 'dispatch-story__summary', post.summary));
    }
    link.appendChild(art);
    link.appendChild(copy);
    var arrow = node('span', 'dispatch-story__arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    link.appendChild(arrow);
    li.appendChild(link);
    return li;
  }

  var dock;
  var popup;
  var posts = [];
  var edition;
  var feedState = 'idle';
  var pending = null;
  var interacted = false;

  function renderContent() {
    if (!popup) return;
    var content = popup.querySelector('.dispatch-pop__content');
    content.replaceChildren();
    content.setAttribute('aria-busy', String(feedState === 'loading'));
    if (feedState === 'ready') {
      var list = node('ul', 'dispatch-pop__list');
      posts.forEach(function (post, i) { list.appendChild(storyItem(post, i)); });
      content.appendChild(list);
      return;
    }
    var message = feedState === 'error' ? 'Fleet news is unavailable right now.'
      : feedState === 'empty' ? 'No fleet news yet. Check back soon.' : 'Loading fleet news…';
    var state = node('div', 'dispatch-pop__state');
    state.appendChild(node('p', '', message));
    if (feedState === 'error' || feedState === 'empty') {
      var retry = node('button', 'dispatch-pop__retry', 'Try again');
      retry.type = 'button';
      retry.addEventListener('click', function () {
        popup.querySelector('.dispatch-pop__close').focus({ preventScroll: true });
        loadFeed();
      });
      state.appendChild(retry);
    }
    content.appendChild(state);
  }

  function loadFeed() {
    if (pending) return pending;
    feedState = 'loading';
    renderContent();
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 10000);
    pending = fetch(BASE + 'data/posts.json', { cache: 'no-cache', signal: controller.signal })
      .then(function (res) {
        if (!res.ok) throw new Error('Feed unavailable');
        return res.json();
      })
      .then(function (doc) {
        posts = normalize(doc);
        feedState = posts.length ? 'ready' : 'empty';
        edition = posts.length ? 'v2:' + JSON.stringify(posts.map(function (p) { return [p.id, p.date]; })) : null;
      })
      .catch(function () { feedState = 'error'; })
      .finally(function () {
        clearTimeout(timeout);
        pending = null;
        renderContent();
      });
    return pending;
  }

  function openBulletin() {
    interacted = true;
    show(true);
    if (feedState === 'idle' || feedState === 'error') loadFeed();
  }

  function showDock() {
    if (!dock) {
      dock = node('button', 'dispatch-dock');
      dock.type = 'button';
      dock.setAttribute('aria-label', 'Open Antenne fleet news');
      accentInto(dock);
      dock.innerHTML = satSvg('dispatch-dock__sat', 20) + '<span>Antenne</span>';
      dock.addEventListener('click', openBulletin);
      document.body.appendChild(dock);
    }
    dock.hidden = false;
    dock.setAttribute('aria-expanded', 'false');
  }

  function dismiss(options) {
    options = options || {};
    interacted = true;
    if (edition && options.remember !== false) {
      try { localStorage.setItem(KEY, edition); } catch (e) { /* Storage is optional. */ }
    }
    if (popup) popup.remove();
    popup = null;
    showDock();
    // Safari does not focus buttons on a pointer click. Dismissal is always a
    // deliberate close/Escape action, so return focus even in that case.
    if (options.focus !== false) dock.focus({ preventScroll: true });
  }

  function show(focus) {
    if (popup) return;
    if (dock) { dock.hidden = true; dock.setAttribute('aria-expanded', 'true'); }
    popup = node('aside', 'dispatch-pop');
    popup.id = 'dispatch-bulletin';
    popup.setAttribute('aria-label', 'Antenne fleet news');
    accentInto(popup);
    var bar = node('div', 'dispatch-pop__bar');
    var label = node('a', 'dispatch-pop__label');
    label.href = BASE;
    label.target = '_blank';
    label.rel = 'noopener noreferrer';
    label.innerHTML = satSvg('dispatch-pop__sat', 22) + '<span><strong>Antenne</strong><span class="dispatch-pop__subtitle">Fleet news</span></span>';
    var close = node('button', 'dispatch-pop__close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss fleet news');
    close.addEventListener('click', function () { dismiss(); });
    bar.appendChild(label);
    bar.appendChild(close);
    popup.appendChild(bar);
    var content = node('div', 'dispatch-pop__content');
    content.setAttribute('aria-live', 'polite');
    popup.appendChild(content);
    renderContent();
    var footer = node('a', 'dispatch-pop__footer');
    footer.href = BASE;
    footer.target = '_blank';
    footer.rel = 'noopener noreferrer';
    footer.appendChild(node('span', '', 'All fleet news'));
    var arrow = node('span', '', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    footer.appendChild(arrow);
    popup.appendChild(footer);
    popup.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { event.stopPropagation(); dismiss(); }
    });
    document.body.appendChild(popup);
    if (focus) close.focus({ preventScroll: true });
  }

  function boot() {
    // Phones get an entry point immediately; the feed waits for an explicit tap.
    if (!desktop.matches) { showDock(); return; }
    loadFeed().then(function () {
      if (!desktop.matches) { if (!popup) showDock(); return; }
      if (interacted || feedState !== 'ready') return;
      var seen;
      try { seen = localStorage.getItem(KEY); } catch (e) { /* Storage is optional. */ }
      if (seen === edition) showDock();
      else show(false);
    });
  }

  desktop.addEventListener('change', function () {
    if (!desktop.matches && popup) {
      var hadFocus = popup.contains(document.activeElement);
      dismiss({ remember: false, focus: hadFocus });
    }
    if (!popup) showDock();
  });
  document.addEventListener('pointerdown', function (event) {
    if (popup && !desktop.matches && !popup.contains(event.target) &&
        (!dock || !dock.contains(event.target))) dismiss({ focus: false });
  });

  if ('requestIdleCallback' in window) requestIdleCallback(boot, { timeout: 4000 });
  else setTimeout(boot, 2500);
})();
