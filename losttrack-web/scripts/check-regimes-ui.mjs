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
  await wait("!!document.querySelector('[name=regime_type]')");
  await field("[name=regime_type]", "NORMAL");
  for (const [name, value] of [["found_date", "01.05.2026"], ["found_time", "10.00"], ["found_location", "TEST Strasse"],
    ["retention_reportedDate", "01.05.2026"], ["retention_noticeDate", "02.05.2026"], ["retention_noticeTime", "11.00"],
    ["retention_receivedDate", "01.08.2026"], ["retention_custodyStartDate", "01.08.2026"], ["retention_custodyStartTime", "12.00"],
    ["retention_finderBasis", "REPORT"], ["finder_firstName", "TEST Finder"], ["item_manual_label", "TEST Portemonnaie"]]) await field(`[name="${name}"]`, value);
  await evaluate("document.querySelector('[name=finder_reward_choice][value=REQUESTED]').click()");
  await field("[aria-label='Gemeindegebühr für diese Sache']", "NONE");
  await click("Fundbestandteil hinzufügen");
  await fillLabel("Art", "CASH"); await fillLabel("Bezeichnung", "TEST Bargeld im Portemonnaie");
  await fillLabel("Bargeldbetrag", "250.00");
  await evaluate("[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith('Bargeldbetrag')).querySelector('input').dispatchEvent(new FocusEvent('focusout',{bubbles:true}))");
  await evaluate("[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Bargeldbetrag gezählt')).querySelector('input').click()");
  await click("Definitiv erfassen");
  await wait("location.pathname.startsWith('/items/')");
  const id = await evaluate("location.pathname.split('/')[2]");
  let saved = await evaluate(`JSON.parse(localStorage.getItem('losttrack:lostItems.records.v1')).find(i=>i.id==='${id}')`);
  assert.equal(saved.retention.custodyStartDate, "01.08.2026");
  assert.match(saved.retention.auctionReviewDate, /^2027-08-01/);
  assert.match(saved.retention.finderAcquisitionReviewDate, /^2031-05-01/);
  assert.equal(saved.contents[0].amountCents, 25000);
  assert.equal(saved.contents[0].countConfirmed, true);
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('losttrack:lostItems.cashbook.v1') || '[]').length"), 0);
  await field("[name=claim_name]", "TEST Finder"); await field("[name=claim_amount]", "6.00"); await field("[name=claim_reason]", "TEST notwendige Sicherung");
  await click("Auslagenanmeldung speichern");
  await wait("document.body.textContent.includes('Angemeldet – Prüfung offen')");
  saved = await evaluate(`JSON.parse(localStorage.getItem('losttrack:lostItems.records.v1')).find(i=>i.id==='${id}')`);
  assert.equal(saved.expenseClaims[0].claimedCents, 600);
  assert.equal(saved.workflow.payments.EXPENSES.dueCents, null);
  assert.equal(saved.workflow.payments.REWARD.dueCents, null);
  await evaluate("window.print=()=>{}");
  await click("Quittung vorbereiten und drucken");
  await wait("[...document.querySelectorAll('button')].some(b=>b.textContent==='Ja, gedruckt und Vorgang tatsächlich erfolgt' && !b.disabled)");
  assert.equal(await evaluate("document.querySelector('#workflow-receipt-print').textContent.includes('250.00')"), true);
  assert.equal(await evaluate("document.querySelectorAll('#workflow-receipt-print table').length"), 0);
  const pdf = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
  assert.equal((Buffer.from(pdf.data,'base64').toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length, 1);
  await click("Abgebrochen / nicht erfolgt");
  const claimId = saved.expenseClaims[0].id;
  await field("[aria-label=Auslagenanmeldung]", claimId);
  await field("[name=claim_status]", "APPROVED"); await field("[name=claim_approved]", "6.00");
  await field("[name=claim_decision]", "TEST notwendige Kosten anhand Beleg anerkannt");
  await click("Auslagenanmeldung speichern");
  await fillLabel("Finderlohn gesamt", "0.00");
  await fillLabel("Auslagenersatz gesamt", "6.00"); await fillLabel("An wen geht der Auslagenersatz", "FINDER");
  await field("[name=expense_payee_note]", "TEST Beleg und Anspruch geprüft");
  await evaluate("[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Anspruchsteller und anerkannte Auslagen')).querySelector('input').click()");
  await click("Plan speichern");
  await fillLabel("Schreiben", "OWNER_HANDOVER"); await fillLabel("Empfänger / zahlende", "TEST Eigentümer");
  await fillLabel("Auslagenersatz – Einnahme heute", "6.00");
  await click("Quittung vorbereiten und drucken");
  await wait("[...document.querySelectorAll('button')].some(b=>b.textContent==='Ja, gedruckt und Vorgang tatsächlich erfolgt' && !b.disabled)");
  await click("Ja, gedruckt und Vorgang tatsächlich erfolgt");
  await wait("document.body.textContent.includes('Fällig nach dokumentierter Anerkennung')");
  await fillLabel("Schreiben", "FINDER_HANDOVER");
  await evaluate("[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Nur Zahlung zu diesem Schreiben')).querySelector('input').click()");
  await fillLabel("Auslagenersatz – Auszahlung heute", "6.00");
  await click("Quittung vorbereiten und drucken");
  await wait("[...document.querySelectorAll('button')].some(b=>b.textContent==='Ja, gedruckt und Vorgang tatsächlich erfolgt' && !b.disabled)");
  await click("Ja, gedruckt und Vorgang tatsächlich erfolgt");
  saved = await evaluate(`JSON.parse(localStorage.getItem('losttrack:lostItems.records.v1')).find(i=>i.id==='${id}')`);
  const receipt = saved.receipts.find(r=>r.payments.some(line=>line.category==='EXPENSES' && line.type==='OUT'));
  assert.ok(receipt);
  await field("[aria-label=Auslagenanmeldung]", claimId); await field("[name=claim_receipt]", receipt.id);
  await click("Auslagenanmeldung speichern");
  await wait("document.body.textContent.includes('Bezahlt – bestätigter Beleg zugeordnet')");
  const ledger = await evaluate("JSON.parse(localStorage.getItem('losttrack:lostItems.cashbook.v1'))");
  assert.equal(ledger.length, 2); assert.ok(ledger.every(line=>line.category==='EXPENSES' && line.amountCents===600));
  await click("Vorgang vollständig abschließen");
  await wait(`!!JSON.parse(localStorage.getItem('losttrack:lostItems.records.v1')).find(i=>i.id==='${id}').workflow.closedAt`);
  for (const type of ["ANIMAL", "DOCUMENT", "DANGEROUS"]) {
    await send("Page.navigate", { url: "http://127.0.0.1:5199/neu" });
    await wait("!!document.querySelector('[name=regime_type]')");
    await field("[name=regime_type]", type);
    assert.equal(await evaluate("document.body.textContent.includes('Keine normale Herausgabe')"), true);
    assert.equal(await evaluate("document.querySelectorAll('[name=finder_reward_choice]').length"), 0);
  }
  assert.deepEqual(exceptions, []);
  log("Browserprüfung erfolgreich: getrennte Fristen, CHF 250 Fundinhalt ohne Gebührenbuchung, CHF 6 angemeldet/anerkannt/nach Eigentümerrückgabe ausgezahlt und belegt, korrekter Abschluss, einseitige Fundquittung, Sonderfälle.");
} finally { await send("Browser.close").catch(()=>{}); socket.close(); }
