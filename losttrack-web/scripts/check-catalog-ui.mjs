// Entwicklertest: nur gegen einen eigens gestarteten, leeren CDP-Testbrowser.
// Ersetzt dessen Testdaten. Niemals gegen ein normales Benutzerprofil verwenden.
import assert from "node:assert/strict";

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

async function choose(query, label) {
  await field("#item-catalog-search", query);
  await evaluate(`(() => {
    const option=[...document.querySelectorAll('[role=option]')].find(row=>row.textContent.trim().startsWith(${JSON.stringify(label)}+' '));
    if(!option) throw new Error('Vorschlag fehlt'); option.click(); })()`);
  await sleep(100);
}

try {
  await send("Page.enable"); await send("Runtime.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:5199/login" });
  await wait("document.querySelector('input[type=password]') !== null");
  assert.equal(await evaluate("Object.keys(localStorage).some(k=>/records|drafts|cashbook|audit/.test(k))"), false,
    "Nur frisches Testprofil ohne Geschäftsdaten verwenden");
  await fillLabel("Benutzername", "admin"); await fillLabel("Passwort", "admin");
  await evaluate("document.querySelector('form').requestSubmit()");
  await wait("!location.pathname.includes('login')");
  await send("Page.navigate", { url: "http://127.0.0.1:5199/einstellungen/stammdaten" });
  await wait("!!document.querySelector('[name=group_label]')");
  await field("[name=group_label]", "Testgruppe Browser");
  await click("Gruppe speichern");
  const groupId = await evaluate("JSON.parse(localStorage.getItem('losttrack:lostItems.catalog.v1')).groups.find(g=>g.label==='Testgruppe Browser').id");
  await field("[name=group_label]", "Neue Testgruppe Browser");
  await click("Gruppe speichern");
  await field("[name=catalog_item_label]", "Browser-Testgegenstand");
  await field("[aria-label='Gruppe des Gegenstands']", groupId);
  await field("[name=catalog_aliases]", "Browseralias\nTestwort");
  await field("[aria-label=Gebührenvorschlag]", "NONE");
  await click("Gegenstand speichern");
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('losttrack:lostItems.catalog.v1')).revision"), 3);
  await send("Page.navigate", { url: "http://127.0.0.1:5199/neu" });
  await wait("!!document.querySelector('#item-catalog-search')");
  const fee = () => evaluate("document.querySelector('[aria-label=\"Gemeindegebühr für diese Sache\"]').value");
  await choose("Browseralias", "Browser-Testgegenstand");
  assert.equal(await fee(), "NONE");
  for (const [query, label, code] of [["Natel", "Mobiltelefon", "MOBILE_MEDIATION"], ["Foular", "Halstuch", "NONE"],
    ["Schluesselbund", "Schlüsselbund", "KEY"], ["Hausschlüssel", "Einzelner Schlüssel", "KEY"]]) {
    await choose(query, label);
    assert.equal(await evaluate("document.querySelector('#item-catalog-search').value"), label);
    assert.equal(await fee(), code);
  }
  await field("#item-catalog-search", "Roller");
  assert.equal(await evaluate("document.querySelectorAll('[role=option]').length >= 2"), true);
  assert.equal(await fee(), "KEY", "Suchworteingabe darf Auswahl nicht verändern");
  await evaluate("document.querySelector('#item-catalog-search').focus()");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 });
  assert.equal(await evaluate("document.querySelector('#item-catalog-search').getAttribute('aria-activedescendant')"), "catalog-option-1");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await wait("document.querySelector('#item-catalog-search').value === 'Einzelner Schlüssel'");
  assert.equal(await fee(), "KEY");
  await evaluate("document.querySelector('#item-catalog-search').click()");
  await click("Auswahl aufheben / manuell erfassen");
  assert.equal(await fee(), "UNSET");
  await field("#item-catalog-search", "Natel");
  await evaluate("document.querySelector('#item-catalog-search').focus()");
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await wait("document.querySelector('#item-catalog-search').value === 'Mobiltelefon'");
  await click("Entwurf speichern");
  const draft = await evaluate("JSON.parse(localStorage.getItem('losttrack:lostItems.drafts.v1'))[0]");
  assert.equal(draft.item.manualLabel, "Mobiltelefon");
  assert.equal(draft.feeSelection, "MOBILE_MEDIATION");
  await send("Page.navigate", { url: `http://127.0.0.1:5199/entwuerfe/${draft.id}/bearbeiten` });
  await wait("document.querySelector('#item-catalog-search')?.value === 'Mobiltelefon'");
  assert.equal(await fee(), "MOBILE_MEDIATION");
  await field("[name=origin_type]", "PUBLIC_GROUND");
  for (const [name, value] of [["found_date", "26.10.2026"], ["found_time", "10.00"], ["found_location", "Testort"],
    ["finder_firstName", "Testfinder"]]) await field(`[name="${name}"]`, value);
  await evaluate("document.querySelector('input[name=finder_reward_choice][value=WAIVED]').click()");
  await click("Definitiv erfassen");
  await wait("location.pathname.startsWith('/items/') && !location.pathname.includes('bearbeiten')");
  const saved = await evaluate("JSON.parse(localStorage.getItem('losttrack:lostItems.records.v1'))[0]");
  assert.equal(saved.item.predefinedKey, "phone");
  assert.equal(saved.item.manualLabel, "Mobiltelefon");
  assert.equal(saved.workflow.payments.FEE.dueCents, 2000);
  assert.equal(saved.workflow.payments.FEE.receivedCents, 0);
  assert.equal(saved.workflow.movements.length, 0);
  await send("Page.navigate", { url: "http://127.0.0.1:5199/einstellungen/stammdaten" });
  await wait("!!document.querySelector('[aria-label=\"Gegenstand bearbeiten\"]')");
  await field("[aria-label='Gegenstand bearbeiten']", "phone");
  await field("[name=catalog_item_label]", "Mobiltelefon neu benannt");
  await evaluate("document.querySelector('input[type=checkbox]').click()");
  await click("Gegenstand speichern");
  await send("Page.navigate", { url: `http://127.0.0.1:5199/items/${saved.id}/bearbeiten` });
  await wait("document.querySelector('#item-catalog-search')?.value === 'Mobiltelefon'");
  assert.equal(await evaluate("document.body.textContent.includes('in den Stammdaten deaktiviert')"), true);
  assert.equal(await evaluate("JSON.parse(localStorage.getItem('losttrack:lostItems.records.v1'))[0].workflow.payments.FEE.dueCents"), 2000);
  await field("#item-catalog-search", "Natel");
  assert.equal(await evaluate("document.querySelectorAll('[role=option]').length"), 0);
  // Direkter Aufruf der Verwaltungsadresse als EDITOR muss ebenfalls gesperrt sein.
  await evaluate(`(async()=>{const users=await import('/src/core/storage/userRepo.js');
    users.createUser({name:'Testeditor',username:'testeditor',password:'test-password',role:'EDITOR',active:true});
    const auth=await import('/src/core/auth/auth.js');auth.login({username:'testeditor',password:'test-password'});})()`);
  await send("Page.navigate", { url: "http://127.0.0.1:5199/einstellungen/stammdaten" });
  await wait("document.body.textContent.includes('Berechtigung')");
  assert.equal(await evaluate("!!document.querySelector('[name=group_label]')"), false);
  assert.deepEqual(exceptions, []);
  log("Browserprüfung erfolgreich: kombiniertes Suchfeld mit Maus/Enter, Gebühren, Entwurf/Erfassung, Admin-Gruppen und Gegenstände, Deaktivierung, Bestandsschutz und EDITOR-Sperre.");
} finally {
  await send("Browser.close").catch(() => {});
  socket.close();
}
