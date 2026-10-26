import { test } from "node:test";
import assert from "node:assert/strict";
import { FEE_OPTIONS, normalizeWorkflow, getWorkflowSummary, validateWorkflowPlan, validateStoredWorkflow } from "../src/domain/workflow.js";

function item(extra = {}) {
  return { id: "item", status: "OPEN", item: { manualLabel: "Testgegenstand" },
    finder: { rewardChoice: "WAIVED", rewardRequested: false }, ...extra };
}
function planned(extra = {}) {
  const input = item(extra);
  const result = validateWorkflowPlan(input, {
    parts: [{ id: "main", label: "Testgegenstand", quantity: 1, handledQuantity: 0, feeCode: "NONE" }],
    rewardCents: 0, expensesCents: 0,
  });
  assert.equal(result.ok, true);
  return { ...input, workflow: result.workflow };
}
function handled(extra = {}) {
  const result = planned(extra);
  result.workflow.parts[0].handledQuantity = 1;
  result.status = "RETURNED";
  return result;
}

test("Horgner Gebühren unterscheiden Schlüssel, ganzen Bund, Vermittlung und Gebührenfreiheit", () => {
  const expected = { UNSET: null, NONE: 0, KEY: 1000, KEY_BUNDLE: 1000, MOBILE_MEDIATION: 2000 };
  assert.deepEqual(Object.fromEntries(FEE_OPTIONS.map((entry) => [entry.code, entry.cents])), expected);
  const result = validateWorkflowPlan(item(), { parts: [
    { id: "a", label: "Einzelner Schlüssel", quantity: 1, feeCode: "KEY" },
    { id: "b", label: "Bund mit fünf Schlüsseln", quantity: 1, feeCode: "KEY_BUNDLE" },
    { id: "c", label: "Zwei vermittelte Mobiltelefone", quantity: 2, feeCode: "MOBILE_MEDIATION" },
  ] });
  assert.equal(result.ok, true);
  assert.equal(result.workflow.payments.FEE.dueCents, 6000);
  assert.equal(result.workflow.parts[1].feeSnapshot.cents, 1000);
});

test("Normalisierung liest alte Datensätze ohne Mutation oder erfundene Gebührenfreiheit", () => {
  const source = item({ finderRewardDeposit: { received: true, amountCents: 5000 },
    finderReward: { paidAt: "2026-10-25T12:00:00Z", amountCents: 2000 },
    finder: { rewardChoice: "REQUESTED", rewardRequested: true } });
  const before = structuredClone(source);
  const normalized = normalizeWorkflow(source);
  assert.deepEqual(normalized.payments.REWARD, { dueCents: 5000, receivedCents: 5000, paidCents: 2000 });
  assert.equal(normalized.payments.FEE.dueCents, null);
  assert.equal(normalized.payments.EXPENSES.dueCents, null);
  assert.equal(normalized.parts[0].handledQuantity, 0);
  assert.deepEqual(source, before);
  normalized.parts[0].label = "Nicht im Original";
  assert.deepEqual(source, before);
});

test("Unbekannte Finderlohnwahl und Auslagen bleiben ungeklärt, auch bei Finderlohnverzicht", () => {
  assert.equal(normalizeWorkflow(item({ finder: { rewardRequested: false } })).payments.REWARD.dueCents, null);
  const waived = normalizeWorkflow(item());
  assert.equal(waived.payments.REWARD.dueCents, 0);
  assert.equal(waived.payments.EXPENSES.dueCents, null);
});

test("Auch ältere alternative Auszahlungsfelder werden übernommen", () => {
  const normalized = normalizeWorkflow(item({ finder: { rewardChoice: "REQUESTED" },
    finderRewardPayout: { paid: true, paidAt: "2026-10-25T12:00:00Z", amountCents: 2500 } }));
  assert.equal(normalized.payments.REWARD.paidCents, 2500);
  assert.equal(normalized.payments.REWARD.dueCents, 2500);
});

test("Vorhandene Gebührensnapshots behalten historische Beträge", () => {
  const input = planned();
  input.workflow.parts[0].feeCode = "KEY";
  input.workflow.parts[0].feeSnapshot = { code: "KEY", label: "Historischer Tarif", cents: 800,
    catalog: "ALT", version: 1 };
  assert.equal(normalizeWorkflow(input).payments.FEE.dueCents, 800);
  const result = validateWorkflowPlan(input, { parts: input.workflow.parts });
  assert.equal(result.workflow.payments.FEE.dueCents, 800);
  assert.equal(result.workflow.parts[0].feeSnapshot.catalog, "ALT");
});

