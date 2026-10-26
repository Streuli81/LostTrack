# LostTrack mit erfundenen Fundsachen testen

Die Datei `LostTrack-Testdaten.json` enthält ausschließlich künstlich erzeugte
Beispiele: 15 definitive Fundsachen, 3 Entwürfe und 4 Benutzer. Alle Fundsachen
sind mit `TEST` gekennzeichnet. Namen, Adressen, Geldbeträge und Vorgänge sind
erfunden; es wurden keine Daten aus einem echten Browserbestand übernommen.

## Laden

Am besten ein separates Browserprofil für LostTrack-Tests verwenden. Im leeren
Testprofil LostTrack öffnen und mit `admin` / `admin` anmelden.

1. **Einstellungen → Übersicht → Sicherung wiederherstellen** öffnen.
2. `C:\Dev\LostTrack\losttrack-web\test-data\LostTrack-Testdaten.json` auswählen.
3. Die Vorschau muss 15 Fundsachen, 3 Entwürfe, 4 Benutzer und 3
   Kassenbucheinträge anzeigen.
4. Bestätigung sorgfältig lesen, aktivieren und **Daten jetzt ersetzen** wählen.
5. Mit einem der unten genannten Testkonten anmelden.

**Beim Einlesen wird der vorhandene Geschäftsdaten- und Benutzerbestand ersetzt.**
Wenn du dein bisheriges Browserprofil verwendest, zuerst dessen aktuellen Stand
herunterladen und sicher aufbewahren. Die Testdatei ergänzt vorhandene Daten nicht.
Andere LostTrack-Tabs und -Fenster vor dem Einlesen schließen.

## Zugangsdaten nach dem Einlesen

| Benutzername | Passwort | Rolle / Zweck |
| --- | --- | --- |
| `admin` | `admin` | Administration und sämtliche Abläufe |
| `editor` | `LostTrack-Test!` | Fundsachen bearbeiten, Quittungen und Buchungen |
| `viewer` | `LostTrack-Test!` | Nur ansehen; Änderungen müssen gesperrt sein |
| `inaktiv` | `LostTrack-Test!` | Deaktiviertes Konto; Anmeldung muss scheitern |

Diese öffentlich dokumentierten Passwörter nur für die Testkonten verwenden.
Die Wiederherstellung übernimmt diese Testkonten anstelle deiner bisherigen Konten.

## Welche Fundsache für welchen Test?

Über **Suche** nach der Fundnummer oder nach `TEST 01`, `TEST 02` usw. suchen.

| Fundnummer | Gegenstand | Ausgangslage und Test |
| --- | --- | --- |
| 2026-00001 | Schlüsselbund | Finderlohnverzicht. Fundquittung erstellen und prüfen, dass der Verzicht ausdrücklich erscheint und ein gemeinsames Unterschriftsfeld vorhanden ist. |
| 2026-00002 | Portemonnaie | Finderlohn gewünscht, Eigentümer unbekannt. Finderangaben ändern, ermitteln und Fundquittung ansehen. |
| 2026-00003 | Brille | Eigentümer bekannt, Finder verzichtet. Empfangsbestätigung ohne Finderlohn erstellen und Status danach auf zurückgegeben setzen. |
| 2026-00004 | Armbanduhr | Eigentümer bekannt, Finderlohn gewünscht; noch keine Buchung. Beispielsweise CHF 25 über die Eigentümerquittung einzahlen, anschließend über die Finderquittung auszahlen. |
| 2026-00005 | Rucksack | CHF 30 bereits über Eigentümerquittung eingezahlt, noch nicht ausgezahlt. Auszahlung testen. Ein weiterer Einnahmeversuch muss abgewiesen werden. |
| 2026-00006 | Kamera | CHF 40 eingezahlt und CHF 40 ausgezahlt. Protokoll und Kassenbuch ansehen; eine weitere Auszahlung muss abgewiesen werden. |
| 2026-00007 | Regenschirm | Bereits zurückgegeben, Empfangsbestätigung vorhanden. Status und Änderungsverlauf ansehen. |
| 2026-00008 | Mobiltelefon | Mehrere Ermittlungsschritte und eine Eigentümeränderung vorbereitet. Verlauf prüfen, weiteren Schritt ergänzen und einen Testschritt löschen. |
| 2026-00009 | Kopfhörer | Technisches Fristbeispiel „dringend“ am 25.10.2026. Prüfdatum 02.11.2026. |
| 2026-00010 | Veloschloss | Technisches Fristbeispiel „Warnung“ am 25.10.2026. Prüfdatum 05.12.2026. |
| 2026-00011 | Handschuhe | Prüfdatum 01.09.2026 liegt zurück; Anzeige „Prüfung erforderlich“. |
| 2026-00012 | Sporttasche | Aufbewahrungsbeginn fehlt; Anzeige „Prüfung erforderlich“. Datum ergänzen und Anzeige vergleichen. |
| 2026-00013 | Bargeld-Testumschlag | Erfundener Wert CHF 6000 und Kategorie Bargeld. Wert/Kategorie sind im Datenbestand angelegt; nicht jede technische Kennzeichnung wird bereits in der Oberfläche angezeigt. |
| 2026-00014 | Defekter Koffer | Bereits mit technischem Beispielstatus „verwertet“ abgeschlossen. Verlauf ansehen. |
| 2026-00015 | Fahrradhelm | Bereits mit technischem Beispielstatus „übertragen“ abgeschlossen. Verlauf ansehen. |

