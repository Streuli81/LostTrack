// Fachliche Nutzervorgabe für Horgen; keine unabhängige rechtliche Tarifprüfung.
const FEE_CATALOG = "HORGEN_USER_2026_10_25";
export const FEE_OPTIONS = [
  { code: "UNSET", label: "Gebühr noch nicht geprüft", cents: null },
  { code: "NONE", label: "Übrige Fundsache – gebührenfrei", cents: 0 },
  { code: "KEY", label: "Einzelner Schlüssel – CHF 10.00", cents: 1000 },
  { code: "KEY_BUNDLE", label: "Ganzer Schlüsselbund – CHF 10.00", cents: 1000 },
  { code: "MOBILE_MEDIATION", label: "Mobiltelefon vermittelt – CHF 20.00", cents: 2000 },
];
const CATEGORIES = ["FEE", "REWARD", "EXPENSES"];
const PHYSICAL_LABELS = {
  STORED: "Aufbewahrt", PARTIAL: "Teilweise herausgegeben / erledigt", RETURNED: "Vollständig herausgegeben",
  TRANSFERRED: "An zuständige Stelle übergeben", DISPOSED: "Verwertet", RESOLVED: "Verbleib vollständig dokumentiert",
};
const OVERALL_LABELS = {
  IN_PROGRESS: "In Bearbeitung", SETTLEMENT_OPEN: "Restabwicklung offen",
  READY_TO_CLOSE: "Vollständig erledigt – Abschluss möglich", CLOSED: "Abgeschlossen",
};
const isMoney = (value) => Number.isSafeInteger(value) && value >= 0;
const isPositiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
const clone = (value) => structuredClone(value);

function feeOption(code) { return FEE_OPTIONS.find((option) => option.code === code); }

function feeSnapshot(code, existing = null) {
  const option = feeOption(code);
  if (code !== "UNSET" && existing?.code === code && isMoney(existing.cents) &&
      typeof existing.label === "string" && existing.version === 1) return clone(existing);
  return { code, label: option?.label || "Unbekannte Gebührenauswahl", cents: option?.cents ?? null,
    catalog: FEE_CATALOG, version: 1 };
}

function feeTotal(parts) {
  let total = 0;
  for (const part of parts) {
    const cents = part.feeSnapshot?.cents;
    if (!feeOption(part.feeCode) || cents === null || !isMoney(cents) || !isPositiveInteger(part.quantity)) return null;
    total += cents * part.quantity;
    if (!isMoney(total)) return null;
  }
  return total;
}

function legacyReward(item) {
  const deposit = item?.finderRewardDeposit;
  const payout = item?.finderReward?.paidAt ? item.finderReward : item?.finderRewardPayout;
  const receivedCents = deposit?.received && isMoney(deposit.amountCents) ? deposit.amountCents : 0;
  const paidCents = (payout?.paidAt || payout?.paid) && isMoney(payout.amountCents) ? payout.amountCents : 0;
  const amount = Math.max(receivedCents, paidCents);
  return { receivedCents, paidCents, dueCents: amount > 0 ? amount : null };
}