test("Ein fremder Snapshot im Formular darf keine frei erfundenen Gebühren erzeugen", () => {
  const result = validateWorkflowPlan(planned(), { parts: [
    { id: "main", label: "Schlüssel", quantity: 1, feeCode: "KEY",
      feeSnapshot: { code: "KEY", cents: 1, label: "Manipuliert", version: 1 } },
  ] });
  assert.equal(result.workflow.payments.FEE.dueCents, 1000);
});

test("Status unterscheidet aufbewahrte, teilweise und vollständig ausgegebene Gegenstände", () => {
  const input = planned();
  input.workflow.parts[0].quantity = 2;
  assert.equal(getWorkflowSummary(input).physicalStatus, "STORED");
  input.workflow.parts[0].handledQuantity = 1;
  input.status = "RETURNED";
  const partial = getWorkflowSummary(input);
  assert.equal(partial.physicalStatus, "PARTIAL");
  assert.equal(partial.remainingParts[0].remainingQuantity, 1);
  assert.equal(partial.canClose, false);
  input.workflow.parts[0].handledQuantity = 2;
  assert.equal(getWorkflowSummary(input).physicalStatus, "RETURNED");
});

test("Abgegebene Sache mit offener Zahlung bleibt in Restabwicklung", () => {
  const input = handled({ finder: { rewardChoice: "REQUESTED", rewardRequested: true } });
  input.workflow.payments.REWARD = { dueCents: 3000, receivedCents: 3000, paidCents: 1000 };
  const summary = getWorkflowSummary(input);
  assert.equal(summary.physicalStatus, "RETURNED");
  assert.equal(summary.overallStatus, "SETTLEMENT_OPEN");
  assert.equal(summary.canClose, false);
  assert.ok(summary.blockers.some((message) => message.includes("Auszahlung")));
});

test("Vollständig erledigt ermöglicht Abschluss, setzt ihn aber nicht automatisch", () => {
  const input = handled();
  const ready = getWorkflowSummary(input);
  assert.equal(ready.canClose, true);
  assert.equal(ready.overallStatus, "READY_TO_CLOSE");
  assert.equal(ready.workflow.closedAt, null);
  input.workflow.closedAt = "2026-10-25T12:00:00Z";
  assert.equal(getWorkflowSummary(input).overallStatus, "CLOSED");
  input.workflow.blockedReason = "Neue Abklärung";
  assert.equal(getWorkflowSummary(input).overallStatus, "SETTLEMENT_OPEN");
});

test("Sperren, offene Entscheidungen und unbekannte Beträge verhindern den Abschluss", () => {
  for (const change of [
    (wf) => { wf.blockedReason = "Berechtigung ungeklärt"; },
    (wf) => { wf.decisionOpen = true; },
    (wf) => { wf.payments.EXPENSES.dueCents = null; },
  ]) {
    const input = handled();
    change(input.workflow);
    assert.equal(getWorkflowSummary(input).canClose, false);
  }
});

test("Auslagen benötigen bewusste Empfängerauswahl; Office und Finder haben verschiedene Zahlungswege", () => {
  const input = handled();
  input.workflow.payments.EXPENSES = { dueCents: 1500, receivedCents: 1500, paidCents: 0 };
  assert.equal(getWorkflowSummary(input).canClose, false);
  input.workflow.expensesRecipient = "OFFICE";
  assert.equal(getWorkflowSummary(input).canClose, true);
  input.workflow.expensesRecipient = "FINDER";
  assert.equal(getWorkflowSummary(input).canClose, false);
  input.workflow.payments.EXPENSES.paidCents = 1500;
  assert.equal(getWorkflowSummary(input).canClose, true);
});

test("Überzahlungen und ungültige Gegenstandsmengen sind kein abgeschlossener Vorgang", () => {
  const overpaid = handled();
  overpaid.workflow.payments.FEE.receivedCents = 1000;
  assert.equal(getWorkflowSummary(overpaid).canClose, false);
  const invalid = handled();
  invalid.workflow.parts[0].quantity = -1;
  assert.equal(getWorkflowSummary(invalid).canClose, false);
});

