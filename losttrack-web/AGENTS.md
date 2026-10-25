# LostTrack: Arbeitsregeln für dieses Projekt

## Ziel und Kommunikation

LostTrack soll eine zuverlässige Fundsachenverwaltung für ein kommunales Fundbüro in der Schweiz werden.

Der Projektverantwortliche ist Programmierlaie. Auf Deutsch kommunizieren, notwendige Fachbegriffe erklären und Schritte einfach und konkret beschreiben. Keine Programmierkenntnisse voraussetzen.

## Bestätigte Anforderungen des Projektverantwortlichen

Diese Anforderungen sind vereinbart; ihre Nennung bedeutet nicht, dass sie bereits vollständig umgesetzt oder getestet sind:

- Fundnummern im Format `YYYY-00001`.
- Entwürfe und definitive Erfassung.
- Suche und Statusverwaltung.
- Dokumentation von Ermittlungsschritten.
- Fund- und Herausgabequittungen.
- Ausdrückliche Auswahl bei der Erfassung: Finderlohn gewünscht oder Verzicht.
- Ein Verzicht steht ausdrücklich auf der Fundquittung. Eine Unterschrift am Schluss soll Übergabe und Erklärung abdecken; die rechtliche Eignung ist noch zu klären.
- Aufbewahrungsfristen nach Kalendermonaten.
- Schweizer Datumsformat `tt.mm.jjjj`.
- Kassenbuch mit Ein- und Auszahlungen.
- Nachvollziehbare Änderungsprotokolle.
- Benutzerrollen `ADMIN`, `EDITOR` und `VIEWER`.

## Bestätigte technische Bestandsaufnahme

Stand der Quellcodeprüfung: 25.10.2026. Bei Folgeaufgaben den aktuellen Code erneut berücksichtigen; diese Bestandsaufnahme ist keine dauerhafte Funktionsgarantie.

- Projektverzeichnis: `C:\Dev\LostTrack\losttrack-web`. Das Git-Hauptverzeichnis liegt eine Ebene darüber in `C:\Dev\LostTrack`.
- Browseranwendung mit React, React Router und Vite; JavaScript/JSX.
- `src/pages`: Bildschirmseiten; `src/components`: gemeinsame Oberflächenteile; `src/app`: Seitenzuordnung; `src/domain`: fachliche Regeln; `src/core/storage`: Speicherung; `src/core/auth`: Anmeldung und Rechte; `src/print`: Quittungsdarstellung.
- Geschäftsdaten werden im lokalen Browserspeicher gespeichert. Eine zentrale Datenbank und ein eigener Anwendungsserver sind im untersuchten Projekt nicht eingerichtet.
- Code für Erfassung, Entwürfe, Suche, Statuswechsel, Ermittlungsschritte, Quittungen, Finderlohnwahl, Fristen, Kassenbuch und Änderungsprotokolle ist vorhanden. Vollständige Arbeitsabläufe und Druckbilder wurden bei der Bestandsaufnahme nicht im Browser bestätigt.
- Die Fundquittung enthält einen ausdrücklichen Finderlohnverzicht und ein gemeinsames Unterschriftsfeld. Daraus folgt keine rechtliche Freigabe.
- Die Fristberechnung verwendet Kalendermonate und berücksichtigt Monatsenden. Die hinterlegten Zeiträume und rechtlichen Auslöser sind nicht verbindlich bestätigt.
- Anmeldung und Benutzerverwaltung verwenden unterschiedliche Benutzerbestände. Rollenprüfungen sind insbesondere bei Änderungen über die Detailseite und bei der definitiven Übernahme von Entwürfen lückenhaft.
- Es bestehen zwei getrennte Fundnummernzähler. Browserspeicherung, lokale Anmeldung und lokal veränderbare Protokolle reichen noch nicht als Nachweis eines zuverlässigen kommunalen Mehrbenutzerbetriebs.
- Eine Sicherungs-/Wiederherstellungsfunktion, automatische Funktionstests und eine automatische GitHub-Prüfkonfiguration wurden nicht gefunden. Es gibt keinen eingerichteten `test`-Befehl.
- Die letzte ausgeführte ESLint-Prüfung meldete 12 Fehler und 6 Warnungen, darunter React-Regelverletzungen in `src/pages/ItemDetail.jsx`. Diesen Stand bei späteren Arbeiten erneut prüfen.

## Ermittelte Start- und Prüfbefehle unter Windows

Im Projektverzeichnis ausführen:

```powershell
cd C:\Dev\LostTrack\losttrack-web
npm.cmd run dev
```

Die im Terminal ausgegebene Adresse im Browser öffnen. Den Entwicklungsserver mit `Strg+C` beenden. `npm.cmd` verwenden, wenn PowerShell `npm.ps1` wegen der Skriptrichtlinie blockiert; keine Änderung dieser Richtlinie voraussetzen.

