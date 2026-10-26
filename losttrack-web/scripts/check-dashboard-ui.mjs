// Entwicklertest: nur gegen einen eigens gestarteten, leeren CDP-Testbrowser.
// Ersetzt dessen Testdaten. Niemals gegen ein normales Benutzerprofil verwenden.
import assert from "node:assert/strict";

import { readFile } from "node:fs/promises";
import { log } from "node:console";

const targets = await fetch("http://127.0.0.1:9237/json/list").then((response) => response.json());
const target = targets.find((entry) => entry.type === "page" && entry.url === "about:blank");
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

async function field(selector, value) {
  await evaluate(`(() => { const input=document.querySelector(${JSON.stringify(selector)});
    if(!input) throw new Error('Feld fehlt: '+${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(input.tagName==='SELECT'?HTMLSelectElement.prototype:input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')
      .set.call(input,${JSON.stringify(value)});
    input.dispatchEvent(new Event(input.tagName==='SELECT'?'change':'input',{bubbles:true})); })()`);
  await sleep(100);
}

const baseline = () => evaluate("JSON.stringify(['records','drafts','audit','cashbook','counters'].map(name=>[name,localStorage.getItem('losttrack:lostItems.'+name+'.v1')]))");
try {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:5199/login" });
  await wait("!!document.querySelector('input[type=password]')");
  assert.equal(await evaluate("Object.keys(localStorage).some(k=>/records|drafts|cashbook|audit/.test(k))"), false,
    "Nur ein leeres Testprofil verwenden");
  const backup = JSON.parse(await readFile(new URL("../test-data/LostTrack-Testdaten.json", import.meta.url), "utf8"));
  await evaluate(`(async()=>{
    for(const [key,value] of Object.entries(${JSON.stringify(backup.data)})) localStorage.setItem(key,value);
    const {normalizeWorkflow}=await import('/src/domain/workflow.js');
    const records=JSON.parse(localStorage.getItem('losttrack:lostItems.records.v1'));
    records.forEach((item,index)=>{
      const kind=index%5;
      const deadline=new Date();deadline.setDate(deadline.getDate()+[0,5,30,90,0][kind]);
      const custody=new Date(deadline);custody.setFullYear(custody.getFullYear()-1);
      const civil=d=>String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear();
      item.retention={custodyStartDate:kind===0?'':civil(custody)};
      item.workflow=undefined;item.status='OPEN';item.feeSelection='NONE';
      item.finder.rewardChoice='WAIVED';item.finder.rewardRequested=false;
      item.workflow=normalizeWorkflow(item);item.workflow.payments.EXPENSES.dueCents=0;
      item.workflow.payments.REWARD={dueCents:0,receivedCents:0,paidCents:0};
      if(kind===4){item.status='RETURNED';item.workflow.parts.forEach(p=>p.handledQuantity=p.quantity);item.workflow.closedAt=new Date().toISOString();}
    });
    localStorage.setItem('losttrack:lostItems.records.v1',JSON.stringify(records));
  })()`);
  await fillLabel("Benutzername", "admin"); await fillLabel("Passwort", "admin");
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait("!!document.querySelector('[data-hint]')");
  const untouched = await baseline();
  assert.equal(await evaluate("document.querySelectorAll('[data-item-id]').length"), 15);
  assert.equal(await evaluate("document.querySelectorAll('[data-draft-id]').length"), 3);
  assert.equal(await evaluate("document.body.textContent.includes('Audit') || document.body.textContent.includes('Änderungsprotokoll')"), false);
  for (const code of ["REVIEW_REQUIRED", "URGENT", "WARNING", "OK", "COMPLETED"]) {
    const count = await evaluate(`Number(document.querySelector('[data-hint="${code}"] strong').textContent)`);
    assert.equal(count, 3);
    await evaluate(`document.querySelector('[data-hint="${code}"]').click()`);
    await wait(`new URLSearchParams(location.search).get('hinweis') === '${code}'`);
    await wait(`document.querySelector('[data-hint="${code}"]')?.getAttribute('aria-current') === 'true'`);
    assert.equal(await evaluate("document.querySelectorAll('[data-item-id]').length"), count);
    const expected = await evaluate(`(async()=>{const d=await import('/src/domain/dashboard.js');
      return d.filterDashboardItems(d.dashboardItems(JSON.parse(localStorage.getItem('losttrack:lostItems.records.v1'))),'${code}').map(i=>i.id).sort()})()`);
    assert.deepEqual(await evaluate("[...document.querySelectorAll('[data-item-id]')].map(e=>e.dataset.itemId).sort()"), expected);
  }
  await click("Alle Fundsachen anzeigen");
  assert.equal(await evaluate("document.querySelectorAll('[data-item-id]').length"), 15);
  await evaluate("document.querySelector('[data-draft-id] a').click()");
  await wait("location.pathname.startsWith('/entwuerfe/') && !!document.querySelector('#item-catalog-search')");
  assert.equal(await baseline(), untouched, "Öffnen eines Entwurfs verändert keine Daten");
  await send("Page.navigate", { url: "http://127.0.0.1:5199/" });
  await wait("!!document.querySelector('[data-item-id] a')");
  await evaluate("document.querySelector('[data-item-id] a').click()");
  await wait("location.pathname.startsWith('/items/')");
  assert.equal(await evaluate("document.body.textContent.includes('Änderungsprotokoll')"), false, "Auch der druckbare Bericht enthält kein Audit");
  const editLink = await evaluate("[...document.querySelectorAll('a')].find(a=>a.textContent==='Grunddaten bearbeiten')?.getAttribute('href')");
  assert.ok(editLink);
  await evaluate("[...document.querySelectorAll('a')].find(a=>a.textContent==='Grunddaten bearbeiten').click()");
  await wait("location.pathname.endsWith('/bearbeiten') && !!document.querySelector('#item-catalog-search')");
  assert.equal(await baseline(), untouched);
  await send("Page.navigate", { url: "http://127.0.0.1:5199/einstellungen/audit" });
  await wait("document.body.textContent.includes('Änderungsprotokoll (Audit)')");
  assert.ok(await evaluate("document.querySelectorAll('article').length > 0"));
  await field("input[placeholder='Fundnummer, Benutzer oder Suchwort']", "unbekannt123456789");
  assert.equal(await evaluate("document.querySelectorAll('article').length"), 0);
  assert.equal(await baseline(), untouched, "Audit-Anzeige schreibt keine Geschäftsdaten");
  for (const username of ["editor", "viewer"]) {
    await evaluate(`(async()=>{const {login}=await import('/src/core/auth/auth.js');
      if(!login({username:'${username}',password:'LostTrack-Test!'}).ok) throw new Error('Testanmeldung fehlgeschlagen');})()`);
    await send("Page.navigate", { url: "http://127.0.0.1:5199/einstellungen/audit" });
    await wait("document.body.textContent.includes('Kein Zugriff')");
    assert.equal(await evaluate("document.querySelectorAll('a[href=\"/einstellungen/audit\"]').length"), 0);
    assert.deepEqual(await evaluate("(async()=>{const {listAuditLog}=await import('/src/core/storage/lostItemRepo.js');return listAuditLog()})()"), []);
    await send("Page.navigate", { url: "http://127.0.0.1:5199/" });
    await wait("!!document.querySelector('[data-item-id]')");
    assert.equal(await evaluate("document.body.textContent.includes('Änderungsprotokoll')"), false);
    if(username==='viewer') assert.equal(await evaluate("document.querySelectorAll('[data-draft-id] a').length"), 0);
  }
  assert.equal(await baseline(), untouched);
  assert.deepEqual(exceptions, []);
  log("Browserprüfung erfolgreich: 15 Fundsachen/3 Entwürfe erreichbar, alle fünf Zähler und Filter, direkte Bearbeitung, Audit nur ADMIN in Einstellungen, EDITOR/VIEWER gesperrt; keine Geschäftsdatenänderung.");
} finally {
  await send("Browser.close").catch(()=>{});
  socket.close();
}