Die Fristanzeigen beziehen sich auf den Referenztag **25.10.2026** und können an
späteren Tagen anders ausfallen. Die Beispiele verwenden die vorhandene
Programmierung und bestätigen keine rechtlichen Fristen oder Voraussetzungen für
Herausgabe, Auszahlung oder Verwertung. Die Fälle 14 und 15 sind reine Statusbeispiele.

## Drei Entwürfe

In der **Übersicht** nach folgenden Bezeichnungen suchen:

| Entwurf | Was du damit testen kannst |
| --- | --- |
| TEST 16 – Entwurf unvollständig | Sachbearbeiter, Funddatum/-zeit/-ort, Finderkontakt und Finderlohnwahl fehlen. Weiterbearbeiten, ergänzen und mehrfach speichern: Es darf nur ein Entwurf bleiben. |
| TEST 17 – Entwurf vollständig | Direkt oder nach Weiterbearbeitung definitiv übernehmen. Danach muss er aus der Entwurfsliste verschwinden. |
| TEST 18 – Entwurf ohne Finderlohnwahl | Definitive Übernahme zunächst versuchen: Sie muss scheitern. Dann ausdrücklich Finderlohn oder Verzicht wählen und erneut übernehmen. |

Die Fundnummer wird erst bei der definitiven Erfassung vergeben; welche der drei
Entwurfsnummern als Nächstes verwendet wird, hängt von der Reihenfolge deiner Tests
ab. Die Eingangsnummernzähler beginnen beide nach `2026-00015`.

## Kassenbuch und Quittungen

### Neuer Ablauf in der Detailansicht

Die Testdatei enthält nun gespeicherte Ablaufpläne. Die Gebühren sind bei Fall 01
mit CHF 10.00 für den Schlüsselbund und bei Fall 08 mit CHF 20.00 für die
beispielhaft erfolgte Mobiltelefonvermittlung vorbereitet. Bei den anderen
definitiven Fällen steht die Gemeindegebühr auf CHF 0.00. Auslagen sind in diesen
Beispielen mit CHF 0.00 ausdrücklich geklärt; Finderlohn-Sollbeträge sind passend
zum Testfall vorbereitet.

1. Die gewünschte Sache öffnen und die Tabellen **Verbleib / Gesamtvorgang** sowie
   **Zahlungen** ansehen. Falls nötig den Plan über die aufklappbare Sektion
   **Gegenstände, Gebühren und offene Aufgaben festlegen** ändern und speichern.
