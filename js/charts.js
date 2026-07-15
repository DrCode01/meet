/*
 * charts.js — tiny dependency-free SVG charts (offline-safe).
 *
 * Colors come from the validated data-viz reference palette via CSS custom
 * properties defined in styles.css, so light/dark swap in one place. Every
 * chart here is single-series or status-encoded with direct labels, so no
 * categorical palette is in play.
 */
(function () {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';
  function el(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // ---- Line chart (single series, e.g. weight trend or estimated 1RM) ----
  // points: [{x:'YYYY-MM-DD', y:Number, raw?:Number}]
  function lineChart(container, points, opts) {
    opts = opts || {};
    container.innerHTML = '';
    if (!points || points.length < 2) {
      container.innerHTML = '<div class="chart-empty">Not enough data yet — keep logging.</div>';
      return;
    }
    var W = container.clientWidth || 320, H = opts.height || 200;
    var padL = 40, padR = 12, padT = 14, padB = 24;
    var innerW = W - padL - padR, innerH = H - padT - padB;

    var ys = points.map(function (p) { return p.y; });
    var raws = points.filter(function (p) { return p.raw != null; }).map(function (p) { return p.raw; });
    var minY = Math.min.apply(null, ys.concat(raws));
    var maxY = Math.max.apply(null, ys.concat(raws));
    if (opts.includeZero) minY = Math.min(minY, 0);
    var range = (maxY - minY) || 1;
    minY -= range * 0.08; maxY += range * 0.08;

    var n = points.length;
    function px(i) { return padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW); }
    function py(v) { return padT + innerH - ((v - minY) / (maxY - minY)) * innerH; }

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', height: H, class: 'chart' });

    // gridlines + y labels (4 ticks)
    for (var t = 0; t <= 4; t++) {
      var val = minY + (t / 4) * (maxY - minY);
      var y = py(val);
      svg.appendChild(el('line', { x1: padL, y1: y, x2: W - padR, y2: y, class: 'grid' }));
      var lbl = el('text', { x: padL - 6, y: y + 3, class: 'axis', 'text-anchor': 'end' });
      lbl.textContent = fmtNum(val);
      svg.appendChild(lbl);
    }

    // area under trend
    var areaD = 'M' + px(0) + ',' + py(points[0].y);
    points.forEach(function (p, i) { areaD += ' L' + px(i) + ',' + py(p.y); });
    areaD += ' L' + px(n - 1) + ',' + py(minY) + ' L' + px(0) + ',' + py(minY) + ' Z';
    svg.appendChild(el('path', { d: areaD, class: 'area' }));

    // raw dots (faint), if present
    points.forEach(function (p, i) {
      if (p.raw != null) svg.appendChild(el('circle', { cx: px(i), cy: py(p.raw), r: 2, class: 'raw-dot' }));
    });

    // trend line
    var lineD = 'M' + px(0) + ',' + py(points[0].y);
    points.forEach(function (p, i) { if (i) lineD += ' L' + px(i) + ',' + py(p.y); });
    svg.appendChild(el('path', { d: lineD, class: 'line' }));

    // last-point marker + label
    var last = points[n - 1];
    svg.appendChild(el('circle', { cx: px(n - 1), cy: py(last.y), r: 3.5, class: 'end-dot' }));

    // hover layer
    var hoverLine = el('line', { class: 'crosshair', y1: padT, y2: padT + innerH, x1: -99, x2: -99 });
    var hoverDot = el('circle', { r: 4, class: 'hover-dot', cx: -99, cy: -99 });
    svg.appendChild(hoverLine); svg.appendChild(hoverDot);
    var tip = document.createElement('div');
    tip.className = 'chart-tip'; tip.style.display = 'none';
    container.style.position = 'relative';
    container.appendChild(svg);
    container.appendChild(tip);

    var overlay = el('rect', { x: padL, y: padT, width: innerW, height: innerH, fill: 'transparent', 'pointer-events': 'all' });
    svg.appendChild(overlay);
    overlay.addEventListener('pointermove', function (ev) {
      var rect = svg.getBoundingClientRect();
      var scale = W / rect.width;
      var mx = (ev.clientX - rect.left) * scale;
      var i = Math.round(((mx - padL) / innerW) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      var p = points[i];
      hoverLine.setAttribute('x1', px(i)); hoverLine.setAttribute('x2', px(i));
      hoverDot.setAttribute('cx', px(i)); hoverDot.setAttribute('cy', py(p.y));
      tip.style.display = 'block';
      tip.innerHTML = '<strong>' + fmtNum(p.raw != null ? p.raw : p.y) + (opts.unit || '') + '</strong><span>' + fmtDate(p.x) + '</span>';
      var tx = Math.min(px(i) / scale + 8, rect.width - 90);
      tip.style.left = tx + 'px';
      tip.style.top = '6px';
    });
    overlay.addEventListener('pointerleave', function () {
      hoverLine.setAttribute('x1', -99); hoverLine.setAttribute('x2', -99);
      hoverDot.setAttribute('cx', -99);
      tip.style.display = 'none';
    });
  }

  // ---- Volume bars vs landmarks (status-encoded, direct-labeled) ----
  function volumeChart(container, guidance) {
    container.innerHTML = '';
    var rows = guidance.filter(function (g) { return g.landmarks.mev > 0; });
    var maxScale = Math.max.apply(null, rows.map(function (g) { return Math.max(g.sets, g.landmarks.mrv); })) * 1.1;

    var wrap = document.createElement('div');
    wrap.className = 'vol-rows';
    rows.forEach(function (g) {
      var row = document.createElement('div');
      row.className = 'vol-row';
      var color = statusColor(g.status);
      var pct = Math.min(100, (g.sets / maxScale) * 100);
      var mevPct = (g.landmarks.mev / maxScale) * 100;
      var mavPct = (g.landmarks.mav / maxScale) * 100;
      var mrvPct = (g.landmarks.mrv / maxScale) * 100;
      row.innerHTML =
        '<div class="vol-label">' + g.label + '</div>' +
        '<div class="vol-track">' +
          '<div class="vol-bar" style="width:' + pct + '%;background:' + color + '"></div>' +
          '<span class="vol-mark" style="left:' + mevPct + '%" title="MEV ' + g.landmarks.mev + '"></span>' +
          '<span class="vol-mark mav" style="left:' + mavPct + '%" title="MAV ' + g.landmarks.mav + '"></span>' +
          '<span class="vol-mark mrv" style="left:' + mrvPct + '%" title="MRV ' + g.landmarks.mrv + '"></span>' +
        '</div>' +
        '<div class="vol-val">' + g.sets + '</div>';
      row.title = g.label + ': ' + g.sets + ' sets/wk — ' + g.advice;
      wrap.appendChild(row);
    });
    var legend = document.createElement('div');
    legend.className = 'vol-legend';
    legend.innerHTML = 'Ticks: <span class="lg mev"></span>MEV · <span class="lg mav"></span>MAV · <span class="lg mrv"></span>MRV (weekly hard sets)';
    container.appendChild(wrap);
    container.appendChild(legend);
  }

  function statusColor(status) {
    if (status === 'under') return css('--status-warning') || '#fab219';
    if (status === 'building') return css('--series-1') || '#2a78d6';
    if (status === 'optimal') return css('--status-good') || '#0ca30c';
    if (status === 'over') return css('--status-critical') || '#d03b3b';
    return css('--series-1');
  }

  function fmtNum(v) {
    if (Math.abs(v) >= 100) return String(Math.round(v));
    return (Math.round(v * 10) / 10).toString();
  }
  function fmtDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  window.Charts = { lineChart: lineChart, volumeChart: volumeChart };
})();
