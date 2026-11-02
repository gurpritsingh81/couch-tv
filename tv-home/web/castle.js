// Castle look: a painted castle at night, a Great Hall one step down, and a snowy owl that flies to
// whatever is selected. Everything is drawn here with canvas, so the page works without any
// pictures. Drop castle/castle.jpg and castle/hall.jpg next to this file to use your own artwork
// instead (the window flicker and the star twinkle then switch off, the rest keeps going).
//
// app.js calls: CASTLE.init(), CASTLE.hall(on), CASTLE.perch(element | null).
(function () {
  "use strict";
  var W = 1280, H = 720;          // the drawing size; the canvases are scaled to the screen
  var FX = 0.75;                  // the animated layer is drawn at 960 x 540 and scaled up
  var world, sCastle, sHall, fCastle, fHall, mist1, mist2, owlEl, hintEl;
  var wins = [], stars = [], spires = [], candles = [], motes = [];
  var photo = { castle: false, hall: false };
  var hallOn = false, both = 0, glowSprite, flameSprite, last = 0, lastFx = 0, shoot = null, nextShoot = 9000;
  var ctxC, ctxH;

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mk(w, h, cls) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    if (cls) c.className = cls;
    return c;
  }
  function sprite(size, stops) {
    var c = mk(size, size), x = c.getContext("2d");
    var g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    return c;
  }

  // ------------------------------------------------------------------ the castle
  function ridge(c, base, amp, col, seed, step) {
    var r = rng(seed), pts = [], x, ph1 = r() * 6, ph2 = r() * 6, ph3 = r() * 6;
    for (x = 0; x <= W + step; x += step) {
      pts.push([x, base + Math.sin(x * 0.004 + ph1) * amp + Math.sin(x * 0.011 + ph2) * amp * 0.45 + Math.sin(x * 0.029 + ph3) * amp * 0.18 + (r() - 0.5) * amp * 0.25]);
    }
    c.beginPath(); c.moveTo(0, H);
    pts.forEach(function (p) { c.lineTo(p[0], p[1]); });
    c.lineTo(W, H); c.closePath(); c.fillStyle = col; c.fill();
  }
  function body(c, x, y, w, h) {
    var g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, "#22365f"); g.addColorStop(0.16, "#101c3a"); g.addColorStop(1, "#070d1c");
    c.fillStyle = g; c.fillRect(x - w / 2, y - h, w, h);
    c.fillStyle = "rgba(160,190,240,.28)"; c.fillRect(x - w / 2, y - h, 1.4, h);
  }
  function roof(c, x, y, w, rh) {
    c.beginPath(); c.moveTo(x - w / 2 - 5, y); c.lineTo(x, y - rh); c.lineTo(x + w / 2 + 5, y); c.closePath();
    var g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, "#27406c"); g.addColorStop(0.3, "#0d1932"); g.addColorStop(1, "#050a16");
    c.fillStyle = g; c.fill();
    c.strokeStyle = "rgba(170,200,250,.4)"; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(x - w / 2 - 5, y); c.lineTo(x, y - rh); c.stroke();
    spires.push({ x: x, y: y - rh });
  }
  function crenel(c, x, y, w) {
    var n = Math.max(3, Math.round(w / 11)), cw = w / (n * 2 - 1), i;
    c.fillStyle = "#0c1730";
    for (i = 0; i < n; i++) c.fillRect(x - w / 2 + i * cw * 2, y - 6, cw, 6);
  }
  function lit(c, r, x, y, w, h, cols, rows, prob) {
    var i, j, gx = w / cols, gy = h / rows;
    for (j = 0; j < rows; j++) for (i = 0; i < cols; i++) {
      if (r() > prob) continue;
      var wx = x - w / 2 + gx * (i + 0.5), wy = y - h + gy * (j + 0.5);
      c.fillStyle = "#6a4f27"; c.fillRect(wx - 2, wy - 4, 4, 8);
      c.beginPath(); c.arc(wx, wy - 4, 2, Math.PI, 0); c.fill();
      wins.push({ x: wx, y: wy, ph: r() * 6.28, ph2: r() * 6.28, sp: 0.7 + r() * 2.4, sp2: 1.3 + r() * 3 });
    }
  }
  function drawCastle(c) {
    var r = rng(11), i, LY = 548;
    wins = []; stars = []; spires = [];
    var g = c.createLinearGradient(0, 0, 0, LY);
    g.addColorStop(0, "#03050c"); g.addColorStop(0.4, "#081230"); g.addColorStop(0.78, "#152a52"); g.addColorStop(1, "#27466f");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (i = 0; i < 300; i++) {
      var sx = r() * W, sy = Math.pow(r(), 1.7) * LY * 0.7, big = r() < 0.09;
      c.fillStyle = "rgba(225,235,255," + (0.2 + r() * 0.6) + ")";
      c.fillRect(sx, sy, big ? 1.8 : 1, big ? 1.8 : 1);
      if (i < 70) stars.push({ x: sx, y: sy, ph: r() * 6.28, sp: 0.8 + r() * 2.2 });
    }
    // moon
    var mx = 330, my = 150;
    g = c.createRadialGradient(mx, my, 10, mx, my, 330);
    g.addColorStop(0, "rgba(170,200,255,.5)"); g.addColorStop(0.25, "rgba(110,150,220,.18)"); g.addColorStop(1, "rgba(60,90,160,0)");
    c.fillStyle = g; c.fillRect(0, 0, W, LY);
    g = c.createRadialGradient(mx - 6, my - 6, 2, mx, my, 38);
    g.addColorStop(0, "#fbfdff"); g.addColorStop(1, "#bfd0ee");
    c.fillStyle = g; c.beginPath(); c.arc(mx, my, 36, 0, 6.3); c.fill();
    c.fillStyle = "rgba(120,140,180,.22)";
    c.beginPath(); c.arc(mx + 10, my + 6, 8, 0, 6.3); c.fill(); c.beginPath(); c.arc(mx - 12, my - 8, 5, 0, 6.3); c.fill();
    // thin clouds crossing the moon
    for (i = 0; i < 9; i++) {
      var cx = r() * W, cy = 70 + r() * 230, cw = 180 + r() * 340;
      g = c.createRadialGradient(cx, cy, 0, cx, cy, cw / 2);
      g.addColorStop(0, "rgba(120,150,210,.16)"); g.addColorStop(1, "rgba(120,150,210,0)");
      c.save(); c.translate(cx, cy); c.scale(1, 0.14); c.translate(-cx, -cy);
      c.fillStyle = g; c.fillRect(cx - cw / 2, cy - cw / 2, cw, cw); c.restore();
    }
    ridge(c, LY - 150, 46, "#102040", 3, 14);
    ridge(c, LY - 100, 38, "#0b1730", 5, 12);
    ridge(c, LY - 52, 24, "#070f22", 8, 10);
    // the cliff
    c.beginPath(); c.moveTo(560, LY + 6); c.lineTo(600, 500); c.lineTo(640, 470); c.lineTo(700, 452); c.lineTo(780, 446);
    c.lineTo(870, 448); c.lineTo(950, 458); c.lineTo(1010, 480); c.lineTo(1060, 506); c.lineTo(1110, LY + 6); c.closePath();
    g = c.createLinearGradient(0, 440, 0, LY);
    g.addColorStop(0, "#0b1530"); g.addColorStop(1, "#050a16");
    c.fillStyle = g; c.fill();
    // the castle, back to front
    var b = 470;
    body(c, 1105, b + 4, 54, 150, 0); roof(c, 1105, b - 146, 54, 74); lit(c, r, 1105, b - 20, 54, 90, 2, 3, 0.7);
    body(c, 930, b - 10, 120, 80, 0); crenel(c, 930, b - 90, 120);
    body(c, 905, b + 6, 38, 270, 0); roof(c, 905, b - 264, 38, 90); lit(c, r, 905, b - 60, 38, 180, 1, 5, 0.8);
    body(c, 830, b + 8, 70, 230, 0); roof(c, 830, b - 222, 70, 110); lit(c, r, 830, b - 20, 70, 160, 2, 5, 0.75);
    body(c, 770, b + 6, 190, 120, 0); crenel(c, 770, b - 114, 190); lit(c, r, 770, b - 14, 190, 90, 7, 3, 0.72);
    body(c, 700, b + 8, 80, 90, 0); crenel(c, 700, b - 82, 80);
    body(c, 650, b + 10, 54, 170, 0); roof(c, 650, b - 160, 54, 78); lit(c, r, 650, b - 14, 54, 120, 2, 4, 0.75);
    body(c, 985, b + 8, 60, 110, 0); roof(c, 985, b - 102, 60, 62); lit(c, r, 985, b - 12, 60, 80, 2, 3, 0.7);
    body(c, 1040, b + 8, 70, 80, 0); crenel(c, 1040, b - 72, 70); lit(c, r, 1040, b - 10, 70, 60, 3, 2, 0.7);
    body(c, 590, b + 24, 44, 70, 0); roof(c, 590, b - 46, 44, 46); lit(c, r, 590, b + 6, 44, 40, 2, 2, 0.6);
    // a covered bridge to the far tower
    c.fillStyle = "#0a142c"; c.fillRect(985, b - 18, 120, 10);
    for (i = 0; i < 5; i++) { c.beginPath(); c.arc(1000 + i * 24, b - 8, 9, Math.PI, 0); c.fill(); }
    // rock in front of the base
    c.beginPath(); c.moveTo(520, LY + 4); c.lineTo(580, 520); c.lineTo(660, 504); c.lineTo(760, 498); c.lineTo(880, 500);
    c.lineTo(980, 508); c.lineTo(1070, 524); c.lineTo(1140, LY + 4); c.closePath();
    g = c.createLinearGradient(0, 495, 0, LY); g.addColorStop(0, "#070d1f"); g.addColorStop(1, "#03060f");
    c.fillStyle = g; c.fill();
    // the lake and the castle in it
    var tmp = mk(W, LY, null), tc = tmp.getContext("2d");
    tc.drawImage(c.canvas, 0, 0);
    g = c.createLinearGradient(0, LY, 0, H);
    g.addColorStop(0, "#0d1c3a"); g.addColorStop(1, "#03060e");
    c.fillStyle = g; c.fillRect(0, LY, W, H - LY);
    for (var y = LY; y < H; y += 2) {
      var d = y - LY, sy = LY - 2 - d * 0.92;
      if (sy < 0) break;
      c.globalAlpha = 0.5 * Math.pow(1 - d / (H - LY), 1.3);
      c.drawImage(tmp, 0, sy, W, 2, Math.sin(d * 0.13 + d * d * 0.0009) * (2 + d * 0.035), y, W, 2);
    }
    c.globalAlpha = 1;
    // moonlight on the water
    for (i = 0; i < 46; i++) {
      var yy = LY + 8 + i * 3.6, ww = 10 + i * 1.9 + r() * 22;
      c.fillStyle = "rgba(190,215,255," + (0.2 * (1 - i / 56)) + ")";
      c.fillRect(mx + (r() - 0.5) * (30 + i * 4.5) - ww / 2, yy, ww, 1.4);
    }
    // pines on the near shore
    function pine(px, py, ph, col) {
      c.fillStyle = col;
      for (var t = 0; t < 5; t++) {
        var tw = ph * (0.46 - t * 0.07), ty = py - ph * (0.18 * t + 0.1);
        c.beginPath(); c.moveTo(px - tw, ty + ph * 0.28); c.lineTo(px, ty - ph * 0.2); c.lineTo(px + tw, ty + ph * 0.28); c.closePath(); c.fill();
      }
      c.fillRect(px - 2, py - ph * 0.1, 4, ph * 0.14);
    }
    c.fillStyle = "#04070f"; c.fillRect(0, H - 22, W, 22);
    for (i = 0; i < 30; i++) pine(i * 25 + r() * 12, H - 8 + r() * 6, 70 + r() * 90, i % 2 ? "#050912" : "#070d1a");
    for (i = 0; i < 14; i++) pine(W - i * 28 - r() * 10, H - 8 + r() * 6, 60 + r() * 80, i % 2 ? "#050912" : "#070d1a");
    // the left third calm and dark for the clock, the bottom dark for the dock
    g = c.createLinearGradient(0, 0, W * 0.5, 0);
    g.addColorStop(0, "rgba(0,0,8,.42)"); g.addColorStop(1, "rgba(0,0,8,0)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    g = c.createLinearGradient(0, H * 0.62, 0, H);
    g.addColorStop(0, "rgba(0,0,6,0)"); g.addColorStop(1, "rgba(0,0,6,.62)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    g = c.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.5)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }

  // ------------------------------------------------------------------ the Great Hall
  function drawHall(c) {
    var r = rng(23), Vx = 640, Vy = 285, kb = 0.3, i, z, side;
    candles = [];
    function K(zz) { return 1 / (1 + zz * (1 / kb - 1)); }
    function P(x, y, zz) { var k = K(zz); return [Vx + (x - Vx) * k, Vy + (y - Vy) * k]; }
    function quad(a, b2, c2, d, fill) {
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b2[0], b2[1]); c.lineTo(c2[0], c2[1]); c.lineTo(d[0], d[1]); c.closePath();
      c.fillStyle = fill; c.fill();
    }
    c.fillStyle = "#04060d"; c.fillRect(0, 0, W, H);
    // ceiling: the enchanted sky
    var g = c.createLinearGradient(0, 0, 0, 215);
    g.addColorStop(0, "#02040a"); g.addColorStop(1, "#0d1a38");
    c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(832, 203); c.lineTo(448, 203); c.closePath();
    c.fillStyle = g; c.fill();
    c.save(); c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(832, 203); c.lineTo(448, 203); c.closePath(); c.clip();
    for (i = 0; i < 240; i++) {
      c.fillStyle = "rgba(225,235,255," + (0.2 + r() * 0.6) + ")";
      c.fillRect(r() * W, r() * 200, r() < 0.1 ? 1.8 : 1, r() < 0.1 ? 1.8 : 1);
    }
    for (i = 0; i < 7; i++) {
      var cx = r() * W, cy = 20 + r() * 150;
      g = c.createRadialGradient(cx, cy, 0, cx, cy, 200);
      g.addColorStop(0, "rgba(120,150,210,.2)"); g.addColorStop(1, "rgba(120,150,210,0)");
      c.save(); c.translate(cx, cy); c.scale(1, 0.18); c.translate(-cx, -cy); c.fillStyle = g; c.fillRect(cx - 200, cy - 200, 400, 400); c.restore();
    }
    c.restore();
    // side walls
    g = c.createLinearGradient(0, 0, 400, 0); g.addColorStop(0, "#080c18"); g.addColorStop(1, "#111a30");
    quad([0, 0], P(0, 0, 1), P(0, H, 1), [0, H], g);
    g = c.createLinearGradient(W, 0, W - 400, 0); g.addColorStop(0, "#080c18"); g.addColorStop(1, "#111a30");
    quad([W, 0], P(W, 0, 1), P(W, H, 1), [W, H], g);
    // back wall and its great window
    c.fillStyle = "#0a1226"; c.fillRect(448, 203, 384, 216);
    function arch(x, y, w, h, glow) {
      c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + w / 2); c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); c.lineTo(x + w, y + h); c.closePath();
      var gg = c.createLinearGradient(0, y, 0, y + h); gg.addColorStop(0, "#dbe9ff"); gg.addColorStop(1, glow);
      c.fillStyle = gg; c.fill();
      c.strokeStyle = "rgba(10,16,34,.9)"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.moveTo(x, y + h * 0.4); c.lineTo(x + w, y + h * 0.4); c.stroke();
    }
    arch(580, 214, 120, 180, "#5f86c4"); arch(474, 244, 46, 150, "#4a6aa0"); arch(760, 244, 46, 150, "#4a6aa0");
    g = c.createRadialGradient(640, 300, 10, 640, 300, 230);
    g.addColorStop(0, "rgba(150,190,255,.35)"); g.addColorStop(1, "rgba(150,190,255,0)");
    c.fillStyle = g; c.fillRect(380, 160, 520, 300);
    // the high table
    c.fillStyle = "#2a1a0e"; c.fillRect(468, 396, 344, 9);
    c.fillStyle = "#1b1008"; c.fillRect(468, 405, 344, 12);
    for (i = 0; i < 17; i++) {
      var hx = 478 + i * 20;
      c.fillStyle = "#0c0f1c"; c.fillRect(hx - 4, 386, 8, 12);
      c.fillStyle = i % 3 ? "#9a7258" : "#b88a66"; c.beginPath(); c.arc(hx, 382, 3.4, 0, 6.3); c.fill();
      c.fillStyle = "rgba(255,210,140,.85)"; c.fillRect(hx - 3, 398, 6, 2);
    }
    // floor
    g = c.createLinearGradient(0, 419, 0, H); g.addColorStop(0, "#0e1424"); g.addColorStop(1, "#1d2236");
    quad(P(0, H, 1), P(W, H, 1), [W, H], [0, H], g);
    c.strokeStyle = "rgba(120,140,190,.09)"; c.lineWidth = 1;
    for (i = -6; i <= 14; i++) { var fa = P(i * 120 - 120, H, 0), fb = P(i * 120 - 120, H, 1); c.beginPath(); c.moveTo(fa[0], fa[1]); c.lineTo(fb[0], fb[1]); c.stroke(); }
    for (i = 1; i < 14; i++) { var zz = Math.pow(i / 14, 1.5), la = P(0, H, zz), lb = P(W, H, zz); c.beginPath(); c.moveTo(la[0], la[1]); c.lineTo(lb[0], lb[1]); c.stroke(); }
    // pillars and banners along both walls (far to near)
    var HOUSE = ["#7a1a1f", "#b8932a", "#1d3c78", "#1f5a3a"], GOLD = ["#d8b45a", "#171717", "#a5774a", "#b9c2c8"];
    for (side = 0; side < 2; side++) {
      var sg = side ? -1 : 1, x0 = side ? W : 0;
      for (i = 5; i >= 0; i--) {
        var z1 = i / 6 + 0.02, z2 = z1 + 0.1;
        // banner between pillars
        var bc = HOUSE[(i + side * 2) % 4];
        var p1 = P(x0 + sg * 8, 60, z1 + 0.025), p2 = P(x0 + sg * 8, 60, z2 - 0.01), p3 = P(x0 + sg * 8, 300, z2 - 0.01), p4 = P(x0 + sg * 8, 300, z1 + 0.025);
        quad(p1, p2, p3, p4, bc);
        var em = P(x0 + sg * 8, 150, (z1 + z2) / 2), kk = K((z1 + z2) / 2);
        c.fillStyle = GOLD[(i + side * 2) % 4]; c.beginPath(); c.arc(em[0], em[1], 15 * kk, 0, 6.3); c.fill();
        c.fillStyle = bc; c.beginPath(); c.arc(em[0], em[1], 8.5 * kk, 0, 6.3); c.fill();
        // pillar
        var a1 = P(x0, 0, z1), a2 = P(x0 + sg * 90, 0, z1), a3 = P(x0 + sg * 90, H, z1), a4 = P(x0, H, z1);
        quad(a1, a2, a3, a4, "#0b1224");
        c.fillStyle = "rgba(130,160,220,.2)"; c.fillRect(Math.min(a2[0], a2[0] + sg), a2[1], 1.5 * K(z1), a3[1] - a2[1]);
      }
    }
    // long tables with benches
    function table(xa, xb) {
      var top = 612, edge = 650;
      var tg = c.createLinearGradient(0, 420, 0, H); tg.addColorStop(0, "#2c1b0f"); tg.addColorStop(1, "#4d311c");
      quad(P(xa, top, 1), P(xb, top, 1), P(xb, top, 0), P(xa, top, 0), tg);
      quad(P(xb, top, 0), P(xb, top, 1), P(xb, edge, 1), P(xb, edge, 0), "#1d110a");
      quad(P(xa, top, 0), P(xa, top, 1), P(xa, edge, 1), P(xa, edge, 0), "#150c07");
    }
    function bench(xa, xb) { quad(P(xa, 690, 1), P(xb, 690, 1), P(xb, 690, 0), P(xa, 690, 0), "#120a06"); }
    table(150, 430); table(W - 430, W - 150);
    bench(30, 110); bench(470, 550); bench(W - 550, W - 470); bench(W - 110, W - 30);
    // everyone at supper, far to near
    var SEATS = [60, 490, W - 490, W - 60], ROBE = ["#190d12", "#1a1608", "#0b1228", "#0a1a12", "#12121a"];
    var SKIN = ["#8d6a52", "#a37b5c", "#6b4a38", "#b58d6a", "#7c5a44", "#c09a78"], HAIR = ["#1b120c", "#3a2414", "#0c0a0a", "#6a4524", "#15100c", "#8a6a3a"];
    for (z = 0.97; z >= 0.02; z -= 0.062) {
      var k2 = K(z), j;
      for (j = 0; j < 4; j++) {
        if (r() < 0.07) continue;
        var sx = SEATS[j], pp = P(sx, 520, z), robe = ROBE[(r() * 5) | 0], sk = SKIN[(r() * 6) | 0], hr = HAIR[(r() * 6) | 0];
        var ps = P(sx, 585, z), pb = P(sx, 690, z), sw = 40 * k2;
        c.fillStyle = robe;
        c.beginPath(); c.moveTo(ps[0] - sw, ps[1] + 4 * k2); c.quadraticCurveTo(ps[0], ps[1] - 12 * k2, ps[0] + sw, ps[1] + 4 * k2);
        c.lineTo(ps[0] + sw * 0.85, pb[1]); c.lineTo(ps[0] - sw * 0.85, pb[1]); c.closePath(); c.fill();
        c.fillStyle = "rgba(255,200,130,.18)"; c.fillRect(ps[0] - sw, ps[1] - 4 * k2, sw * 2, 2 * k2);
        c.fillStyle = sk; c.beginPath(); c.arc(pp[0], pp[1], 23 * k2, 0, 6.3); c.fill();
        c.fillStyle = hr; c.beginPath(); c.arc(pp[0], pp[1] - 4 * k2, 24 * k2, Math.PI * 1.02, Math.PI * 1.98); c.fill();
        c.fillStyle = "rgba(255,190,110,.22)"; c.beginPath(); c.arc(pp[0], pp[1] + 6 * k2, 20 * k2, 0.2, 2.9); c.fill();
      }
      // plates and goblets on both tables
      var xs = [190, 390, W - 390, W - 190];
      for (j = 0; j < 4; j++) {
        var pl = P(xs[j], 610, z);
        c.fillStyle = "rgba(240,212,160,.85)"; c.beginPath(); c.ellipse(pl[0], pl[1], 17 * k2, 4.6 * k2, 0, 0, 6.3); c.fill();
        c.fillStyle = "rgba(255,230,170,.9)"; c.fillRect(pl[0] + 22 * k2, pl[1] - 9 * k2, 5 * k2, 9 * k2);
      }
    }
    // the candle light on the tables, then haze toward the back
    for (z = 0.15; z < 1; z += 0.28) {
      var gl = P(290, 612, z), gl2 = P(W - 290, 612, z), gk = K(z);
      [gl, gl2].forEach(function (q) {
        var rg = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], 260 * gk);
        rg.addColorStop(0, "rgba(255,190,100,.22)"); rg.addColorStop(1, "rgba(255,190,100,0)");
        c.fillStyle = rg; c.fillRect(q[0] - 270 * gk, q[1] - 140 * gk, 540 * gk, 280 * gk);
      });
    }
    g = c.createRadialGradient(640, 330, 20, 640, 330, 420);
    g.addColorStop(0, "rgba(90,120,190,.22)"); g.addColorStop(1, "rgba(90,120,190,0)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    g = c.createLinearGradient(0, H * 0.55, 0, H);
    g.addColorStop(0, "rgba(0,0,6,0)"); g.addColorStop(1, "rgba(0,0,6,.5)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    g = c.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.5)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // the floating candles (animated later)
    for (i = 0; i < 38; i++) {
      var cz = r() * 0.95 + 0.02, cxx = 40 + r() * 1200, cyy = 20 + r() * 150;
      var cp = P(cxx, cyy, cz);
      candles.push({ x: cp[0], y: cp[1] + 6, k: K(cz), ph: r() * 6.28, sp: 0.5 + r() * 0.8, fl: r() * 6.28 });
    }
    candles.sort(function (a, b2) { return a.k - b2.k; });
  }

  // ------------------------------------------------------------------ mist and motes
  function mistCanvas(seed, alpha) {
    var c = mk(W, 200, "mist"), x = c.getContext("2d"), r = rng(seed), i;
    for (i = 0; i < 26; i++) {
      var cx = r() * W, cy = 60 + r() * 90, rw = 140 + r() * 260, a = alpha * (0.5 + r() * 0.7);
      [-W, 0, W].forEach(function (off) {
        var g = x.createRadialGradient(cx + off, cy, 0, cx + off, cy, rw);
        g.addColorStop(0, "rgba(150,175,220," + a + ")"); g.addColorStop(1, "rgba(150,175,220,0)");
        x.save(); x.translate(cx + off, cy); x.scale(1, 0.26); x.translate(-(cx + off), -cy);
        x.fillStyle = g; x.fillRect(cx + off - rw, cy - rw, rw * 2, rw * 2); x.restore();
      });
    }
    return c;
  }

  // ------------------------------------------------------------------ the animated layers
  function fxCastle(t) {
    var c = ctxC, i;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W * FX, H * FX); c.setTransform(FX, 0, 0, FX, 0, 0);
    // the moon breathes
    c.globalAlpha = 0.1 + 0.05 * Math.sin(t * 0.0006);
    c.drawImage(glowSprite, 330 - 130, 150 - 130, 260, 260);
    c.globalAlpha = 1;
    if (!photo.castle) {
      for (i = 0; i < stars.length; i++) {
        var s = stars[i], a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.sp + s.ph));
        c.fillStyle = "rgba(235,242,255," + (a * 0.9) + ")"; c.fillRect(s.x - 1, s.y - 1, 2.2, 2.2);
      }
      for (i = 0; i < wins.length; i++) {
        var w = wins[i], f = 0.62 + 0.38 * (0.5 + 0.5 * Math.sin(t * 0.001 * w.sp + w.ph)) * (0.55 + 0.45 * Math.sin(t * 0.001 * w.sp2 + w.ph2));
        c.globalAlpha = 0.5 * f; c.drawImage(glowSprite, w.x - 15, w.y - 17, 30, 30);
        c.globalAlpha = 0.5 + 0.5 * f; c.fillStyle = "rgb(255,196,104)"; c.fillRect(w.x - 1.8, w.y - 3.6, 3.6, 7); c.fillStyle = "rgb(255,236,170)"; c.fillRect(w.x - 0.9, w.y - 2.6, 1.8, 3);
      }
      c.globalAlpha = 1;
      // glints on the lake
      for (i = 0; i < 34; i++) {
        var gy = 556 + ((i * 53) % 150), gx = 120 + ((i * 197) % 1040);
        var ga = 0.5 + 0.5 * Math.sin(t * 0.0013 + i * 1.7);
        if (ga < 0.55) continue;
        c.fillStyle = (gx > 560 && gx < 1120 ? "rgba(255,205,130," : "rgba(190,215,255,") + (0.55 * (ga - 0.5) * 2) + ")";
        c.fillRect(gx - 5 - (i % 4) * 2, gy, 10 + (i % 4) * 4, 1.4);
      }
      // sparkles on the spires
      for (i = 0; i < spires.length; i++) {
        var sp = spires[i], pa = Math.sin(t * 0.0011 + i * 2.1);
        if (pa < 0.35) continue;
        var q = (pa - 0.35) / 0.65 * 7;
        c.fillStyle = "rgba(255,240,200," + (0.4 + pa * 0.4) + ")";
        c.fillRect(sp.x - q, sp.y - 0.7, q * 2, 1.4); c.fillRect(sp.x - 0.7, sp.y - q, 1.4, q * 2);
      }
      // a shooting star now and then, never over the castle
      if (!shoot && t > nextShoot) shoot = { t0: t, x: 120 + Math.random() * 300, y: 40 + Math.random() * 100 };
      if (shoot) {
        var u = (t - shoot.t0) / 900;
        if (u >= 1) { shoot = null; nextShoot = t + 15000 + Math.random() * 15000; }
        else {
          var hx = shoot.x + u * 260, hy = shoot.y + u * 110;
          var tg = c.createLinearGradient(hx - 90, hy - 38, hx, hy);
          tg.addColorStop(0, "rgba(255,255,255,0)"); tg.addColorStop(1, "rgba(255,255,255," + (0.9 * (1 - u)) + ")");
          c.strokeStyle = tg; c.lineWidth = 1.6; c.beginPath(); c.moveTo(hx - 90, hy - 38); c.lineTo(hx, hy); c.stroke();
        }
      }
    }
    // gold motes drifting up
    for (i = 0; i < motes.length; i++) {
      var m = motes[i], yy = (m.y - t * 0.012 * m.v) % (H + 40); if (yy < 0) yy += H + 40;
      var xx = m.x + Math.sin(t * 0.0004 * m.v + m.ph) * 22, aa = (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(t * 0.002 * m.v + m.ph))) * m.a;
      c.globalAlpha = aa; c.drawImage(flameSprite, xx - m.s, yy - 40 - m.s, m.s * 2, m.s * 2);
    }
    c.globalAlpha = 1;
  }
  function fxHall(t) {
    var c = ctxH, i;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W * FX, H * FX); c.setTransform(FX, 0, 0, FX, 0, 0);
    for (i = 0; i < candles.length; i++) {
      var d = candles[i], by = Math.sin(t * 0.001 * d.sp + d.ph) * 5 * d.k, k = d.k;
      var fl = 0.78 + 0.22 * Math.sin(t * 0.011 + d.fl) * Math.sin(t * 0.0073 + d.fl * 2);
      c.globalAlpha = 0.55 * fl; c.drawImage(glowSprite, d.x - 46 * k, d.y + by - 62 * k, 92 * k, 92 * k);
      c.globalAlpha = 1;
      c.fillStyle = "#e9dcc0"; c.fillRect(d.x - 2.2 * k, d.y + by - 4 * k, 4.4 * k, 20 * k);
      c.fillStyle = "rgba(255,150,60," + (0.9 * fl) + ")"; c.beginPath(); c.ellipse(d.x, d.y + by - 9 * k, 3 * k, 6.5 * k * fl, 0, 0, 6.3); c.fill();
      c.fillStyle = "rgba(255,240,190," + fl + ")"; c.beginPath(); c.ellipse(d.x, d.y + by - 8 * k, 1.4 * k, 3.4 * k * fl, 0, 0, 6.3); c.fill();
    }
    for (i = 0; i < motes.length; i += 2) {
      var m = motes[i], yy = (m.y - t * 0.01 * m.v) % (H + 40); if (yy < 0) yy += H + 40;
      c.globalAlpha = m.a * 0.6; c.drawImage(flameSprite, m.x - m.s + Math.sin(t * 0.0004 * m.v + m.ph) * 22, yy - 40 - m.s, m.s * 2, m.s * 2);
    }
    c.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ the owl
  var OWL_SVG =
    '<svg viewBox="0 0 120 120" width="100%" height="100%" overflow="visible">' +
    '<defs><radialGradient id="ob" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe6f2"/></radialGradient></defs>' +
    '<g id="ow-wl" opacity="0"><path d="M46 56 C22 34 -10 32 -38 50 C-22 54 -12 62 -8 74 C4 66 14 72 22 84 C32 74 40 74 46 68 Z" fill="#f4f7fc" stroke="#c9d2e2" stroke-width="1.2"/><path d="M-30 50 C-12 52 0 60 6 72 M-14 40 C0 44 14 54 22 66" stroke="#c3cde0" stroke-width="1" fill="none"/></g>' +
    '<g id="ow-wr" opacity="0"><g transform="translate(120 0) scale(-1 1)"><path d="M46 56 C22 34 -10 32 -38 50 C-22 54 -12 62 -8 74 C4 66 14 72 22 84 C32 74 40 74 46 68 Z" fill="#f4f7fc" stroke="#c9d2e2" stroke-width="1.2"/><path d="M-30 50 C-12 52 0 60 6 72 M-14 40 C0 44 14 54 22 66" stroke="#c3cde0" stroke-width="1" fill="none"/></g></g>' +
    '<path d="M44 96 L40 114 L52 108 L60 116 L68 108 L80 114 L76 96 Z" fill="#e3e9f4"/>' +
    '<ellipse cx="60" cy="68" rx="27" ry="35" fill="url(#ob)"/>' +
    '<path d="M44 52 C38 70 40 92 48 102 C54 98 56 80 54 60 Z" fill="#eef2f9" stroke="#cfd7e6" stroke-width="1" id="ow-fl"/>' +
    '<path d="M76 52 C82 70 80 92 72 102 C66 98 64 80 66 60 Z" fill="#eef2f9" stroke="#cfd7e6" stroke-width="1" id="ow-fr"/>' +
    '<g stroke="#c1cadb" stroke-width="1.3" stroke-linecap="round" fill="none"><path d="M54 78l3 4M62 82l3 4M58 90l3 4M66 76l3 4M50 88l3 4M68 90l3 4M56 70l3 3"/></g>' +
    '<circle cx="60" cy="40" r="24" fill="url(#ob)"/>' +
    '<g stroke="#c1cadb" stroke-width="1.2" stroke-linecap="round" fill="none"><path d="M46 28l3 3M70 27l-3 3M60 20v4M52 22l2 3M68 22l-2 3"/></g>' +
    '<circle cx="50.5" cy="40" r="6.4" fill="#f2b81c"/><circle cx="69.5" cy="40" r="6.4" fill="#f2b81c"/>' +
    '<circle cx="50.5" cy="40" r="3" fill="#111"/><circle cx="69.5" cy="40" r="3" fill="#111"/>' +
    '<circle cx="51.6" cy="38.8" r="1" fill="#fff"/><circle cx="70.6" cy="38.8" r="1" fill="#fff"/>' +
    '<g id="ow-lid" style="transform-origin:60px 40px;transform:scaleY(0)"><rect x="42" y="32" width="36" height="16" rx="7" fill="#f4f7fc"/></g>' +
    '<path d="M57 46 L63 46 L60 54 Z" fill="#3b3f46"/>' +
    '<path d="M47 108 l-2 6 M52 108 l0 7 M57 108 l2 6 M63 108 l-2 6 M68 108 l0 7 M73 108 l2 6" stroke="#3b3f46" stroke-width="1.6" stroke-linecap="round"/>' +
    '</svg>';

  var owl = { moved: 0, x: 0, y: 0, fx: 0, fy: 0, tx: 0, ty: 0, t0: 0, dur: 0, air: false, ready: false, vis: false, dir: 0, el: null, blinkAt: 0 };
  var rem = 16, owlW = 0, owlH = 0, wl, wr, lid, remeasure = 0;
  function sizes() {
    rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    owlH = rem * 6.2; owlW = owlH;
    owlEl.style.width = owlW + "px"; owlEl.style.height = owlH + "px";
  }
  function point(el, final) {
    var r = el.getBoundingClientRect(), cx = r.left + r.width / 2, top = r.top;
    if (!final) {
      var cl = el.className || "";
      if (/\bapp\b/.test(cl)) top -= r.height * 0.08 + rem * 0.625;
      else if (/\bncard\b/.test(cl)) top -= r.height * 0.025;
      else if (/\bqbtn\b/.test(cl)) top -= r.height * 0.03;
      else top -= r.height * 0.04;
    }
    return { x: cx, y: top + 3 };
  }
  function place(x, y) {
    owl.x = x; owl.y = y;
  }
  function sparkle(x, y) {
    for (var i = 0; i < 7; i++) {
      var s = document.createElement("i");
      s.className = "owl-spark";
      s.style.left = x + "px"; s.style.top = y + "px";
      owlEl.parentNode.appendChild(s);
      (function (el, k) {
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            el.style.transform = "translate(" + ((k - 3) * 11 + (Math.random() - 0.5) * 8) + "px," + (-10 - Math.random() * 26) + "px) scale(.2)";
            el.style.opacity = "0";
          });
        });
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 800);
      })(s, i);
    }
  }
  var scene = { moving: false, pending: null, t: 0 };
  // After the view has scrolled between the castle and the hall, the owl swoops in from above.
  function arrive(el) {
    var p = point(el, true);
    owl.el = el; owl.vis = true; owl.ready = true;
    owl.x = p.x; owl.y = -owlH;
    owl.fx = p.x; owl.fy = -owlH; owl.tx = p.x; owl.ty = p.y;
    owl.dir = 0; owl.dur = 800; owl.arc = 24; owl.crouch = 0; owl.air = true; owl.t0 = performance.now(); owl.moved = owl.t0;
    owlEl.style.opacity = "1";
  }
  function perch(el) {
    if (!owlEl) return;
    if (!el) { scene.pending = null; owl.vis = false; owl.el = null; owlEl.style.opacity = "0"; return; }
    if (scene.moving) { scene.pending = el; return; }
    if (el === owl.el && owl.vis) {
      // the layout can shift under a settled owl (apps arriving, a list growing): follow it
      if (!owl.air && performance.now() - owl.moved > 600) {
        var q = point(el, true);
        if (Math.abs(q.x - owl.x) > 1.5 || Math.abs(q.y - owl.y) > 1.5) place(q.x, q.y);
      }
      return;
    }
    var p = point(el, false);
    owl.el = el; owl.moved = performance.now();
    if (!owl.ready || !owl.vis) {
      owl.vis = true; owl.ready = true; owl.air = false;
      place(p.x, p.y); owlEl.style.opacity = "1";
    } else {
      var dx = p.x - owl.x, dy = p.y - owl.y, dist = Math.sqrt(dx * dx + dy * dy);
      owl.fx = owl.x; owl.fy = owl.y; owl.tx = p.x; owl.ty = p.y;
      owl.dir = dx < 0 ? -1 : 1;
      owl.dur = Math.max(520, Math.min(1000, 460 + dist * 0.45));
      owl.arc = Math.max(34, Math.min(170, dist * 0.2));
      owl.t0 = performance.now();
      owl.crouch = owl.air ? 0 : 1;
      owl.air = true;
    }
    clearTimeout(remeasure);
    remeasure = setTimeout(function () {
      if (owl.el === el && el.getBoundingClientRect) {
        var q = point(el, true);
        if (owl.air) { owl.tx = q.x; owl.ty = q.y; } else { place(q.x, q.y); }
      }
    }, 340);
  }
  function ease(u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; }
  function owlFrame(now) {
    if (!owl.vis) return;
    var sx = 1, sy = 1, rot = 0, flap = 0, ox = owl.x, oy = owl.y;
    if (owl.air) {
      var u = (now - owl.t0) / owl.dur;
      if (u >= 1) {
        owl.air = false; owl.x = owl.tx; owl.y = owl.ty; ox = owl.x; oy = owl.y;
        sparkle(ox, oy - rem);
        owl.land = now;
      } else {
        var cr = owl.crouch ? 0.14 : 0, e;
        if (u < cr) { var cu = u / cr; sy = 1 - 0.14 * cu; sx = 1 + 0.07 * cu; ox = owl.fx; oy = owl.fy; }
        else {
          e = ease((u - cr) / (1 - cr));
          ox = owl.fx + (owl.tx - owl.fx) * e;
          oy = owl.fy + (owl.ty - owl.fy) * e - owl.arc * Math.sin(Math.PI * e);
          rot = owl.dir * 14 * Math.sin(Math.PI * e);
          flap = Math.sin((now - owl.t0) * 0.034);
          owl.x = ox; owl.y = oy;
          // keep the old position in fx/fy fixed; only the display position moves
          owl.px = ox; owl.py = oy;
        }
      }
    }
    if (!owl.air) {
      var lu = owl.land ? (now - owl.land) / 320 : 1;
      if (lu < 1) { sy = 1 - 0.1 * Math.sin(Math.PI * lu) * (1 - lu); sx = 1 + 0.05 * Math.sin(Math.PI * lu); }
      else { var br = 0.012 * Math.sin(now * 0.0016); sy = 1 + br; sx = 1 - br * 0.5; }
      if (now > owl.blinkAt) {
        lid.style.transform = "scaleY(1)";
        setTimeout(function () { lid.style.transform = "scaleY(0)"; }, 130);
        owl.blinkAt = now + 2600 + Math.random() * 3800;
      }
    }
    var wing = owl.air && flap !== 0 ? 1 : 0;
    wl.setAttribute("opacity", wing); wr.setAttribute("opacity", wing);
    if (wing) {
      var a = flap * 32 - 8;
      wl.setAttribute("transform", "rotate(" + a + " 46 56)");
      wr.setAttribute("transform", "rotate(" + (-a) + " 74 56)");
    }
    owlEl.style.transform = "translate3d(" + (ox - owlW / 2) + "px," + (oy - owlH * 0.93) + "px,0) rotate(" + rot + "deg) scale(" + sx + "," + sy + ")";
  }

  // ------------------------------------------------------------------ set up
  function tryPhoto(src, canvas, key) {
    var im = new Image();
    im.onload = function () {
      var c = canvas.getContext("2d"), s = Math.max(W / im.width, H / im.height);
      c.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s);
      photo[key] = true;
    };
    im.src = src;   // a missing file just stays silent
  }
  function loop(now) {
    requestAnimationFrame(loop);
    owlFrame(now);
    if (document.hidden) return;
    var dt = now - lastFx;
    if (dt < 40) return;
    lastFx = now;
    if (both > 0) both -= dt;
    if (!hallOn || both > 0) {
      fxCastle(now);
      var v = window.innerWidth;
      mist1.style.transform = "translate3d(" + (-((now * 0.007) % v)) + "px,0,0)";
      mist2.style.transform = "translate3d(" + (-((now * 0.0125) % v)) + "px,0,0)";
    }
    if (hallOn || both > 0) fxHall(now);
  }
  function init() {
    if (world) return;
    var body = document.body;
    world = document.createElement("div"); world.id = "cworld"; world.setAttribute("aria-hidden", "true");
    sCastle = mk(W, H, "cl cs"); sHall = mk(W, H, "cl hs");
    fCastle = mk(W * FX, H * FX, "cl cf"); fHall = mk(W * FX, H * FX, "cl hf");
    ctxC = fCastle.getContext("2d"); ctxH = fHall.getContext("2d");
    var m1 = document.createElement("div"), m2 = document.createElement("div");
    m1.className = "mistwrap m1"; m2.className = "mistwrap m2";
    mist1 = m1; mist2 = m2;
    var ca = mistCanvas(4, 0.11), cb = mistCanvas(9, 0.09);
    m1.appendChild(ca); m1.appendChild(ca.cloneNode(false)); m2.appendChild(cb); m2.appendChild(cb.cloneNode(false));
    world.appendChild(sCastle); world.appendChild(m1); world.appendChild(m2); world.appendChild(fCastle);
    world.appendChild(sHall); world.appendChild(fHall);
    body.insertBefore(world, body.firstChild);
    // the cloned canvases are empty: copy the mist into them
    [m1, m2].forEach(function (w, i) {
      var src = i ? cb : ca, kids = w.children;
      kids[1].getContext("2d").drawImage(src, 0, 0);
    });
    glowSprite = sprite(64, [[0, "rgba(255,190,100,.9)"], [0.4, "rgba(255,160,70,.28)"], [1, "rgba(255,150,60,0)"]]);
    flameSprite = sprite(32, [[0, "rgba(255,236,170,1)"], [0.35, "rgba(255,200,110,.55)"], [1, "rgba(255,190,90,0)"]]);
    var r = rng(5), i;
    for (i = 0; i < 38; i++) motes.push({ x: r() * W, y: r() * (H + 40), v: 0.5 + r() * 1.3, ph: r() * 6.28, s: 2.5 + r() * 4, a: 0.35 + r() * 0.65 });
    drawCastle(sCastle.getContext("2d"));
    drawHall(sHall.getContext("2d"));
    tryPhoto("castle/castle.jpg", sCastle, "castle");
    tryPhoto("castle/hall.jpg", sHall, "hall");
    // the owl and the hint under the dock
    owlEl = document.createElement("div"); owlEl.id = "owl"; owlEl.setAttribute("aria-hidden", "true");
    owlEl.innerHTML = OWL_SVG;
    body.appendChild(owlEl);
    wl = owlEl.querySelector("#ow-wl"); wr = owlEl.querySelector("#ow-wr"); lid = owlEl.querySelector("#ow-lid");
    hintEl = document.createElement("div"); hintEl.id = "chint"; hintEl.setAttribute("aria-hidden", "true");
    body.appendChild(hintEl);
    hall(false);
    sizes();
    window.addEventListener("resize", sizes);
    requestAnimationFrame(loop);
  }
  function hall(on) {
    var changed = !!on !== hallOn;
    hallOn = !!on;
    both = 1100;
    if (changed && owlEl) {
      scene.moving = true; owl.vis = false; owlEl.style.opacity = "0";
      clearTimeout(scene.t);
      scene.t = setTimeout(function () {
        scene.moving = false;
        var el = scene.pending || owl.el;
        scene.pending = null;
        if (el && document.body.contains(el)) arrive(el);
      }, 780);
    }
    if (hintEl) hintEl.innerHTML = hallOn ? "<span>&#8593;</span> The Castle" : "The Great Hall <span>&#8595;</span>";
  }

  window.CASTLE = { init: init, hall: hall, perch: perch };
})();