2. Im Abschnitt **Persönliche Übergabe oder Zahlung vorbereiten** den Vorgang
   auswählen. Bei einer Teilherausgabe nur die tatsächlich übergebene Menge
   eintragen. Zahlungen in den getrennten Feldern Gebühren/Finderlohn/Auslagen
   erfassen. Eine reine Auszahlung an den Finder als **Nur Ein- / Auszahlung**
   mit dessen Namen bestätigen, getrennt von der Eigentümer-Herausgabe.
3. **Quittung vorbereiten und drucken** wählen. Nach dem Druckdialog die
   ausdrückliche Rückfrage beantworten. **Abgebrochen / nicht erfolgt** verändert
   weder Übergabe noch Zahlungsstand; erst die Ja-Bestätigung speichert beides.
4. Unter **Quittungen** den Nachdruck einer neuen bestätigten Quittung testen:
   Kassenbuch und Mengen dürfen unverändert bleiben.

Die vorbereiteten älteren Belege aus dem früheren Quittungsablauf bleiben
bewusst als Altbelege sichtbar. Sie enthalten keine gespeicherte Druckfassung;
für sie wird kein nachträglich erfundener Druckerfolg behauptet. Für einen
Snapshot-Nachdruck zunächst eine neue Quittung im neuen Ablauf bestätigen.
Die Fälle 07, 14 und 15 sind als vollständig erledigte Beispiele abgeschlossen;
für weitere Änderungen ist eine begründete Wiederöffnung erforderlich.

Weitere praktische Prüfungen beschreibt [WORKFLOW-TESTPLAN.md](../docs/WORKFLOW-TESTPLAN.md).

Vor deinen Änderungen enthält das Kassenbuch:

- Rucksack: Einnahme CHF 30.
- Kamera: Einnahme CHF 40 und Ausgabe CHF 40.
- Gesamt: Einnahmen CHF 70, Ausgaben CHF 40, Saldo CHF 30.

Die Buchungen tragen das Datum der Dateierzeugung. Für den ersten Vergleich alle
Zeiträume anzeigen oder den Tag der Erzeugung einschließen. Die Prüfkette muss
intakt sein. Die Datei enthält Quittungsmetadaten, keine fertig gespeicherten PDFs.
Über die Oberfläche kannst du weitere Testquittungen erstellen und im Druckdialog
als PDF speichern. Im neuen Ablauf entstehen Buchungen erst nach ausdrücklicher
Druck-/Vorgangsbestätigung; ein abgebrochener unbestätigter Druck erzeugt keine
neuen Buchungen. Bereits früher bestätigte Buchungen bleiben erhalten.

Nach beliebigen Tests kannst du die unveränderte Testdatei erneut einlesen, um zum
Ausgangsstand zurückzukehren. Dafür als ADMIN anmelden und die Ersetzung erneut
bestätigen. Falls du deinen bisherigen echten Bestand zurückhaben möchtest,
stattdessen deine eigene zuvor heruntergeladene Sicherung wiederherstellen.

## Erzeugung und Prüfung

Die Datei wurde mit den vorhandenen LostTrack-Speicherfunktionen in einem
flüchtigen Testspeicher erzeugt. Geprüft wurden das Sicherungsformat, die
Eintragszahlen, der Saldo, die Kassenbuch-Prüfkette, die genannten Fristzustände am
Referenztag und die Wiederherstellung samt Anmeldung in einem zweiten leeren
Testspeicher. Die praktische Bedienung aller Fälle im Browser ist damit noch nicht
bestätigt.

Bei Bedarf kannst du die künstliche Testdatei neu erzeugen:

```powershell
node scripts/create-test-data.mjs
```

Das überschreibt ausschließlich `test-data/LostTrack-Testdaten.json`, greift nicht
auf Browserdaten zu und installiert nichts. Ereigniszeitpunkte und interne
Quittungsnummern richten sich dabei nach dem Erzeugungszeitpunkt; die fachlichen
Beispieldaten und Fundnummern bleiben auf den dokumentierten Referenzstand bezogen.
