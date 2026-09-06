// ============ CONFIGURAZIONE ============
const TARGET_DOMANDE = 60;
const ERRORI_MAX_PROMOSSO = 2;
const AUTO_ADVANCE_MS = 700; // ritardo prima di passare alla domanda successiva se la risposta è corretta
const LS_KEY_HISTORY = "quizIstruttore_history";
const LS_KEY_ERRORS = "quizIstruttore_errorStats";
const LS_KEY_TOPICS = "quizIstruttore_topicStats";
const LS_KEY_SESSIONE = "quizIstruttore_sessioneInCorso";

// ============ STATO ============
let allQuestions = [];
let categoriaScelta = "B";
let sessione = null; // { domande, indice, errori, risposte:[], categoria, modalita, iniziata }
let autoAdvanceTimer = null;

// ============ UTILS STORAGE ============
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function saveJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
}

// ============ PERSISTENZA SESSIONE IN CORSO ============
// Salva lo stato della scheda in corso così, se l'app viene sospesa o si
// cambia sezione, la scheda non viene persa finché non è completata.
function salvaSessionePersistita() {
  if (!sessione) return;
  saveJSON(LS_KEY_SESSIONE, sessione);
}
function cancellaSessionePersistita() {
  try { localStorage.removeItem(LS_KEY_SESSIONE); } catch (e) {}
}
function ripristinaSessioneSalvata() {
  const salvata = loadJSON(LS_KEY_SESSIONE, null);
  if (salvata && salvata.domande && salvata.indice < salvata.domande.length) {
    sessione = salvata;
  }
}

function sessioneInCorso() {
  return sessione && sessione.indice < sessione.domande.length;
}

// ============ CARICAMENTO DOMANDE ============
async function loadQuestions() {
  const res = await fetch("data/questions.json");
  allQuestions = await res.json();
  const totDisponibili = allQuestions.length;
  document.getElementById("home-tot-domande").textContent = Math.min(TARGET_DOMANDE, totDisponibili);
  ripristinaSessioneSalvata();
  aggiornaBottoneHome();
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function filtraPerCategoria(cat) {
  if (cat === "ALL") return allQuestions;
  return allQuestions.filter(q => q.categoria.includes(cat));
}

// ============ NAVIGAZIONE VISTE ============
function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById("view-" + name).classList.add("active");
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  if (name === "stats") renderStats();
  if (name === "errori") renderErrori();
  if (name === "home") aggiornaBottoneHome();
}

document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});

// ============ HOME: bottone "riprendi" se c'è una scheda in corso ============
function aggiornaBottoneHome() {
  const btn = document.getElementById("btn-start");
  if (sessioneInCorso()) {
    btn.textContent = `Riprendi la scheda (domanda ${sessione.indice + 1}/${sessione.domande.length})`;
  } else {
    btn.textContent = "Inizia simulazione";
  }
}

// ============ SELETTORE CATEGORIA ============
document.getElementById("cat-control").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  categoriaScelta = btn.dataset.cat;
  document.querySelectorAll("#cat-control button").forEach(b => b.classList.toggle("active", b === btn));
  const disp = filtraPerCategoria(categoriaScelta).length;
  document.getElementById("home-tot-domande").textContent = Math.min(TARGET_DOMANDE, disp);
});

document.getElementById("btn-goto-errori").addEventListener("click", () => showView("errori"));

// ============ AVVIO / RIPRESA SIMULAZIONE ============
document.getElementById("btn-start").addEventListener("click", () => {
  if (sessioneInCorso()) {
    showView("quiz");
    renderDomanda();
  } else {
    avviaSimulazione();
  }
});
document.getElementById("btn-retry").addEventListener("click", avviaSimulazione);

