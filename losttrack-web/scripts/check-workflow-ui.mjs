// Entwicklertest: nur gegen einen eigens gestarteten, leeren CDP-Testbrowser.
// Ersetzt dessen Testdaten. Niemals gegen ein normales Benutzerprofil verwenden.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { log } from "node:console";

const targets = await fetch("http://127.0.0.1:9237/json/list").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page");
assert.ok(target, "Separater Testbrowser auf Port 9237 fehlt");
assert.equal(target.url, "about:blank", "Nur einen frisch gestarteten, leeren Testbrowser verwenden");
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let sequence = 0;
const pending = new Map();
const exceptions = [];
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
  const request = pending.get(message.id);
  if (request) { pending.delete(message.id); clearTimeout(request.timer); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Zeitüberschreitung: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function wait(expression) {
  for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await sleep(100); }
  throw new Error(`Oberflächenbedingung nicht erreicht: ${expression}`);
}
async function click(text) {
  await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(text)});
    if (!button || button.disabled) throw new Error('Schaltfläche fehlt/gesperrt: ' + ${JSON.stringify(text)});
    for (let node=button.parentElement; node; node=node.parentElement) if(node.tagName==='DETAILS') node.open=true;
    button.click(); })()`);
  await sleep(100);
}
async function fillLabel(text, value) {
  await evaluate(`(() => {
    const label=[...document.querySelectorAll('label')].find(e=>e.textContent.trim().startsWith(${JSON.stringify(text)}));
    const input=label?.querySelector('input,select'); if(!input) throw new Error('Feld fehlt: '+${JSON.stringify(text)});
    const prototype=input.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,${JSON.stringify(String(value))});
    input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true}));
  })()`);
  await sleep(80);
}
const business = () => evaluate(`JSON.stringify(['losttrack:lostItems.records.v1','losttrack:lostItems.audit.v1','losttrack:lostItems.cashbook.v1','losttrack:lostItems.counters.v1'].map(key=>[key,localStorage.getItem(key)]))`);

try {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:5199/login" });
  await wait("document.querySelector('input[type=password]') !== null");
  const backup = JSON.parse(await readFile(new URL("../test-data/LostTrack-Testdaten.json", import.meta.url), "utf8"));
  await evaluate(`(() => {
    if (['records','drafts','cashbook','audit'].some(name=>localStorage.getItem('losttrack:lostItems.'+name+'.v1')!==null))
      throw new Error('Test abgebrochen: vorhandene Geschäftsdaten dürfen nicht überschrieben werden.');
    const users=JSON.parse(localStorage.getItem('losttrack:lostItems.users.v2') || '[]');
    if(users.length>1 || users.some(u=>u.username!=='admin')) throw new Error('Kein leerer Testbestand.');
    const values=${JSON.stringify(backup.data)};
    for(const [key,value] of Object.entries(values)) localStorage.setItem(key,value);
    const admin=JSON.parse(localStorage.getItem('losttrack:lostItems.users.v2')).find(u=>u.username==='admin');
    localStorage.setItem('losttrack:lostItems.session.v1',JSON.stringify({userId:admin.id})); })()`);
  await send("Page.navigate", { url: "http://127.0.0.1:5199/items/TEST-FALL-01" });
  await wait("document.querySelector('select[aria-label=\"Gebühr für Gegenstand 1\"]') !== null");
  await evaluate(`(() => {const select=document.querySelector('select[aria-label="Gebühr für Gegenstand 1"]'); select.value='KEY_BUNDLE';select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await fillLabel("Auslagenersatz gesamt", "0.00");
  await click("Plan speichern");
  await wait("JSON.parse(localStorage.getItem('losttrack:lostItems.records.v1')).find(i=>i.id==='TEST-FALL-01').workflow?.payments.FEE.dueCents === 1000");
  await evaluate("window.__testPrintCalls=0; window.print=()=>{window.__testPrintCalls++}");
  const baseline = await business();
  async function prepare() {
    await fillLabel("Empfänger / zahlende", "TEST Empfänger Browserprüfung");
    await fillLabel("TEST 01", "1");
    await fillLabel("Gebühren – Einnahme heute", "10.00");
    await click("Quittung vorbereiten und drucken");
    await wait("[...document.querySelectorAll('button')].some(b=>b.textContent==='Ja, gedruckt und Vorgang tatsächlich erfolgt' && !b.disabled)");
  }
  await prepare();
  assert.equal(await business(), baseline, "Druckvorbereitung darf nichts speichern");
  assert.equal(await evaluate("window.__testPrintCalls"), 1);
  const pdf = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
  assert.ok(pdf.data.length > 15000, "Quittungs-PDF darf nicht leer sein");
  await click("Abgebrochen / nicht erfolgt");
  assert.equal(await business(), baseline, "Abbruch darf nichts speichern");
  await prepare();
  await click("Ja, gedruckt und Vorgang tatsächlich erfolgt");
  await wait("JSON.parse(localStorage.getItem('losttrack:lostItems.records.v1')).find(i=>i.id==='TEST-FALL-01').status === 'RETURNED'");
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('losttrack:lostItems.records.v1')).find(i=>i.id==='TEST-FALL-01').workflow.payments.FEE.receivedCents"), 1000);
  await click("Vorgang vollständig abschließen");
  await wait("!!JSON.parse(localStorage.getItem('losttrack:lostItems.records.v1')).find(i=>i.id==='TEST-FALL-01').workflow.closedAt");
  const closed = await business();
  await click("Nachdrucken");
  await wait("document.querySelector('[role=dialog]')?.textContent.includes('Nachdruck') && [...document.querySelectorAll('button')].some(b=>b.textContent==='Druck erneut versuchen')");
  assert.equal(await business(), closed, "Nachdruck darf nichts verändern");
  await click("Nachdruck schließen");
  await fillLabel("Begründung für die Wiederöffnung", "TEST erneute Prüfung");
  await click("Vorgang wieder öffnen");
  await wait("JSON.parse(localStorage.getItem('losttrack:lostItems.records.v1')).find(i=>i.id==='TEST-FALL-01').workflow.closedAt === null");
  await evaluate(`(() => { const viewer=JSON.parse(localStorage.getItem('losttrack:lostItems.users.v2')).find(u=>u.username==='viewer');
    localStorage.setItem('losttrack:lostItems.session.v1',JSON.stringify({userId:viewer.id})); })()`);
  await send("Page.reload");
  await wait("document.body.textContent.includes('Nur Lesezugriff')");
  assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent==='Plan speichern' || b.textContent==='Quittung vorbereiten und drucken')"), false);
  assert.equal(exceptions.length, 0, exceptions.join("; "));
  log("Oberflächentest in separatem Edge-Profil erfolgreich: Gebührenplan, PDF, Druckabbruch, bestätigte Herausgabe/Zahlung, Abschluss, Nachdruck, Wiederöffnung und VIEWER.");
  log("Druckaufruf simuliert; kein physischer Papierdruck geprüft. Keine echten Browserdaten verwendet.");
} finally {
  await send("Browser.close").catch(() => {});
  socket.close();
}
