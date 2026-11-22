/* Lógica compartida por la central y la app del alumno:
   reloj, viajes del día, posición estimada, ocupación y sincronización de check-ins. */
(function () {
  "use strict";
  var CAP = 44;                       // bus estándar 44+1 (supuesto conservador; también hay 48+1)
  var H = window.HORARIOS, S = window.SERVICIOS, MAPAS = window.MAPAS;

  /* ---------- reloj (hora real del computador, con override opcional ?hora=HH:MM&dia=N) ---------- */
  var qs = new URLSearchParams(location.search);
  var offsetMs = 0, diaForzado = null;
  if (qs.get("hora")) {
    var p = qs.get("hora").split(":"), d = new Date();
    var objetivo = new Date(d.getFullYear(), d.getMonth(), d.getDate(), +p[0], +(p[1] || 0), 0);
    offsetMs = objetivo - d;
  }
  if (qs.get("dia")) diaForzado = +qs.get("dia");
  function ahora() { return new Date(Date.now() + offsetMs); }
  function minDelDia(d) { d = d || ahora(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60000; }
  /* 1 = lunes ... 6 = sábado. Fin de semana = "modo ensayo": se usa el horario del lunes para poder practicar. */
  function diaReal() { var w = ahora().getDay(); return w === 0 ? 7 : w; }
  function ensayo() { return !diaForzado && diaReal() >= 6; }
  function diaSemana() { return diaForzado || (ensayo() ? 1 : diaReal()); }
  function inicioDelDiaMs() { var d = ahora(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - offsetMs; }
  function fmt(m) { m = Math.round(m); var h = Math.floor(m / 60) % 24, mm = ((m % 60) + 60) % 60; return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); }
  function hash(a, b) { return (((a * 2654435761) ^ (b * 40503)) >>> 0) % 1000 / 1000; }

  /* ---------- viajes del día ---------- */
  function horarioDe(serv, dia) {
    var h = H[serv.ruta];
    if (serv.campus === "PEN") return dia <= 5 ? h[serv.dir] : "";
    return h[dia] || "";
  }
  var cacheDia = null, cacheViajes = [];
  function viajesHoy() {
    var dia = diaSemana();
    if (cacheDia === dia) return cacheViajes;
    var out = [];
    Object.keys(S).forEach(function (k, si) {
      var s = S[k];
      (horarioDe(s, dia).match(/\d\d:\d\dx\d+/g) || []).forEach(function (tok) {
        var hh = +tok.slice(0, 2), mm = +tok.slice(3, 5), n = +tok.split("x")[1], dep = hh * 60 + mm;
        for (var j = 1; j <= n; j++) {
          var sube = s.dir === "S";
          var dem = sube ? 0.25 + 0.7 * Math.exp(-Math.pow((dep - 470) / 55, 2)) : 0.25 + 0.65 * Math.exp(-Math.pow((dep - 1060) / 70, 2));
          var occ = Math.max(0.08, Math.min(0.97, dem * (0.85 + 0.3 * hash(dep * 7 + j, si + 3)) - 0.06 * (j - 1)));
          out.push({ id: s.ruta + "-" + s.dir + "-" + tok.slice(0, 2) + tok.slice(3, 5) + "-" + j, serv: k, dep: dep, occBase: occ, n: j });
        }
      });
    });
    cacheDia = dia; cacheViajes = out; return out;
  }

  function duracion(v) { return S[v.serv].dur; }
  function todos() { return viajesHoy(); }

  /* ---------- posición sobre el trazado ---------- */
  function fraccion(v, m) { return (m - v.dep) / duracion(v); }
  function puntoEn(serv, f) {
    var s = S[serv], tot = s.cum[s.cum.length - 1], d = Math.max(0, Math.min(1, f)) * tot;
    for (var i = 1; i < s.px.length; i++) {
      if (d <= s.cum[i]) { var t = (d - s.cum[i - 1]) / ((s.cum[i] - s.cum[i - 1]) || 1); return [s.px[i - 1][0] + (s.px[i][0] - s.px[i - 1][0]) * t, s.px[i - 1][1] + (s.px[i][1] - s.px[i - 1][1]) * t]; }
    }
    return s.px[s.px.length - 1];
  }
  function fracParada(serv, k) { var s = S[serv]; return s.cum[s.si[k]] / s.cum[s.cum.length - 1]; }
  function llegadaA(v, k) { return v.dep + fracParada(v.serv, k) * duracion(v); }
  function enRuta(m) { m = m == null ? minDelDia() : m; return todos().filter(function (v) { var f = fraccion(v, m); return f >= 0 && f <= 1; }); }

  /* ---------- ocupación: base simulada + check-ins reales ---------- */
  var checkins = [];                   // {bus, t, dev}
  function checkinsDe(id) { var n = 0; for (var i = 0; i < checkins.length; i++) if (checkins[i].bus === id) n++; return n; }
  function ocupacion(v, m) {
    var f = Math.max(0, Math.min(1, fraccion(v, m == null ? minDelDia() : m)));
    var base = S[v.serv].dir === "S" ? v.occBase * (0.3 + 0.7 * Math.min(1, f * 1.4)) : v.occBase * (1 - 0.6 * f);
    var pas = Math.min(CAP, Math.round(base * CAP) + checkinsDe(v.id));   // nunca más de 44
    return { pasajeros: pas, cupos: CAP - pas, frac: pas / CAP, lleno: pas >= CAP };
  }
  /* Buses de un recorrido que aún no pasan por el paradero k, ordenados por hora de llegada. */
  function proximosEn(serv, k, m) {
    m = m == null ? minDelDia() : m;
    return viajesHoy().filter(function (v) { return v.serv === serv && llegadaA(v, k) >= m - 1; })
      .map(function (v) { return { v: v, a: llegadaA(v, k) }; })
      .sort(function (x, y) { return x.a - y.a; });
  }
  /* Primer bus del día siguiente en ese paradero (para mostrarlo cuando ya no quedan buses hoy). */
  function primeroManana(serv, k) {
    var s = S[serv], dia = diaSemana(), sig = dia >= 5 ? 1 : dia + 1;     // vie/sáb/dom -> lunes
    var h = s.campus === "PEN" ? H[s.ruta][s.dir] : (H[s.ruta][sig] || "");
    var tok = (h.match(/\d\d:\d\d/) || [])[0];
    if (!tok) return null;
    var dep = +tok.slice(0, 2) * 60 + +tok.slice(3, 5);
    return dep + fracParada(serv, k) * s.dur;
  }
  function color(fr) { return fr < 0.6 ? "#2e9e5b" : fr <= 0.85 ? "#e3a21a" : "#d64545"; }

  /* ---------- sincronización: Firebase Realtime Database o modo local ---------- */
  var oyentes = { checkin: [], estado: [] };
  function emitir(tipo, x) { oyentes[tipo].forEach(function (f) { f(x); }); }
  var SYNC = { modo: "local", conectado: false };
  var bc = ("BroadcastChannel" in window) ? new BroadcastChannel("uai-buses") : null;
  var dev = (function () { try { var d = localStorage.getItem("uai_dev"); if (!d) { d = Math.random().toString(36).slice(2, 8); localStorage.setItem("uai_dev", d); } return d; } catch (e) { return "anon"; } })();

  function agregarCheckin(c) {
    if (c.t < inicioDelDiaMs()) return;
    for (var i = 0; i < checkins.length; i++) if (checkins[i].key && checkins[i].key === c.key) return;
    checkins.push(c); emitir("checkin", c);
  }
  function cargarLocal() {
    try { (JSON.parse(localStorage.getItem("uai_checkins") || "[]")).forEach(agregarCheckin); } catch (e) {}
    if (bc) bc.onmessage = function (e) { if (e.data.tipo === "checkin") agregarCheckin(e.data.c); };
    SYNC.conectado = true; emitir("estado", SYNC);
  }
  function guardarLocal() { try { localStorage.setItem("uai_checkins", JSON.stringify(checkins.slice(-500))); } catch (e) {} }

  var db = null;
  function iniciarFirebase(cfg) {
    var base = "https://www.gstatic.com/firebasejs/10.12.2/";
    cargarScript(base + "firebase-app-compat.js", function () {
      cargarScript(base + "firebase-database-compat.js", function () {
        try {
          firebase.initializeApp(cfg); db = firebase.database(); SYNC.modo = "firebase";
          db.ref(".info/connected").on("value", function (s) { SYNC.conectado = !!s.val(); emitir("estado", SYNC); });
          db.ref("checkins").orderByChild("t").startAt(inicioDelDiaMs()).on("child_added", function (s) { var c = s.val(); c.key = s.key; agregarCheckin(c); });
        } catch (e) { console.error(e); SYNC.modo = "local"; cargarLocal(); }
      }, function () { SYNC.modo = "local"; cargarLocal(); });
    }, function () { SYNC.modo = "local"; cargarLocal(); });
  }
  function cargarScript(src, ok, err) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = err; document.head.appendChild(s); }

  /* Registra un check-in en un bus concreto (la app decide a qué bus y revisa que no esté lleno). */
  SYNC.checkin = function (id) {
    var c = { bus: id, t: Date.now(), dev: dev };
    if (db) { db.ref("checkins").push({ bus: id, t: firebase.database.ServerValue.TIMESTAMP, dev: dev }); }
    else { c.key = dev + "-" + c.t + "-" + Math.random().toString(36).slice(2, 6); agregarCheckin(c); guardarLocal(); if (bc) bc.postMessage({ tipo: "checkin", c: c }); }
    return id;
  };
  SYNC.on = function (tipo, f) {
    oyentes[tipo].push(f);
    if (tipo === "estado") f(SYNC);            // entrega el estado actual a quien se suscribe tarde
  };

  if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.databaseURL) iniciarFirebase(window.FIREBASE_CONFIG);
  else cargarLocal();

  window.UAI = {
    CAP: CAP, S: S, MAPAS: MAPAS, ahora: ahora, minDelDia: minDelDia, diaSemana: diaSemana, ensayo: ensayo, fmt: fmt,
    viajesHoy: viajesHoy, todos: todos, enRuta: enRuta, fraccion: fraccion, puntoEn: puntoEn, duracion: duracion,
    llegadaA: llegadaA, fracParada: fracParada, ocupacion: ocupacion, color: color, proximosEn: proximosEn, primeroManana: primeroManana,
    checkinsDe: checkinsDe, offsetMs: offsetMs, checkins: function () { return checkins; }, SYNC: SYNC, dev: dev
  };
})();
