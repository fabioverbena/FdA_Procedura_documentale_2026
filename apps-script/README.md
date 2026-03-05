# Apps Script - Polling Gmail FdA

Script per processare automaticamente le email YouSign e salvare i PDF firmati su Drive FdA.

## Setup (da fare su account FdA)

### 1. Crea progetto Apps Script

1. Apri lo Sheet FdA: `https://docs.google.com/spreadsheets/d/1_CZj56b-FQxgfKM0uYGrRy65cLUPkbTL_3rwoRQytBE`
2. **Estensioni** → **Apps Script**
3. Copia il contenuto di `fda-gmail-polling.gs` nell'editor
4. Salva con nome: **"FdA Gmail Polling"**

### 2. Autorizza permessi

1. Click **▶ Esegui** (funzione `testPolling`)
2. Autorizza accessi:
   - Gmail (lettura email)
   - Drive (scrittura file)
   - Sheets (lettura/scrittura)

### 3. Configura trigger automatico

1. Click icona **⏰ Trigger** (sidebar sinistra)
2. **+ Aggiungi trigger**:
   - Funzione: `processYouSignEmails`
   - Tipo evento: **Basato sul tempo**
   - Tipo timer: **Timer a ore**
   - Intervallo: **Ogni 6 ore**
3. Salva

## Come funziona

### Ogni 6 ore lo script:

1. **Cerca email YouSign** con query Gmail:
   ```
   from:noreply@yousign.com subject:"signed" has:attachment filename:pdf
   ```

2. **Estrae Order ID** dal subject o body dell'email

3. **Trova ordine** nello Sheet FdA

4. **Crea cartella "Firmati"** (se non esiste) dentro la cartella cliente

5. **Scarica PDF** allegati e li salva in Drive

6. **Aggiorna Sheet** con URL del PDF firmato (colonna Q)

7. **Marca email** con label `YouSign/Processed` per non riprocessarla

## Configurazione

Modifica le costanti in `CONFIG` se necessario:

```javascript
const CONFIG = {
  SPREADSHEET_ID: '1_CZj56b-FQxgfKM0uYGrRy65cLUPkbTL_3rwoRQytBE',
  ROOT_CLIENTI_FOLDER_ID: '1sGDEksehPRFFlXfUanoaSmS5QTxSOVxX',
  GMAIL_QUERY: 'from:noreply@yousign.com subject:"signed" has:attachment filename:pdf',
  PROCESSED_LABEL: 'YouSign/Processed',
  // ...
};
```

## Test manuale

Per testare senza aspettare 6 ore:

1. Nell'editor Apps Script
2. Seleziona funzione: `testPolling`
3. Click **▶ Esegui**
4. Controlla log: **Visualizza** → **Log di esecuzione**

## Monitoraggio

- **Log esecuzioni**: Apps Script → **Esecuzioni**
- **Email processate**: Gmail → Label `YouSign/Processed`
- **PDF salvati**: Drive FdA → Clienti → [Nome Cliente] → Firmati

## Troubleshooting

### Email non processate
- Verifica query Gmail funzioni (testala in Gmail)
- Controlla log Apps Script per errori
- Verifica Order ID sia presente nel body/subject

### PDF non salvati
- Verifica permessi Drive
- Controlla che cartella cliente esista (`clientFolderId` popolato)
- Verifica allegato sia effettivamente PDF

### Sheet non aggiornato
- Verifica ID Sheet corretto
- Controlla indici colonne in `CONFIG`
- Verifica ordine esista nello Sheet