test("Plan verhindert Mengenmanipulation und Entfernen bereits übergebener Gegenstände", () => {
  const input = handled();
  const existing = input.workflow.parts[0];
  assert.equal(validateWorkflowPlan(input, { parts: [{ ...existing, handledQuantity: 0 }] }).ok, false);
  assert.equal(validateWorkflowPlan(input, { parts: [{ ...existing, quantity: 0 }] }).ok, false);
  assert.equal(validateWorkflowPlan(input, { parts: [{ id: "neu", label: "Neu", quantity: 1, feeCode: "NONE" }] }).ok, false);
  assert.equal(validateWorkflowPlan(input, { parts: [{ ...existing }, { ...existing }] }).ok, false);
});

test("Plan validiert Beträge und Gebühren und erhält gebuchte Zahlungsstände", () => {
  const input = planned({ finder: { rewardChoice: "REQUESTED" } });
  input.workflow.payments.REWARD = { dueCents: 3000, receivedCents: 2000, paidCents: 1000 };
  assert.equal(validateWorkflowPlan(input, { rewardCents: 1999 }).ok, false);
  assert.equal(validateWorkflowPlan(input, { rewardCents: null }).ok, false);
  assert.equal(validateWorkflowPlan(input, { expensesCents: 1.5 }).ok, false);
  const result = validateWorkflowPlan(input, { rewardCents: 3500,
    payments: { REWARD: { receivedCents: 999999 } } });
  assert.equal(result.ok, true);
  assert.equal(result.workflow.payments.REWARD.receivedCents, 2000);
  assert.equal(result.workflow.payments.REWARD.paidCents, 1000);
  assert.equal(validateWorkflowPlan(input, { parts: [{ ...input.workflow.parts[0], feeCode: "UNBEKANNT" }] }).ok, false);
});

test("Verzicht kann nicht durch einen positiven Finderlohnbetrag übergangen werden", () => {
  assert.equal(validateWorkflowPlan(planned(), { rewardCents: 500 }).ok, false);
  assert.equal(validateWorkflowPlan(planned(), { expensesCents: 500, expensesRecipient: "FINDER" }).ok, true);
});

test("Abgeschlossene Vorgänge werden nicht durch Planänderungen stillschweigend wieder geöffnet", () => {
  const input = handled();
  input.workflow.closedAt = "2026-10-25T12:00:00Z";
  assert.equal(validateWorkflowPlan(input, { expensesCents: 0 }).ok, false);
});

test("Gebührenwahl der Erfassung wird nur beim neuen Standardgegenstand übernommen", () => {
  assert.equal(normalizeWorkflow(item({ feeSelection: "KEY_BUNDLE" })).payments.FEE.dueCents, 1000);
  assert.equal(normalizeWorkflow(item({ feeSelection: "MOBILE_MEDIATION" })).payments.FEE.dueCents, 2000);
  assert.equal(normalizeWorkflow(item({ feeSelection: "UNBEKANNT" })).payments.FEE.dueCents, null);
  const existing = planned();
  existing.feeSelection = "KEY";
  assert.equal(normalizeWorkflow(existing).payments.FEE.dueCents, 0);
});

test("Gespeicherte Validierung akzeptiert Legacy und vollständige offene oder geschlossene Workflows", () => {
  assert.equal(validateStoredWorkflow(item()).ok, true);
  assert.equal(validateStoredWorkflow(item({ workflow: null })).ok, true);
  assert.equal(validateStoredWorkflow(planned()).ok, true);
  const input = handled();
  input.workflow.closedAt = "2026-10-25T12:00:00Z";
  assert.equal(validateStoredWorkflow(input).ok, true);
  input.workflow.parts[0].feeCode = "KEY";
  input.workflow.parts[0].feeSnapshot = { code: "KEY", label: "Historischer Betrag", cents: 900, version: 1 };
  input.workflow.payments.FEE = { dueCents: 900, receivedCents: 900, paidCents: 0 };
  assert.equal(validateStoredWorkflow(input).ok, true);
});