export function normalizeWorkflow(item) {
  const stored = item?.workflow && typeof item.workflow === "object" ? item.workflow : {};
  const handledLegacy = ["RETURNED", "TRANSFERRED", "DISPOSED"].includes(item?.status);
  const sourceParts = Array.isArray(stored.parts) && stored.parts.length ? stored.parts : [{
    id: "main", label: item?.item?.manualLabel || item?.item?.predefinedKey || "Fundsache",
    quantity: 1, handledQuantity: handledLegacy ? 1 : 0,
    feeCode: feeOption(item?.feeSelection) ? item.feeSelection : "UNSET",
  }];
  const parts = sourceParts.map((part) => ({ ...clone(part),
    id: part.id ?? "", label: part.label ?? "", quantity: part.quantity ?? 1,
    handledQuantity: part.handledQuantity ?? 0, feeCode: part.feeCode ?? "UNSET",
    feeSnapshot: feeSnapshot(part.feeCode ?? "UNSET", part.feeSnapshot),
  }));
  const legacy = legacyReward(item);
  const rewardWaived = item?.finder?.rewardChoice === "WAIVED";
  const payments = {};
  for (const category of CATEGORIES) {
    const row = stored.payments?.[category] || {};
    const fallback = category === "REWARD" ? legacy : { receivedCents: 0, paidCents: 0, dueCents: null };
    payments[category] = {
      dueCents: row.dueCents === undefined ? fallback.dueCents : row.dueCents,
      receivedCents: row.receivedCents ?? fallback.receivedCents,
      paidCents: row.paidCents ?? fallback.paidCents,
    };
  }
  payments.FEE.dueCents = feeTotal(parts);
  if (rewardWaived) payments.REWARD.dueCents = 0;
  return {
    ...clone(stored), version: 1, parts, payments,
    movements: Array.isArray(stored.movements) ? clone(stored.movements) : [],
    blockedReason: typeof stored.blockedReason === "string" ? stored.blockedReason : "",
    decisionOpen: stored.decisionOpen === true,
    expensesRecipient: ["UNSET", "FINDER", "OFFICE"].includes(stored.expensesRecipient) ? stored.expensesRecipient : "UNSET",
    closedAt: stored.closedAt || null,
  };
}

function physicalStatus(item, workflow, remainingParts) {
  const anyHandled = workflow.parts.some((part) => part.handledQuantity > 0);
  if (remainingParts.length) return anyHandled ? "PARTIAL" : "STORED";
  const kinds = new Set(workflow.movements.map((movement) => {
    if (["OWNER_HANDOVER", "FINDER_HANDOVER"].includes(movement.kind)) return "RETURNED";
    if (movement.kind === "TRANSFER") return "TRANSFERRED";
    if (movement.kind === "DISPOSITION") return "DISPOSED";
    return "RESOLVED";
  }));
  if (kinds.size === 0 && ["RETURNED", "TRANSFERRED", "DISPOSED"].includes(item?.status)) return item.status;
  return kinds.size === 1 ? [...kinds][0] : "RESOLVED";
}