function avviaSimulazione() {
  const pool = filtraPerCategoria(categoriaScelta);
  if (pool.length === 0) {
    alert("Nessuna domanda disponibile per questa categoria. Aggiungi domande a data/questions.json.");
    return;
  }
  const n = Math.min(TARGET_DOMANDE, pool.length);
  const domande = shuffle(pool).slice(0, n);
  sessione = {
    domande,
    indice: 0,
    errori: 0,
    risposte: [],
    categoria: categoriaScelta,
    modalita: "esame",
    iniziata: Date.now()
  };
  salvaSessionePersistita();
  showView("quiz");
  renderDomanda();
}

// ============ RIPASSO ERRORI: avvia una scheda con le sole domande sbagliate ============
document.getElementById("btn-ripassa-errori").addEventListener("click", avviaRipasso);

function avviaRipasso() {
  const errors = loadJSON(LS_KEY_ERRORS, {});
  const domande = Object.values(errors).map(err => ({
    id: err.id,
    argomento: err.argomento,
    domanda: err.domanda,
    immagine: err.immagine,
    risposta: err.risposta,
    categoria: ["A", "B"] // le domande di ripasso non vanno filtrate per categoria
  }));
  if (domande.length === 0) {
    alert("Non hai ancora errori salvati da ripassare.");
    return;
  }
  sessione = {
    domande: shuffle(domande),
    indice: 0,
    errori: 0,
    risposte: [],
    categoria: "ripasso",
    modalita: "ripasso",
    iniziata: Date.now()
  };
  salvaSessionePersistita();
  showView("quiz");
  renderDomanda();
}

// ============ MOTORE QUIZ ============
function renderDomanda() {
  clearTimeout(autoAdvanceTimer);
  const q = sessione.domande[sessione.indice];
  const totale = sessione.domande.length;
  const etichettaModalita = sessione.modalita === "ripasso" ? "Ripasso" : "Domanda";
  document.getElementById("quiz-progress").textContent = `${etichettaModalita} ${sessione.indice + 1} / ${totale}`;

  const errEl = document.getElementById("quiz-errors");
  if (sessione.modalita === "ripasso") {
    errEl.textContent = `Corrette: ${sessione.indice - sessione.errori} / ${sessione.indice}`;
    errEl.className = "quiz-errors ok";
  } else {
    errEl.textContent = `Errori: ${sessione.errori} / ${ERRORI_MAX_PROMOSSO}`;
    errEl.className = "quiz-errors " + (sessione.errori >= ERRORI_MAX_PROMOSSO ? "warn" : "ok");
  }
  document.getElementById("progress-fill").style.width = ((sessione.indice) / totale * 100) + "%";

  document.getElementById("q-topic").textContent = q.argomento || "Generale";
  document.getElementById("q-text").textContent = q.domanda;

  const img = document.getElementById("q-image");
  if (q.immagine) {
    img.src = q.immagine;
    img.style.display = "block";
  } else {
    img.style.display = "none";
  }

  const vero = document.getElementById("btn-vero");
  const falso = document.getElementById("btn-falso");
  [vero, falso].forEach(b => { b.disabled = false; b.classList.remove("correct", "wrong"); });
  document.getElementById("feedback-note").textContent = "";
  document.getElementById("btn-next").classList.remove("show");

  salvaSessionePersistita();
}

