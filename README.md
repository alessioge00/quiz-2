# Quiz Istruttore — Patente A/B

App web per esercitarsi ai quiz teorici in vista dell'esame da istruttore di scuola guida: schede da 60 domande vero/falso, soglia di 2 errori massimi, statistiche e ripasso degli errori. Funziona interamente offline dopo il primo caricamento e non richiede server: tutti i dati (storico, statistiche, errori) restano salvati solo sul telefono, nella memoria del browser.

## 1. Pubblicarla su GitHub Pages (gratis)

1. Crea un nuovo repository su GitHub (es. `quiz-istruttore`).
2. Carica tutti i file di questa cartella nella root del repository (mantenendo le sottocartelle `css/`, `js/`, `data/`, `images/`, `icons/`).
3. Nel repository vai su **Settings → Pages**.
4. In "Build and deployment", scegli **Deploy from a branch**, branch `main`, cartella `/ (root)`. Salva.
5. Dopo un paio di minuti l'app sarà online su un indirizzo tipo:
   `https://tuo-utente.github.io/quiz-istruttore/`

## 2. Installarla sull'iPhone come app

1. Apri l'indirizzo GitHub Pages con **Safari** (non Chrome: su iPhone solo Safari può installare sulla home).
2. Tocca l'icona di condivisione (il quadrato con la freccia verso l'alto).
3. Scegli **"Aggiungi alla schermata Home"**.
4. Da quel momento l'app si apre a schermo intero, con la sua icona, come un'app nativa.

## 3. Formato del file delle domande

Le domande sono in `data/questions.json`, un array di oggetti così strutturati:

```json
{
  "id": 21810,
  "categoria": ["B"],
  "argomento": "Segnali di indicazione",
  "argomento_esteso": "Segnali di indicazione",
  "quesito": "4328",
  "domanda": "Il segnale raffigurato preavvisa confine di Stato con un Paese che fa parte dell'Unione Europea",
  "immagine": "images/q_21810.jpg",
  "risposta": true
}
```

- `id`: numero univoco del quesito (coincide con quello ufficiale del Ministero).
- `categoria`: array con una o entrambe le patenti a cui si applica la domanda (`"A"`, `"B"`). L'app la usa per filtrare le schede.
- `argomento`: etichetta breve, usata nel grafico di precisione per argomento nelle statistiche.
- `argomento_esteso`: titolo ufficiale completo della categoria (informativo, non usato dall'interfaccia).
- `quesito`: numero del "quesito madre" ministeriale a cui la domanda appartiene (informativo).
- `domanda`: testo del quesito.
- `immagine`: percorso relativo del file immagine dentro `images/`, oppure `null` se il quesito non ha immagine.
- `risposta`: `true` se l'affermazione è VERO, `false` se è FALSO.

## 4. Il dataset incluso

`data/questions.json` contiene **7.106 quesiti ufficiali della patente B**, estratti direttamente dal PDF del Ministero delle Infrastrutture e dei Trasporti (quello caricato in fase di sviluppo di questa app), completi di:

- testo esatto della domanda e risposta corretta (VERO/FALSO);
- argomento (25 categorie ufficiali, es. "Segnali di pericolo", "Esempi di precedenza agli incroci", ecc.);
- immagine originale del quesito, per i 3.946 quesiti che ne prevedono una (segnaletica, incroci, ecc.) — le immagini sono in `images/`, nominate `q_<id>.jpg`.

Ogni domanda ha `"categoria": ["B"]`. **La categoria A non è ancora presente**: selezionando "A" nella home non comparirà nessuna domanda finché non verrà aggiunto anche il quiz ufficiale di patente A. Se carichi in chat anche il PDF ufficiale dei quesiti di patente A (stessa struttura del Ministero), può essere elaborato ed unito allo stesso `questions.json`, taggando ogni domanda con `["A"]` o `["A","B"]` per quelle in comune.

Se in futuro il Ministero aggiorna la banca dati (aggiunte/modifiche ai quesiti), basta ripetere l'estrazione dal nuovo PDF ufficiale e sostituire `data/questions.json` e la cartella `images/`.

## 5. Come funziona la sessione d'esame

- Si estraggono a caso 60 domande (filtrate per categoria, se selezionata) dal file JSON.
- Ogni domanda si risponde con VERO o FALSO; il contatore errori è sempre visibile.
- Superati 2 errori l'esito finale sarà "Non promosso", altrimenti "Promosso" — coerente con la soglia indicata.
- A fine scheda i dati (esito, errori, categoria, durata) vengono salvati nello storico locale.
- Ogni domanda sbagliata viene aggiunta alla sezione **Errori**, con contatore di quante volte è stata sbagliata, utile per il ripasso mirato.
- La sezione **Statistiche** mostra numero di simulazioni, percentuale di promozioni, media errori, precisione per argomento e storico completo.

## 6. Personalizzazioni rapide

- Numero di domande per scheda o soglia errori: modifica `TARGET_DOMANDE` e `ERRORI_MAX_PROMOSSO` all'inizio di `js/app.js`.
- Colori e stile: variabili CSS in cima a `css/style.css` (`:root { ... }`).
