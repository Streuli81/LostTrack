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
  for (const [name, source] of [["TEST See-Spital Horgen", "PERSON"], ["TEST Migros-Filiale Horgen", "INSTITUTION"]]) {
    await send("Page.navigate", { url: "http://127.0.0.1:5199/neu" });
    await wait("!!document.querySelector('[name=origin_type]')");
    await field("[name=origin_type]", "BUILDING");
    assert.equal(await evaluate("document.querySelectorAll('[name=finder_reward_choice]').length"), 0);
    assert.equal(await evaluate("document.querySelector('[name=institution_legalFinderName]').value"), "");
    for (const [key, value] of [["institution_name", name], ["institution_internalLocation", "TEST Wartebereich / Kühlregal"],
      ["institution_deliveredBy", "TEST Überbringer"], ["institution_intakeSource", source],
      ["institution_handedToInstitutionDate", "25.10.2026"], ["institution_handedToOfficeDate", "26.10.2026"],
      ["finder_firstName", "TEST ursprüngliche Fundperson"], ["found_date", "25.10.2026"], ["found_time", "10.00"],
      ["found_location", name], ["item_manual_label", "TEST Portemonnaie"]]) await field(`[name="${key}"]`, value);
    if (source === "INSTITUTION") await field("[name=institution_deliveringInstitution]", name);
    await field("[aria-label='Gemeindegebühr für diese Sache']", "NONE");
    await click("Definitiv erfassen");
    await wait("location.pathname.startsWith('/items/')");
    const id = await evaluate("location.pathname.split('/')[2]");
    const stored = await evaluate(`JSON.parse(localStorage.getItem('losttrack:lostItems.records.v1')).find(i=>i.id==='${id}')`);
    assert.equal(stored.institution.name, name);
    assert.equal(stored.institution.intakeSource, source);
    assert.equal(stored.finder.rewardChoice, "");
    assert.equal(stored.workflow.payments.REWARD.dueCents, 0);
    assert.equal(stored.retention.finderAcquisitionReviewDate, "");
    assert.equal(await evaluate("[...document.querySelectorAll('button')].some(b=>b.textContent==='Finder als Abholer übernehmen')"), false);
    await evaluate("window.print=()=>{}");
    await fillLabel("Schreiben", "FINDER_HANDOVER");
    assert.equal(await evaluate("[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith('Empfänger / zahlende')).querySelector('input').value"), "");
    await fillLabel("Empfänger / zahlende", "TEST ursprüngliche Fundperson");
    const before = await evaluate("JSON.stringify(localStorage)");
    await click("Quittung vorbereiten und drucken");
    await wait("document.body.textContent.includes('Bitte zuerst die rechtlich relevante Finderstelle')");
    assert.equal(await evaluate("JSON.stringify(localStorage)"), before);
    await fillLabel("Schreiben", "FUND");
    assert.equal(await evaluate("[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith('Empfänger / zahlende')).querySelector('input').value"), "TEST Überbringer");
    await click("Quittung vorbereiten und drucken");
    await wait("[...document.querySelectorAll('button')].some(b=>b.textContent==='Ja, gedruckt und Vorgang tatsächlich erfolgt' && !b.disabled)");
    assert.equal(await evaluate("document.querySelector('#workflow-receipt-print').textContent.includes('verzichtet freiwillig')"), false);
    assert.equal(await evaluate("document.querySelector('#workflow-receipt-print').textContent.includes('Ursprüngliche Fundperson')"), true);
    assert.equal(await evaluate("document.querySelector('#workflow-receipt-print').textContent.includes('Zuordnung ungeprüft')"), true);
    assert.equal(await evaluate("document.querySelectorAll('#workflow-receipt-print table').length"), 0);
    const pdf = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
    assert.equal((Buffer.from(pdf.data,'base64').toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length, 1);
    await click("Abgebrochen / nicht erfolgt");
    await send("Page.navigate", { url: `http://127.0.0.1:5199/items/${id}/bearbeiten` });
    await wait("!!document.querySelector('[name=institution_legalFinderName]')");
    await field("[name=institution_legalFinderName]", "TEST Betreiber " + name);
    await field("[name=institution_reviewNote]", "TEST fachliche Zuordnung und Berechtigung geprüft");
    await evaluate("document.querySelector('[name=institution_legalFinderConfirmed]').click()");
    await click("Änderungen speichern");
    await wait("!location.pathname.endsWith('/bearbeiten')");
    await fillLabel("Auslagenersatz gesamt", "0.00");
    await click("Plan speichern");
    const rewardInput = await evaluate("[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith('Finderlohn gesamt')).querySelector('input').disabled");
    assert.equal(rewardInput, true);
    await fillLabel("Schreiben", "FINDER_HANDOVER");
    assert.equal(await evaluate("[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith('Empfänger / zahlende')).querySelector('input').value"), "TEST Betreiber " + name);
    assert.equal(await evaluate("[...document.querySelectorAll('label')].some(l=>l.textContent.startsWith('Finderlohn – Einzahlung heute'))"), false);
  }
  assert.deepEqual(exceptions, []);
  log("Browserprüfung erfolgreich: Spital/Migros, direkte bzw. institutionelle Abgabe, getrennte Rollen, Finderlohnsperre ohne Verzicht, ungeprüfte Herausgabe gesperrt, manuelle Finderzuordnung, einseitige Fundquittungen ohne Beträge.");
} finally {
  await send("Browser.close").catch(()=>{}); socket.close();
}