function rispondi(valoreScelto) {
  const q = sessione.domande[sessione.indice];
  const corretto = valoreScelto === q.risposta;
  const vero = document.getElementById("btn-vero");
  const falso = document.getElementById("btn-falso");
  vero.disabled = true;
  falso.disabled = true;

  const btnScelto = valoreScelto ? vero : falso;
  const btnCorretto = q.risposta ? vero : falso;
  btnScelto.classList.add(corretto ? "correct" : "wrong");
  if (!corretto) btnCorretto.classList.add("correct");

  document.getElementById("feedback-note").textContent = corretto
    ? "Risposta corretta."
    : `Risposta sbagliata. La risposta corretta è ${q.risposta ? "VERO" : "FALSO"}.`;

  sessione.risposte.push({
    id: q.id,
    domanda: q.domanda,
    immagine: q.immagine,
    argomento: q.argomento,
    rispostaCorretta: q.risposta,
    rispostaData: valoreScelto,
    corretto
  });

  if (sessione.modalita === "ripasso") {
    if (corretto) {
      rimuoviErrore(q.id);
    } else {
      sessione.errori++;
      registraErrore(q);
    }
  } else {
    if (!corretto) sessione.errori++;
    registraStatArgomento(q.argomento, corretto);
    if (!corretto) registraErrore(q);
  }

  const errEl = document.getElementById("quiz-errors");
  if (sessione.modalita === "ripasso") {
    const fatte = sessione.indice + 1;
    errEl.textContent = `Corrette: ${fatte - sessione.errori} / ${fatte}`;
  } else {
    errEl.textContent = `Errori: ${sessione.errori} / ${ERRORI_MAX_PROMOSSO}`;
    errEl.className = "quiz-errors " + (sessione.errori >= ERRORI_MAX_PROMOSSO ? "warn" : "ok");
  }

  salvaSessionePersistita();

  if (corretto) {
    // risposta corretta: si passa automaticamente alla domanda successiva
    document.getElementById("btn-next").classList.remove("show");
    autoAdvanceTimer = setTimeout(() => {
      if (sessione) avanzaDomanda();
    }, AUTO_ADVANCE_MS);
  } else {
    // risposta sbagliata: si prosegue solo manualmente
    document.getElementById("btn-next").classList.add("show");
  }
}

document.getElementById("btn-vero").addEventListener("click", () => rispondi(true));
document.getElementById("btn-falso").addEventListener("click", () => rispondi(false));
document.getElementById("btn-next").addEventListener("click", avanzaDomanda);

function avanzaDomanda() {
  clearTimeout(autoAdvanceTimer);
  sessione.indice++;
  if (sessione.indice >= sessione.domande.length) {
    concludiSimulazione();
  } else {
    renderDomanda();
  }
}

function concludiSimulazione() {
  const durataSec = Math.round((Date.now() - sessione.iniziata) / 1000);
  const totale = sessione.domande.length;
  const errate = sessione.errori;
  const corrette = totale - errate;
  const modalita = sessione.modalita;

  cancellaSessionePersistita();

  if (modalita === "ripasso") {
    sessione = null;
    showView("errori");
    const summary = document.getElementById("ripasso-summary");
    if (summary) {
      summary.style.display = "block";
      summary.textContent = corrette === totale
        ? `Ottimo! Hai risposto correttamente a tutte le ${totale} domande ripassate.`
        : `Hai ripassato ${totale} domande: ${corrette} corrette, ${errate} ancora da rivedere.`;
    }
    return;
  }

  const promosso = errate <= ERRORI_MAX_PROMOSSO;

  const history = loadJSON(LS_KEY_HISTORY, []);
  history.unshift({
    data: new Date().toISOString(),
    categoria: sessione.categoria,
    totale, errate, corrette, promosso, durataSec,
    risposte: sessione.risposte
  });
  saveJSON(LS_KEY_HISTORY, history.slice(0, 50));

  sessione = null;

  document.getElementById("result-hero").className = "result-hero " + (promosso ? "pass" : "fail");
  document.getElementById("result-verdict").textContent = promosso ? "PROMOSSO" : "NON PROMOSSO";
  document.getElementById("result-sub").textContent = promosso
    ? "Hai rispettato il limite di errori consentito."
    : `Hai superato il limite di ${ERRORI_MAX_PROMOSSO} errori consentiti.`;
  document.getElementById("res-corrette").textContent = corrette;
  document.getElementById("res-errate").textContent = errate;
  document.getElementById("res-durata").textContent = formatDurata(durataSec);

  showView("result");
}

