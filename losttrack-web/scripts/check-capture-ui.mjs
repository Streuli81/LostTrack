// Entwicklertest: nur gegen einen eigens gestarteten, leeren CDP-Testbrowser.
// Ersetzt dessen Testdaten. Niemals gegen ein normales Benutzerprofil verwenden.
import assert from "node:assert/strict";

import { log } from "node:console";
import { Buffer } from "node:buffer";

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

try {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:5199/login" });
  await wait("!!document.querySelector('input[type=password]')");
  assert.equal(await evaluate("Object.keys(localStorage).some(k=>/records|drafts|cashbook|audit/.test(k))"), false);
  await fillLabel("Benutzername", "admin"); await fillLabel("Passwort", "admin");
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait("location.pathname==='/'");
  await send("Page.navigate", { url: "http://127.0.0.1:5199/neu" });
  await wait("!!document.querySelector('[name=caseworker_name]')");
  assert.equal(await evaluate("document.querySelector('[name=caseworker_name]').readOnly"), true);
  assert.equal(await evaluate("document.querySelector('[name=caseworker_name]').value"), "Admin");
  assert.ok(await evaluate("document.querySelector('[name=capturedAt]').value.length > 10"));
  await field("[name=retention_noticeDate]", "26.10.2026");
  await field("[name=retention_noticeTime]", "14.30");
  assert.equal(await evaluate("document.querySelector('[name=retention_custodyStartDate]').value"), "");
  await field("[name=retention_custodyStartDate]", "27.10.2026");
  await field("[name=retention_custodyStartTime]", "15.00");
  assert.equal(await evaluate("document.querySelector('[name=retention_custodyStartDate]').readOnly"), false);
  await field("[name=origin_type]", "PUBLIC_TRANSPORT");
  for (const [name, value] of [["origin_operator", "Zimmerbergbus"], ["origin_line", "TEST 145"],
    ["origin_route", "TEST Horgen – Bahnhof"], ["origin_direction", "TEST Bahnhof"], ["origin_vehicleNo", "TEST 4"],
    ["found_date", "25.10.2026"], ["found_time", "10.00"], ["found_location", "TEST Bus"],
    ["finder_firstName", "TEST Abgeber"], ["item_manual_label", "TEST Schirm aus dem Bus"]]) await field(`[name="${name}"]`, value);
  await field("[name=roles_delivererName]", "TEST Abgeber");
  await click("Entwurf speichern");
  const draft = await evaluate("JSON.parse(localStorage.getItem('losttrack:lostItems.drafts.v1'))[0]");
  assert.equal(draft.origin.operator, "Zimmerbergbus");
  assert.equal(draft.retention.custodyStartTime, "15.00");
  assert.equal(draft.caseWorker.id, "u_admin");
  const capturedAt = draft.capturedAt;
  await send("Page.navigate", { url: `http://127.0.0.1:5199/entwuerfe/${draft.id}/bearbeiten` });
  await wait("document.querySelector('[name=origin_operator]')?.value==='Zimmerbergbus'");
  await click("Definitiv erfassen");
  await wait("location.pathname.startsWith('/items/')");
  const saved = await evaluate("JSON.parse(localStorage.getItem('losttrack:lostItems.records.v1'))[0]");
  assert.equal(saved.capturedAt, capturedAt);
  assert.equal(saved.retention.auctionReviewDate, "");
  assert.equal(saved.retention.finderAcquisitionReviewDate, "");
  assert.equal(saved.retention.ruleKey, "TRANSPORT_REFERRAL");
  assert.equal(saved.status, "OPEN");
  assert.equal(saved.origin.line, "TEST 145");
  assert.equal(saved.origin.vehicleNo, "TEST 4");
  assert.equal(await evaluate("document.body.textContent.includes('Weiterleitung an zuständiges Verkehrsunternehmen vorbereiten')"), true);
  await send("Page.navigate", { url: "http://127.0.0.1:5199/" });
  await wait("!!document.querySelector('[data-item-id]')");
  assert.equal(await evaluate("document.body.textContent.includes('ÖV-Fund: Zuständigkeit / Weiterleitung prüfen')"), true);
  assert.equal(await evaluate("document.querySelector('[data-hint=REVIEW_REQUIRED] strong').textContent"), "1");
  assert.equal(await evaluate("document.querySelector('[data-hint=OK] strong').textContent"), "0");
  await send("Page.navigate", { url: `http://127.0.0.1:5199/items/${saved.id}` });
  await wait("[...document.querySelectorAll('button')].some(b=>b.textContent==='Quittung vorbereiten und drucken')");
  await evaluate("window.print=()=>{}");
  await click("Quittung vorbereiten und drucken");
  await wait("[...document.querySelectorAll('button')].some(b=>b.textContent==='Ja, gedruckt und Vorgang tatsächlich erfolgt' && !b.disabled)");
  assert.equal(await evaluate("document.querySelector('#workflow-receipt-print').textContent.includes('Zimmerbergbus')"), true);
  assert.equal(await evaluate("document.querySelectorAll('#workflow-receipt-print table').length"), 0);
  const pdf = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
  assert.equal((Buffer.from(pdf.data,'base64').toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length, 1);
  await click("Abgebrochen / nicht erfolgt");
  assert.deepEqual(exceptions, []);
  log("Browserprüfung erfolgreich: automatische Sachbearbeitung/Erfassung, getrennte Bekanntmachung/Aufbewahrung, ÖV-Felder, Entwurf, definitive Erfassung und Dashboard ohne kommunale Frist oder automatische Weitergabe.");
} finally {
  await send("Browser.close").catch(()=>{});
  socket.close();
}