| Befehl | Zweck und Grenzen |
| --- | --- |
| `npm.cmd run lint` | Vorhandene ESLint-Quelltextprüfung; ohne automatische Fehlerkorrektur. |
| `npm.cmd run build` | Erstellt die auslieferbare Fassung in `dist` und schreibt Dateien. Bei der Bestandsaufnahme nicht ausgeführt. |
| `npm.cmd run preview` | Zeigt eine bereits erstellte Fassung lokal an. Bei der Bestandsaufnahme nicht ausgeführt. |

`npm.cmd run dev` ist als Startbefehl in `package.json` hinterlegt; der Start wurde bei der Bestandsaufnahme nicht praktisch getestet. Node.js und Programmpakete waren vorhanden. Installation oder Aktualisierung von Paketen nicht als stillschweigenden Teil einer reinen Analyse behandeln.

Die voreingestellte lokale Anmeldung im Code lautet `admin` / `admin`; sie ist keine produktionsgeeignete Zugangslösung.

Im übergeordneten Ordner startet `start-losttrack-web.cmd` den Entwicklungsserver und öffnet fest Port 5173. Maßgeblich bleibt die tatsächliche Terminalausgabe. `Start_LostTrack.vbs` startet ein anderes Skript mit Entwicklungszeit-Erfassung und weiteren Abhängigkeiten.

## Vorgehen bei Änderungen

1. Vor Änderungen den Git-Status prüfen: `git status --short --branch`. Bei Bedarf bestehende Unterschiede mit `git diff` und `git diff --cached` lesen.
2. Vorhandene Änderungen und nicht erfasste Dateien des Projektverantwortlichen erhalten. Nichts ungefragt überschreiben, zurücksetzen, löschen oder in eigene Änderungen aufnehmen. Bei der Bestandsaufnahme war `C:\Dev\LostTrack\losttrack-vergleich.patch` nicht von Git erfasst; aktuellen Zustand erneut prüfen.
3. Änderungen in kleinen, nachvollziehbaren Schritten durchführen. Umfang auf die jeweilige Aufgabe begrenzen; keine beiläufigen Umbauten oder Fehlerkorrekturen.
4. Vorhandene Umsetzung im Code prüfen, bevor eine Funktion als vorhanden oder fertig bezeichnet wird. Quellcodeprüfung, ausgeführte Tests und praktische Browserprüfung klar unterscheiden.
5. Wichtige betroffene Abläufe nach Änderungen mit passenden Tests prüfen. Je nach Aufgabe gezielte automatische Tests und/oder konkrete Browserprüfungen verwenden, etwa für Entwurf → definitive Erfassung, Nummernvergabe, Rollenrechte, Fristen, Quittungen oder Kassenbuchungen. Keine echten Geschäftsdaten für Prüfungen verändern.
6. Die vorhandene Quelltextprüfung bei relevanten Codeänderungen ausführen. Bestehende Fehler von neu verursachten Fehlern unterscheiden. Fehlende oder nicht ausführbare Prüfungen offen benennen.
7. Ein erfolgreicher Build allein beweist keine fachlich korrekte Funktion. Insbesondere Rechte, Fristberechnung, Buchungen und Quittungsinhalt gesondert prüfen.
8. Bei reinen Dokumentationsaufgaben die Dokumentation und den Änderungsumfang prüfen; dafür sind weder ein Build noch eine Paketinstallation erforderlich.

## Offene Anforderungen und rechtliche Fragen

Ungeklärte Anforderungen nicht durch Annahmen ersetzen. Bei für die Umsetzung notwendigen offenen Punkten verbindliche Vorgaben erfragen. Technische Umsetzung und rechtliche Richtigkeit getrennt beurteilen; Kommentare, Gesetzesverweise und Konstanten im Code sind kein rechtlicher Nachweis.

Noch zu klären sind insbesondere:

- Zuständige Gemeinde und Kanton sowie verbindliche fachliche Vorgaben und Sonderfälle.
- Fristbeginn, Dauer, Aufbewahrung, Herausgabe und Voraussetzungen für Verwertung oder Eigentumsübergang. Die derzeit programmierten zwölf Monate beziehungsweise fünf Jahre sind keine bestätigte Rechtsvorgabe.
- Genehmigter Wortlaut für Finderlohnverzicht, Auslagenersatz und die gemeinsame Unterschrift.
- Vorgaben zur Aufbewahrung und Löschung von Personendaten, Quittungen und Protokollen.
- Anforderungen an gemeinsame Datenhaltung, Sicherung, Wiederherstellung und nachvollziehbare, geschützte Protokolle für den kommunalen Betrieb.

## Abschluss jeder Aufgabe

Verständlich und auf Deutsch berichten:

- Was wurde geändert? Bei einer Analyse ausdrücklich sagen, dass nichts geändert wurde.
- Was wurde tatsächlich geprüft und mit welchem Ergebnis?
- Was bleibt offen, wurde nicht getestet oder benötigt verbindliche Vorgaben?

Keine erfolgreiche Prüfung oder fertige Funktion behaupten, die nicht nachgewiesen wurde. Wenn sinnvoll, den nächsten kleinen Arbeitsschritt vorschlagen.