function formatDurata(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

document.getElementById("btn-see-errors").addEventListener("click", () => showView("errori"));

// ============ STATISTICHE PER ARGOMENTO ============
function registraStatArgomento(argomento, corretto) {
  if (!argomento) return;
  const topics = loadJSON(LS_KEY_TOPICS, {});
  if (!topics[argomento]) topics[argomento] = { corrette: 0, totale: 0 };
  topics[argomento].totale++;
  if (corretto) topics[argomento].corrette++;
  saveJSON(LS_KEY_TOPICS, topics);
}

// ============ GESTIONE ERRORI PER RIPASSO ============
function registraErrore(q) {
  const errors = loadJSON(LS_KEY_ERRORS, {});
  const key = String(q.id);
  if (!errors[key]) {
    errors[key] = {
      id: q.id,
      domanda: q.domanda,
      immagine: q.immagine,
      argomento: q.argomento,
      risposta: q.risposta,
      count: 0,
      ultimaVolta: null
    };
  }
  errors[key].count++;
  errors[key].ultimaVolta = new Date().toISOString();
  saveJSON(LS_KEY_ERRORS, errors);
}

function rimuoviErrore(id) {
  const errors = loadJSON(LS_KEY_ERRORS, {});
  delete errors[String(id)];
  saveJSON(LS_KEY_ERRORS, errors);
}

function renderErrori() {
  const summary = document.getElementById("ripasso-summary");
  if (summary) summary.style.display = "none";

  const errors = loadJSON(LS_KEY_ERRORS, {});
  const lista = Object.values(errors).sort((a, b) => b.count - a.count);
  const container = document.getElementById("errori-list");
  const btnRipassa = document.getElementById("btn-ripassa-errori");
  container.innerHTML = "";

  if (lista.length === 0) {
    if (btnRipassa) btnRipassa.style.display = "none";
    container.innerHTML = `<div class="empty-state"><div class="big">✓</div>Nessun errore registrato.<br>Svolgi una simulazione per iniziare a costruire il tuo ripasso.</div>`;
    return;
  }
  if (btnRipassa) btnRipassa.style.display = "block";

  lista.forEach(err => {
    const div = document.createElement("div");
    div.className = "error-item";
    div.innerHTML = `
      <span class="count-badge">Sbagliata ${err.count} volt${err.count === 1 ? "a" : "e"}</span>
      ${err.immagine ? `<img src="${err.immagine}" alt="">` : ""}
      <div class="q">${escapeHtml(err.domanda)}</div>
      <div class="ans-line"><span class="lbl">Argomento:</span> ${escapeHtml(err.argomento || "—")}</div>
      <div class="ans-line"><span class="lbl">Risposta corretta:</span> <span class="val right">${err.risposta ? "VERO" : "FALSO"}</span></div>
    `;
    container.appendChild(div);
  });
}

document.getElementById("btn-clear-errori").addEventListener("click", () => {
  if (confirm("Svuotare l'elenco degli errori registrati?")) {
    saveJSON(LS_KEY_ERRORS, {});
    renderErrori();
  }
});

// ============ STATISTICHE GENERALI ============
function renderStats() {
  const history = loadJSON(LS_KEY_HISTORY, []);
  const topics = loadJSON(LS_KEY_TOPICS, {});

  document.getElementById("stat-simulazioni").textContent = history.length;

  const promosse = history.filter(h => h.promosso).length;
  document.getElementById("stat-promozioni").textContent = history.length
    ? Math.round((promosse / history.length) * 100) + "%"
    : "0%";

  const mediaErrori = history.length
    ? (history.reduce((s, h) => s + h.errate, 0) / history.length).toFixed(1)
    : "0";
  document.getElementById("stat-media-errori").textContent = mediaErrori;

  const domandeTotali = history.reduce((s, h) => s + h.totale, 0);
  document.getElementById("stat-domande-totali").textContent = domandeTotali;

  // breakdown per argomento
  const breakdown = document.getElementById("topic-breakdown");
  breakdown.innerHTML = "";
  const argomenti = Object.keys(topics).sort();
  if (argomenti.length === 0) {
    breakdown.innerHTML = `<p>Ancora nessun dato. Svolgi una simulazione per vedere la precisione per argomento.</p>`;
  } else {
    argomenti.forEach(arg => {
      const t = topics[arg];
      const pct = t.totale ? Math.round((t.corrette / t.totale) * 100) : 0;
      const row = document.createElement("div");
      row.className = "topic-row";
      row.innerHTML = `
        <div class="name">${escapeHtml(arg)}</div>
        <div class="topic-bar-track"><div class="topic-bar-fill" style="width:${pct}%"></div></div>
        <div class="pct">${pct}%</div>
      `;
      breakdown.appendChild(row);
    });
  }

  // storico
  const historyList = document.getElementById("history-list");
  historyList.innerHTML = "";
  if (history.length === 0) {
    historyList.innerHTML = `<p>Nessuna simulazione svolta finora.</p>`;
  } else {
    history.slice(0, 30).forEach((h, idx) => {
      const row = document.createElement("div");
      row.className = "history-row" + (h.risposte && h.risposte.length ? " clickable" : "");
      const data = new Date(h.data);
      const dataFmt = data.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "2-digit" }) +
        " " + data.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
      row.innerHTML = `
        <span>${dataFmt} · Cat. ${h.categoria === "ALL" ? "A+B" : h.categoria}</span>
        <span class="esito ${h.promosso ? "pass" : "fail"}">${h.errate} err. — ${h.promosso ? "Promosso" : "Non promosso"}${h.risposte && h.risposte.length ? '<span class="chev">›</span>' : ""}</span>
      `;
      if (h.risposte && h.risposte.length) {
        row.addEventListener("click", () => renderStoricoDettaglio(h));
      }
      historyList.appendChild(row);
    });
  }
}