const storedCorruptions = [
  ["Version", (wf) => { wf.version = 2; }],
  ["fehlende Teile", (wf) => { wf.parts = []; }],
  ["doppelte IDs", (wf) => { wf.parts.push(structuredClone(wf.parts[0])); }],
  ["fehlende Bezeichnung", (wf) => { wf.parts[0].label = ""; }],
  ["Bruchzahl als Menge", (wf) => { wf.parts[0].quantity = 1.5; }],
  ["negative Übergabe", (wf) => { wf.parts[0].handledQuantity = -1; }],
  ["zu große Übergabe", (wf) => { wf.parts[0].handledQuantity = 2; }],
  ["Gebührenauswahl", (wf) => { wf.parts[0].feeCode = "UNBEKANNT"; }],
  ["Gebührensnapshot", (wf) => { wf.parts[0].feeSnapshot.code = "KEY"; }],
  ["Gebührensumme", (wf) => { wf.payments.FEE.dueCents = 1000; }],
  ["fehlende Zahlungsart", (wf) => { delete wf.payments.EXPENSES; }],
  ["unbekannter Sollbetrag", (wf) => { wf.payments.FEE.dueCents = "0"; }],
  ["negative Zahlung", (wf) => { wf.payments.REWARD.receivedCents = -1; }],
  ["Überzahlung", (wf) => { wf.payments.FEE.receivedCents = 1; }],
  ["Auszahlung über Guthaben", (wf) => { wf.payments.REWARD = { dueCents: 10, receivedCents: 0, paidCents: 10 }; }],
  ["Gebührenauszahlung", (wf) => { wf.payments.FEE = { dueCents: 0, receivedCents: 0, paidCents: 1 }; }],
  ["Empfänger", (wf) => { wf.expensesRecipient = "UNBEKANNT"; }],
  ["Sperre", (wf) => { wf.blockedReason = null; }],
  ["Entscheidung", (wf) => { wf.decisionOpen = 0; }],
  ["Abschlussdatum", (wf) => { wf.closedAt = "ungültig"; }],
  ["fehlende Historie", (wf) => { delete wf.movements; }],
  ["unbekannte Bewegung", (wf) => { wf.movements = [{ id: "m", kind: "SHIPPING", confirmedAt: "2026-10-25T12:00:00Z", parts: [{ partId: "main", quantity: 1 }] }]; }],
  ["unbekannter Gegenstand", (wf) => { wf.movements = [{ id: "m", kind: "OWNER_HANDOVER", confirmedAt: "2026-10-25T12:00:00Z", parts: [{ partId: "falsch", quantity: 1 }] }]; }],
];
for (const [name, corrupt] of storedCorruptions) {
  test(`Gespeicherte Validierung lehnt beschädigte Daten ab: ${name}`, () => {
    const input = planned();
    corrupt(input.workflow);
    const before = structuredClone(input);
    assert.equal(validateStoredWorkflow(input).ok, false);
    assert.deepEqual(input, before);
  });
}

test("Bestätigte Übergabemengen dürfen den dokumentierten Verbleib nicht übersteigen", () => {
  const input = handled();
  input.workflow.movements = [{ id: "m1", kind: "OWNER_HANDOVER", confirmedAt: "2026-10-25T12:00:00Z",
    receiptId: "q1", parts: [{ partId: "main", quantity: 1 }] }];
  assert.equal(validateStoredWorkflow(input).ok, true);
  input.workflow.movements.push({ ...structuredClone(input.workflow.movements[0]), id: "m2" });
  assert.equal(validateStoredWorkflow(input).ok, false);
});

test("Ein Abschlussdatum kann offene Gebühren oder andere Restarbeiten nicht überdecken", () => {
  const input = handled();
  input.workflow.closedAt = "2026-10-25T12:00:00Z";
  input.workflow.payments.EXPENSES.dueCents = null;
  assert.equal(validateStoredWorkflow(input).ok, false);
});

test("Gemischter endgültiger Verbleib wird nicht durch den letzten Legacy-Status verdeckt", () => {
  const input = handled();
  input.workflow.parts[0].quantity = 2;
  input.workflow.parts[0].handledQuantity = 2;
  input.workflow.movements = [
    { id: "m1", kind: "OWNER_HANDOVER", confirmedAt: "2026-10-25T12:00:00Z", parts: [{ partId: "main", quantity: 1 }] },
    { id: "m2", kind: "TRANSFER", confirmedAt: "2026-10-25T13:00:00Z", parts: [{ partId: "main", quantity: 1 }] },
  ];
  input.status = "TRANSFERRED";
  assert.equal(getWorkflowSummary(input).physicalStatus, "RESOLVED");
  assert.equal(validateStoredWorkflow(input).ok, true);
  input.workflow.movements = [input.workflow.movements[0]];
  assert.equal(getWorkflowSummary(input).physicalStatus, "RETURNED");
});
