/* Shikimori for Lampa — compatibility loader
 * Upstream module: https://github.com/lampame/main/tree/main/Shikimori
 * Loads a locally patched LME Shikimori module.
 * The original Shikimori implementation remains maintained by its author.
 */
(function () {
  'use strict';
  if (window.__anicim_shikimori_loader) return;
  window.__anicim_shikimori_loader = true;

  var url = 'https://anicim.github.io/lampa-plugins/shikimori-lme-fixed.js';
  var script = document.createElement('script');
  script.src = url;
  script.async = true;
  script.onerror = function () {
    console.error('[Shikimori] Cannot load upstream module:', url);
    window.__anicim_shikimori_loader = false;
  };
  (document.head || document.documentElement).appendChild(script);
})();