document.getElementById("btn-reset-stats").addEventListener("click", () => {
  if (confirm("Questa azione cancella storico, statistiche per argomento ed errori salvati. Continuare?")) {
    saveJSON(LS_KEY_HISTORY, []);
    saveJSON(LS_KEY_TOPICS, {});
    saveJSON(LS_KEY_ERRORS, {});
    renderStats();
  }
});

// ============ DETTAGLIO SCHEDA STORICA ============
function renderStoricoDettaglio(entry) {
  const data = new Date(entry.data);
  const dataFmt = data.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " alle " + data.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  document.getElementById("storico-dettaglio-sub").textContent =
    `${dataFmt} · Categoria ${entry.categoria === "ALL" ? "A+B" : entry.categoria} · ${entry.corrette}/${entry.totale} corrette · ${entry.promosso ? "Promosso" : "Non promosso"}`;

  const container = document.getElementById("storico-dettaglio-list");
  container.innerHTML = "";
  entry.risposte.forEach((r, i) => {
    const div = document.createElement("div");
    div.className = "review-item " + (r.corretto ? "corretta" : "sbagliata");
    div.innerHTML = `
      <span class="esito-badge">Domanda ${i + 1} · ${r.corretto ? "Corretta" : "Sbagliata"}</span>
      ${r.immagine ? `<img src="${r.immagine}" alt="">` : ""}
      <div class="q">${escapeHtml(r.domanda)}</div>
      <div class="ans-line"><span class="lbl">Argomento:</span> ${escapeHtml(r.argomento || "—")}</div>
      <div class="ans-line"><span class="lbl">Hai risposto:</span> <span class="val ${r.corretto ? "right" : "wrong"}">${r.rispostaData ? "VERO" : "FALSO"}</span></div>
      ${!r.corretto ? `<div class="ans-line"><span class="lbl">Risposta corretta:</span> <span class="val right">${r.rispostaCorretta ? "VERO" : "FALSO"}</span></div>` : ""}
    `;
    container.appendChild(div);
  });

  showView("storico-dettaglio");
}

document.getElementById("btn-storico-back").addEventListener("click", () => showView("stats"));

// ============ HELPERS ============
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

// ============ AVVIO ============
loadQuestions();