export function getWorkflowSummary(item) {
  const workflow = normalizeWorkflow(item);
  const blockers = [];
  const partIds = new Set();
  const invalidParts = workflow.parts.some((part) => {
    const duplicate = partIds.has(part.id);
    partIds.add(part.id);
    return typeof part.id !== "string" || !part.id.trim() || duplicate ||
      typeof part.label !== "string" || !part.label.trim() || !isPositiveInteger(part.quantity) ||
      !isMoney(part.handledQuantity) || part.handledQuantity > part.quantity;
  });
  if (invalidParts) blockers.push("Gegenstandsmengen sind ungültig und müssen geklärt werden.");
  const remainingParts = workflow.parts.map((part) => ({ ...part, remainingQuantity: part.quantity - part.handledQuantity }))
    .filter((part) => part.remainingQuantity > 0);
  if (remainingParts.length) blockers.push("Es befinden sich noch Gegenstände beim Fundbüro.");
  if (workflow.blockedReason.trim()) blockers.push(`Sperre: ${workflow.blockedReason.trim()}`);
  if (workflow.decisionOpen) blockers.push("Eine Entscheidung ist noch offen.");
  if (workflow.closedAt && (typeof workflow.closedAt !== "string" || !Number.isFinite(Date.parse(workflow.closedAt)))) blockers.push("Das Abschlussdatum ist ungültig.");
  const titles = { FEE: "Gebühren", REWARD: "Finderlohn", EXPENSES: "Auslagenersatz" };
  for (const category of CATEGORIES) {
    const row = workflow.payments[category];
    if (!isMoney(row.receivedCents) || !isMoney(row.paidCents)) {
      blockers.push(`${titles[category]}: Zahlungsdaten sind ungültig.`);
      continue;
    }
    if (row.dueCents === null) {
      blockers.push(`${titles[category]}: Betrag noch ungeklärt.`);
      continue;
    }
    if (!isMoney(row.dueCents)) { blockers.push(`${titles[category]}: Sollbetrag ist ungültig.`); continue; }
    if (row.receivedCents < row.dueCents) blockers.push(`${titles[category]}: Einzahlung noch offen.`);
    if (row.receivedCents > row.dueCents || row.paidCents > row.dueCents) blockers.push(`${titles[category]}: Überzahlung muss geklärt werden.`);
    const needsOutgoing = category === "REWARD" || (category === "EXPENSES" && workflow.expensesRecipient === "FINDER");
    if (category === "EXPENSES" && row.dueCents > 0 && workflow.expensesRecipient === "UNSET") {
      blockers.push("Auslagenersatz: Empfänger beziehungsweise Kostenträger noch ungeklärt.");
    }
    if (needsOutgoing && row.paidCents < row.dueCents) blockers.push(`${titles[category]}: Auszahlung noch offen.`);
    if (!needsOutgoing && row.paidCents > 0) blockers.push(`${titles[category]}: Nicht vorgesehene Auszahlung muss geklärt werden.`);
    if (row.paidCents > row.receivedCents) blockers.push(`${titles[category]}: Auszahlung übersteigt die Einzahlung.`);
  }
  if (!["WAIVED", "REQUESTED"].includes(item?.finder?.rewardChoice)) blockers.push("Die ausdrückliche Finderlohnwahl ist noch offen.");
  const state = physicalStatus(item, workflow, remainingParts);
  const canClose = blockers.length === 0;
  const overallStatus = canClose ? (workflow.closedAt ? "CLOSED" : "READY_TO_CLOSE")
    : state === "STORED" || state === "PARTIAL" ? "IN_PROGRESS" : "SETTLEMENT_OPEN";
  return { workflow, physicalStatus: state, physicalLabel: PHYSICAL_LABELS[state], overallStatus,
    overallLabel: OVERALL_LABELS[overallStatus], blockers, canClose, remainingParts, payments: workflow.payments };
}

