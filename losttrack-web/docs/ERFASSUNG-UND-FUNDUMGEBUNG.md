# Erfassung, Zeitpunkte und Fundumgebung

Stand: 26.10.2026. Umsetzung und Quellenprüfung werden getrennt von offenen rechtlichen Fragen beschrieben.

## Bestätigte Vorgaben und Bedienung

- Bei neuen Fundsachen wird die Sachbearbeitung aus der angemeldeten Person übernommen. Das Feld ist nicht frei editierbar. Wer einen neuen Entwurf definitiv übernimmt, wird automatisch als Sachbearbeitung zugeordnet. Bei späterer Bearbeitung einer definitiven Sache bleibt die ursprüngliche Zuordnung erhalten; die ändernde Person wird weiterhin im Audit protokolliert.
- Der Erfassungszeitpunkt wird automatisch gespeichert: erstmals beim Speichern als Entwurf oder definitiver Erfassung. Datum und Zeit werden in Schweizer Darstellung und mit Zeitzone Europa/Zürich angezeigt. Erneutes Speichern und definitive Übernahme eines Entwurfs setzen diesen Zeitpunkt nicht neu.
- Funddatum und Fundzeit bleiben manuelle Angaben.
- Bekanntmachungsdatum und Bekanntmachungszeit werden vorerst manuell eingegeben. Noch nicht bekanntgemacht: beide Felder leer lassen. Bei einem eingetragenen Zeitpunkt werden Datum und Uhrzeit verlangt.
- Die frühere Bestätigung **Aufbewahrungsbeginn = Bekanntmachungszeitpunkt** wurde am 26.10.2026 ausdrücklich durch getrennte Zeitpunkte ersetzt. Neue Fälle speichern `MANUAL_SEPARATE` und `dateModel: SEPARATE`. Fund, Anzeige, Bekanntmachung, Eingang und tatsächlicher Aufbewahrungsbeginn sind unterschiedliche Angaben.
- Frühere Fälle mit `NOTICE_USER_POLICY` werden nicht stillschweigend umdatiert. Im Formular kann die bisherige Kopplung explizit aufgehoben werden. Ein als Polizeianzeige gekennzeichnetes altes Datum wird dabei in das neue Anzeigefeld übertragen; der bisherige Aufbewahrungsbeginn bleibt erhalten. Die Prüfgrenzen werden nach Kalendertagen/-monaten berechnet, nicht sekundengenau.

Die neue Erfassung verlangt eine Fundumgebung:

1. Öffentlicher Grund
2. Öffentliche Verkehrsmittel
3. Haus-/Anstaltsfund
4. Privatgrund
5. Sonstiges

## ÖV-Funde

Bei **Öffentliche Verkehrsmittel** erscheinen:

- Verkehrsunternehmen (für definitive Erfassung erforderlich; im Entwurf noch offen möglich)
- Linie / Kurs
- Haltestelle / Strecke
- Fahrtrichtung
- Fahrzeugnummer, falls bekannt

Diese Angaben sind manuell; es gibt keine automatische Zuordnung an VBZ, PostAuto, SBB oder einen Betreiber des Zimmerbergbus. Die konkrete Zuständigkeit muss anhand der Linie/des Fahrzeugs geprüft werden. Eine Ortsangabe wie „Horgen“ oder der Markenname „Zimmerbergbus“ bestimmt den Betreiber nicht automatisch.

In der Erfassung, Detailansicht und Übersicht wird auf die besondere Zuständigkeit hingewiesen. Solange noch Gegenstände vorhanden sind, lautet die Vorgangsanzeige **Weiterleitung an zuständiges Verkehrsunternehmen vorbereiten**. Dies ist eine vorbereitende Kennzeichnung; sie bestätigt weder Übergabe noch Zahlung. Der gespeicherte Verbleib bleibt bis zu einem tatsächlichen Vorgang unverändert.

Die normalen kommunalen Prüfgrenzen für Verwertung und Findererwerb werden für ÖV-Funde nicht berechnet. Alte kommunale Prüfdatumsfelder werden beim Speichern einer entsprechend umklassifizierten Sache geleert. Die Übersicht ordnet offene ÖV-Funde dem Hinweis **Prüfung erforderlich** zu. Es werden keine fremden Fristen von drei Monaten/einem Monat oder Gebühren eines Transportunternehmens in LostTrack übernommen.

Für Gebäude/Anstalt, Privatgrund und Sonstiges werden bis zu einer verbindlichen Klärung ebenfalls keine pauschalen kommunalen Prüfgrenzen angesetzt. Das ist eine technische Zurückhaltung bei ungeklärter Zuständigkeit, keine Behauptung eines bestimmten anderen Fristenregimes.

## Altbestand und Nachvollziehbarkeit

Bestehende Datensätze werden beim Öffnen nicht automatisch einer Fundumgebung zugewiesen. Historische Sachbearbeitung und unabhängig erfasste Aufbewahrungs-/Anzeigedaten werden nicht rückwirkend gekoppelt. Die neue Kopplung gilt für Einträge der neuen Erfassung (`captureVersion: 1`).

