/* Lampa Quality Reselect - experimental v0.1
 * Re-selects the current stream through Lampa's built-in quality handler.
 * No OS detection and no UI.
 */
(function () {
  'use strict';

  if (window.__lampa_quality_reselect_v01) return;
  window.__lampa_quality_reselect_v01 = true;

  var DELAY_MS = 2200;
  var serial = 0;
  var timer = null;

  function cancel() {
    serial += 1;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function currentQuality(data) {
    var url = data && data.url;
    if (typeof url !== 'string' || !url) return null;

    var name = data.quality_switched || '';
    var qualities = data.quality;

    if (qualities && typeof qualities === 'object') {
      Object.keys(qualities).some(function (key) {
        var item = qualities[key];
        var candidate = typeof item === 'string' ? item : item && item.url;
        if (candidate === url) {
          name = key;
          return true;
        }
        return false;
      });
    }
    return { name: name, url: url };
  }

  function init() {
    if (!window.Lampa || !Lampa.Player || !Lampa.Player.listener ||
        !Lampa.PlayerPanel || !Lampa.PlayerPanel.listener) {
      console.warn('[Quality Reselect] Player API is unavailable');
      return;
    }

    Lampa.Player.listener.follow('create', cancel);
    Lampa.Player.listener.follow('destroy', cancel);
    Lampa.Player.listener.follow('ready', function () {
      cancel();
      var run = serial;
      timer = setTimeout(function () {
        timer = null;
        if (run !== serial || !Lampa.Player.opened()) return;
        var data = Lampa.Player.playdata();
        if (!data || data.iptv || data.tv) return;
        var selected = currentQuality(data);
        if (!selected) return;
        // Core player.js listens for exactly this event, destroys the video
        // while preserving its metadata and loads the selected URL again.
        Lampa.PlayerPanel.listener.send('quality', selected);
        console.info('[Quality Reselect] Stream reselected:', selected.name || 'current');
      }, DELAY_MS);
    });

    console.info('[Quality Reselect] Experimental plugin active');
  }

  if (window.appready) init();
  else if (window.Lampa && Lampa.Listener) {
    Lampa.Listener.follow('app', function (event) {
      if (event && event.type === 'ready') init();
    });
  }
})();