export function validateWorkflowPlan(item, plan = {}) {
  const current = normalizeWorkflow(item);
  const fail = (error) => ({ ok: false, error });
  if (current.closedAt) return fail("Der Vorgang ist abgeschlossen. Vor Änderungen muss er wieder geöffnet werden.");
  const parts = plan.parts === undefined ? current.parts : plan.parts;
  if (!Array.isArray(parts) || !parts.length || parts.length > 100) return fail("Bitte 1 bis 100 Gegenstandspositionen erfassen.");
  const ids = new Set();
  const nextParts = [];
  for (const part of parts) {
    if (!part || typeof part.id !== "string" || !part.id.trim() || ids.has(part.id)) return fail("Jeder Gegenstand benötigt eine eindeutige ID.");
    ids.add(part.id);
    if (typeof part.label !== "string" || !part.label.trim()) return fail("Jeder Gegenstand benötigt eine Bezeichnung.");
    if (!isPositiveInteger(part.quantity)) return fail("Gegenstandsmengen müssen positive ganze Zahlen sein.");
    const old = current.parts.find((entry) => entry.id === part.id);
    const handledQuantity = old?.handledQuantity ?? 0;
    if (part.handledQuantity !== undefined && part.handledQuantity !== handledQuantity) return fail("Bereits übergebene Mengen können nicht im Plan geändert werden.");
    if (!isMoney(handledQuantity) || part.quantity < handledQuantity) return fail("Die Menge darf nicht kleiner als die bereits behandelte Menge sein.");
    if (!feeOption(part.feeCode)) return fail("Bitte eine gültige Gebührenposition auswählen.");
    nextParts.push({ id: part.id, label: part.label.trim(), quantity: part.quantity, handledQuantity,
      feeCode: part.feeCode, feeSnapshot: feeSnapshot(part.feeCode, old?.feeCode === part.feeCode ? old.feeSnapshot : null) });
  }
  if (current.parts.some((part) => part.handledQuantity > 0 && !ids.has(part.id))) return fail("Bereits behandelte Gegenstände dürfen nicht entfernt werden.");
  const reward = plan.rewardCents === undefined ? current.payments.REWARD.dueCents : plan.rewardCents;
  const expenses = plan.expensesCents === undefined ? current.payments.EXPENSES.dueCents : plan.expensesCents;
  if ((reward !== null && !isMoney(reward)) || (expenses !== null && !isMoney(expenses))) return fail("Beträge müssen in ganzen Rappen angegeben werden oder noch ungeklärt bleiben.");
  if (item?.finder?.rewardChoice === "WAIVED" && reward !== 0 && reward !== null) return fail("Bei ausdrücklich erklärtem Verzicht darf kein Finderlohn angesetzt werden.");
  const recipient = plan.expensesRecipient === undefined ? current.expensesRecipient : plan.expensesRecipient;
  if (!["UNSET", "FINDER", "OFFICE"].includes(recipient)) return fail("Bitte einen gültigen Empfänger des Auslagenersatzes auswählen.");
  if (plan.blockedReason !== undefined && typeof plan.blockedReason !== "string") return fail("Die Sperrbegründung muss als Text angegeben werden.");
  const next = { ...current, parts: nextParts, expensesRecipient: recipient,
    blockedReason: plan.blockedReason === undefined ? current.blockedReason : String(plan.blockedReason).trim(),
    decisionOpen: plan.decisionOpen === undefined ? current.decisionOpen : plan.decisionOpen,
    payments: clone(current.payments) };
  if (typeof next.decisionOpen !== "boolean") return fail("Die offene Entscheidung muss ausdrücklich mit Ja oder Nein angegeben werden.");
  next.payments.FEE.dueCents = feeTotal(nextParts);
  next.payments.REWARD.dueCents = item?.finder?.rewardChoice === "WAIVED" ? 0 : reward;
  next.payments.EXPENSES.dueCents = expenses;
  for (const category of CATEGORIES) {
    const row = next.payments[category];
    if (row.dueCents !== null && (row.dueCents < row.receivedCents || row.dueCents < row.paidCents)) return fail("Der Sollbetrag darf nicht unter bereits gebuchte Ein- oder Auszahlungen gesenkt werden.");
    if (row.dueCents === null && (row.receivedCents > 0 || row.paidCents > 0)) return fail("Ein bereits bebuchter Betrag darf nicht wieder als ungeklärt markiert werden.");
  }
  if (recipient !== "FINDER" && next.payments.EXPENSES.paidCents > 0) return fail("Der Kostenträger kann nach einer Auslagenauszahlung nicht so geändert werden.");
  return { ok: true, workflow: next };
}