Fundumgebung, ÖV-Angaben und Erfassungszeitpunkt werden im Datensatz gespeichert, in Änderungen protokolliert und mit der vorhandenen Sicherung/Wiederherstellung erhalten. Neue Quittungssnapshots enthalten die Fundumgebung; ÖV-Fundquittungen zeigen das erfasste Unternehmen und, falls vorhanden, Linie/Strecke. Alte Drucksnapshots erhalten keine nachträglich erfundene Fundumgebung.

## Geprüfte Quellen und ihre Grenzen

Am 26.10.2026 öffentlich abgerufen:

- [Stadt Zürich: Rechtsgrundlage](https://www.stadt-zuerich.ch/vbz/de/beratung-service/fundbuero/rechtsgrundlage.html): Die Seite gibt Art. 720 Abs. 3 ZGB und Art. 77 VPB wieder und beschreibt die Abgabe an das Personal sowie die Rolle des Unternehmens. Daraus wird kein vollständiger rechtlicher Ablauf für Horgen abgeleitet.
- [Fundbüro Stadt Zürich](https://www.stadt-zuerich.ch/fundbuero): Die Stadt nennt VBZ/Forchbahn als Zuständigkeitsbereich und verweist bei Buslinien in der Agglomeration auf den jeweiligen Betrieb.
- [PostAuto: Fundservice](https://www3.postauto.ch/de/hilfe-und-kontakt/kundenservice/fundservice): PostAuto beschreibt den SBB-Fundservice und die Abgabe gefundener Gegenstände an einem bedienten SBB-Schalter. Die dort aufgeführten Gebühren werden nicht als Horgner Gebühren übernommen.
- [SZU: Zimmerbergbus](https://www.szu.ch/de/ueber-die-szu/zimmerbergbus/): Die SZU beschreibt ihre Marktverantwortung und mehrere Transportbeauftragte, darunter AHW, PostAuto und Bamert. Deshalb wird aus „Zimmerbergbus“ kein einzelner Betreiber automatisch festgelegt.

Die Webseitenprüfung ersetzt keine verbindliche Rechtsfreigabe und ist keine vollständige Prüfung des aktuellen Bundesrechts oder jeder einzelnen Linie.

## Offen

Aktuelle Weiterentwicklung: [FUNDREGIME-AUSLAGEN-UND-FUNDWERTE.md](FUNDREGIME-AUSLAGEN-UND-FUNDWERTE.md). Die dort beschriebenen getrennten Zeitpunkte und Sonderfallregeln gehen älteren Aussagen zur Kopplung vor.

Die Haus-/Anstaltsfunde sind inzwischen um getrennte Rollen, Übergabekette und eine ausdrücklich bestätigte Finderlohnsperre ergänzt. Die aktuellen Regeln und verbleibenden Rechtsfragen stehen in [HAUS-UND-ANSTALTSFUNDE.md](HAUS-UND-ANSTALTSFUNDE.md). Für diese Fundart ist die frühere allgemeine offene Finderlohnfrage durch die bestätigte Sperre konkretisiert; Auslagen und Eigentum bleiben getrennt zu behandeln.

- Rechtliche Bestätigung der betrieblichen Kopplung sowie der schon vorhandenen Prüfzeiträume für öffentliche Funde.
- Verbindlicher Ablauf für die persönliche Weiterleitung aus Horgen: zuständige Kontaktstellen, Übergabenachweis, allfällige Rückgabe direkt an Eigentümer und Voraussetzungen für den Gesamtabschluss. Diese Aufgabe ergänzt die Erfassung, richtet jedoch keinen neuen automatischen Übergabeablauf ein.
- Finderrolle/-lohn und Gebühren bei ÖV-/Anstaltsfunden. Bestehende Gebühren- und Finderlohnfelder werden durch diese Aufgabe nicht als rechtlich freigegeben erklärt und nicht stillschweigend mit fremden Tarifen belegt.
- Bei neuen besonderen Fundumgebungen bleibt der automatische Gebührenvorschlag deshalb **Gebühr noch nicht geprüft**, auch bei Auswahl eines Schlüssels oder Mobiltelefons. Eine bewusst manuelle Auswahl ist weiterhin möglich. Bestehende Gebührenpläne und Buchungen werden durch eine Umklassifizierung einer definitiven Sache nicht automatisch verändert und müssen fachlich geprüft werden.
- Konkrete Regeln für Gebäude/Anstalt, Privatgrund und Sonstiges.

## Prüfungen

`npm.cmd test` prüft zusätzlich automatische Benutzerzuordnung, stabile Erfassungszeitpunkte, gekoppelte Datums-/Zeitfelder, ungültige Angaben, ÖV-Zuständigkeit ohne automatische VBZ-Zuordnung, Aussetzen kommunaler Prüfgrenzen sowie Entwurf, Übernahme, Änderungen und Sicherung/Wiederherstellung. Altbestandsdaten bleiben getrennt geprüft.

`node scripts/check-capture-ui.mjs` prüft mit einem eigens gestarteten leeren Testbrowser auf Port 9237 und Entwicklungsserver auf Port 5199 die sichtbare Erfassung, einen Zimmerbergbus-Testfall vom Entwurf bis zur definitiven Erfassung und die Dashboard-Einordnung. Niemals gegen ein normales Benutzerprofil verwenden.
