/* ── Egg Background (YouTube Video) ───────────────────────────────────────── */
(function() {
  const container = document.getElementById('eggBackground');
  if (!container) return;

  let player = null;
  let isActive = false;
  let videoId = 'dZLR5MuBeuk'; // The video ID from your link
  let iframe = null;

  // Create iframe for YouTube embed with minimal branding - completely chromeless
  function createPlayer() {
    if (iframe) return;

    iframe = document.createElement('iframe');
    iframe.id = 'eggVideo';
    // Using youtube-nocookie.com for cleaner embed (less tracking, more minimal)
    // Parameter notes:
    // - controls=0: Hides play controls
    // - modestbranding=1: Minimizes YouTube logo
    // - rel=0: No related videos at end
    // - iv_load_policy=3: Hides video annotations
    // - playsinline=1: Plays inline on mobile
    // - autoplay=1&mute=1: Required for autoplay in modern browsers
    // - loop=1&playlist=: Enables looping
    // - fs=0: Hides fullscreen button
    // - disablekb=1: Disables keyboard controls
    // - origin=: Required for some browsers when using js API
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&iv_load_policy=3&playsinline=1&origin=http://localhost:8800&widget_referrer=http://localhost:8800`;
    // Scale up to hide any YouTube overlay elements at edges
    // Using 130% to ensure any bottom/top controls are pushed off-screen
    iframe.style.cssText = 'position:absolute;top:50%;left:50%;width:130%;height:130%;border:none;transform:translate(-50%,-50%);pointer-events:none;';
    iframe.allow = 'autoplay; encrypted-media;';

    container.appendChild(iframe);
  }

  function removePlayer() {
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
    iframe = null;
  }

  function eggOn() {
    if (isActive) return;
    isActive = true;
    container.classList.add('active');

    // Dim starfield
    const starfield = document.getElementById('starfield');
    if (starfield) {
      starfield.style.opacity = '0.2';
    }

    createPlayer();
  }

  function eggOff() {
    if (!isActive) return;
    isActive = false;
    container.classList.remove('active');
    removePlayer();

    // Restore starfield
    const starfield = document.getElementById('starfield');
    if (starfield) {
      starfield.style.opacity = '';
    }
  }

  function eggKill() {
    isActive = false;
    container.classList.remove('active');
    removePlayer();

    // Restore starfield
    const starfield = document.getElementById('starfield');
    if (starfield) {
      starfield.style.opacity = '';
    }
  }

  // Expose control functions
  window.eggOn = eggOn;
  window.eggOff = eggOff;
  window.eggKill = eggKill;

  // Start hidden
  container.classList.remove('active');
})();
