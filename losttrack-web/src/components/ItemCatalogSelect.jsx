import { useEffect, useState } from "react";
import { getCatalog } from "../core/storage/catalogRepo.js";
import { searchItems } from "../domain/itemCatalog.js";

export default function ItemCatalogSelect({ value, label, onChange }) {
  const [query, setQuery] = useState(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const catalog = getCatalog();
  const matches = searchItems(query || "", catalog);
  const current = catalog.items.find((entry) => entry.key === value);
  const selectedLabel = value ? label || current?.label || value : "";
  useEffect(() => {
    if (open) document.getElementById(`catalog-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, query]);
  function choose(key) {
    onChange(key); setQuery(null); setOpen(false); setActive(0);
  }
  return <div style={{ marginBottom: 14, position: "relative" }} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setQuery(null); }
  }}>
    <label htmlFor="item-catalog-search">Gegenstand suchen und auswählen</label>
    <input id="item-catalog-search" name="item_catalog" role="combobox" autoComplete="off"
      aria-expanded={open} aria-controls="item-catalog-options" aria-autocomplete="list"
      aria-activedescendant={open && matches[active] ? `catalog-option-${active}` : undefined}
      value={query ?? selectedLabel} placeholder="Zum Beispiel Handy, Natel, Schal oder Foular"
      onFocus={() => { setOpen(true); setActive(0); }} onClick={() => setOpen(true)}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          setActive((index) => Math.max(0, Math.min(matches.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
        } else if (event.key === "Enter" && open && matches[active]) {
          event.preventDefault(); choose(matches[active].key);
        } else if (event.key === "Escape") { setOpen(false); setQuery(null); }
      }} style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }} />
    {open && <div style={{ border: "1px solid #aaa", background: "white", color: "#111", maxHeight: 300, overflowY: "auto" }}>
      <ul id="item-catalog-options" role="listbox" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {matches.map((entry, index) => <li id={`catalog-option-${index}`} key={entry.key} role="option"
          aria-selected={index === active} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(entry.key)}
          style={{ padding: "8px 10px", cursor: "pointer", background: index === active ? "#deebff" : "white" }}>
          {entry.label} <small style={{ color: "#555" }}>– {catalog.groups.find((group) => group.id === entry.groupId)?.label}</small>
        </li>)}
      </ul>
      {!matches.length && <p style={{ padding: 10 }}>Kein Treffer. Suche ändern oder manuell erfassen.</p>}
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose("")}
        style={{ margin: 8 }}>Auswahl aufheben / manuell erfassen</button>
    </div>}
    <p role="status">{query !== null ? `${matches.length} Treffer. Bitte einen Vorschlag anklicken oder mit den Pfeiltasten und Enter auswählen.${selectedLabel ? ` Bisher ausgewählt: ${selectedLabel}.` : ""}`
      : selectedLabel ? `Ausgewählt: ${selectedLabel}${current?.active === false ? " (in den Stammdaten deaktiviert)" : ""}.`
        : "Suchwort eingeben und einen Vorschlag auswählen."}</p>
  </div>;
}