// Gespeicherte Daten vor Import und Finanzvorgängen unverändert prüfen.
// normalizeWorkflow ist bewusst keine Validierung: Es ergänzt auch Legacy-Felder.
export function validateStoredWorkflow(item) {
  if (item?.workflow === undefined || item.workflow === null) return { ok: true };
  const stored = item.workflow;
  const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const fail = (message) => ({ ok: false, error: `Ungültige Workflow-Daten: ${message}` });
  const date = (value) => typeof value === "string" && Number.isFinite(Date.parse(value));
  if (!object(stored) || stored.version !== 1) return fail("Nicht unterstützte Workflow-Version.");
  if (!Array.isArray(stored.parts) || !stored.parts.length || stored.parts.length > 100) return fail("Die Gegenstandsliste ist ungültig.");
  const ids = new Set();
  for (const part of stored.parts) {
    if (!object(part) || typeof part.id !== "string" || !part.id.trim() || ids.has(part.id) ||
      typeof part.label !== "string" || !part.label.trim()) return fail("Gegenstände benötigen eindeutige IDs und Bezeichnungen.");
    ids.add(part.id);
    if (!isPositiveInteger(part.quantity) || !isMoney(part.handledQuantity) || part.handledQuantity > part.quantity) return fail("Die Gegenstandsmengen sind ungültig.");
    const snapshot = part.feeSnapshot;
    if (!feeOption(part.feeCode) || !object(snapshot) || snapshot.code !== part.feeCode ||
      snapshot.version !== 1 || typeof snapshot.label !== "string" ||
      (snapshot.catalog !== undefined && typeof snapshot.catalog !== "string") ||
      (part.feeCode === "UNSET" ? snapshot.cents !== null : !isMoney(snapshot.cents))) {
      return fail("Eine gespeicherte Gebührenposition ist ungültig.");
    }
  }
  if (!object(stored.payments)) return fail("Die Zahlungsstände fehlen.");
  for (const category of CATEGORIES) {
    const row = stored.payments[category];
    if (!object(row) || (row.dueCents !== null && !isMoney(row.dueCents)) ||
      !isMoney(row.receivedCents) || !isMoney(row.paidCents) || row.paidCents > row.receivedCents) return fail("Ein Zahlungsstand ist ungültig.");
    if (row.dueCents === null ? row.receivedCents > 0 || row.paidCents > 0
      : row.receivedCents > row.dueCents || row.paidCents > row.dueCents) return fail("Ein Zahlungsstand enthält ungeklärte Buchungen oder eine Überzahlung.");
    if (category === "FEE" && row.paidCents !== 0) return fail("Gebühren enthalten eine nicht vorgesehene Auszahlung.");
  }
  if (stored.payments.FEE.dueCents !== feeTotal(stored.parts)) return fail("Gebührensumme und gespeicherte Positionen stimmen nicht überein.");
  if (item?.finder?.rewardChoice === "WAIVED" && stored.payments.REWARD.dueCents !== 0) return fail("Finderlohnverzicht und Sollbetrag widersprechen sich.");
  if (!["UNSET", "FINDER", "OFFICE"].includes(stored.expensesRecipient)) return fail("Der Auslagenempfänger ist ungültig.");
  if (stored.expensesRecipient !== "FINDER" && stored.payments.EXPENSES.paidCents > 0) return fail("Auslagenauszahlung ohne passenden Empfänger.");
  if (typeof stored.blockedReason !== "string" || typeof stored.decisionOpen !== "boolean" ||
    (stored.closedAt !== null && !date(stored.closedAt))) return fail("Sperre, Entscheidung oder Abschlussdatum sind ungültig.");
  if (!Array.isArray(stored.movements)) return fail("Die Übergabehistorie fehlt.");
  const movementIds = new Set();
  const quantities = new Map();
  for (const movement of stored.movements) {
    if (!object(movement) || typeof movement.id !== "string" || !movement.id.trim() || movementIds.has(movement.id) ||
      !["OWNER_HANDOVER", "FINDER_HANDOVER", "TRANSFER", "DISPOSITION"].includes(movement.kind) ||
      !date(movement.confirmedAt) || !Array.isArray(movement.parts) || !movement.parts.length) return fail("Eine bestätigte Übergabe ist ungültig.");
    movementIds.add(movement.id);
    if (movement.receiptId !== undefined && (typeof movement.receiptId !== "string" || !movement.receiptId.trim())) return fail("Eine Quittungsreferenz ist ungültig.");
    if (movement.dispositionStatus !== undefined && !["TRANSFERRED", "DISPOSED"].includes(movement.dispositionStatus)) return fail("Eine Verbleibsentscheidung ist ungültig.");
    const partIds = new Set();
    for (const line of movement.parts) {
      if (!object(line) || !ids.has(line.partId) || partIds.has(line.partId) || !isPositiveInteger(line.quantity)) return fail("Eine Übergabe verweist auf ungültige Gegenstände oder Mengen.");
      partIds.add(line.partId);
      const next = (quantities.get(line.partId) || 0) + line.quantity;
      if (!isMoney(next) || next > stored.parts.find((part) => part.id === line.partId).handledQuantity) return fail("Die Übergabehistorie überschreitet den dokumentierten Verbleib.");
      quantities.set(line.partId, next);
    }
  }
  if (stored.closedAt && !getWorkflowSummary(item).canClose) return fail("Ein abgeschlossener Vorgang enthält noch offene Arbeitsschritte.");
  return { ok: true };
}
