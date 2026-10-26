# LostTrack

Fundsachenverwaltung für ein kommunales Fundbüro in der Schweiz. Die Anwendung
speichert ihre Daten derzeit lokal im jeweiligen Browser.

## Lokal auf Windows starten

Im Terminal im Projektordner ausführen:

```powershell
npm.cmd run dev
```

Die im Terminal ausgegebene Adresse öffnen. Beenden mit `Strg+C`.

## Benutzer anlegen und anmelden

1. Mit einem bestehenden ADMIN-Konto anmelden. Bei einer frischen lokalen
   Einrichtung lautet die Anmeldung `admin` / `admin`.
2. Unter **Einstellungen → Benutzer** Name, Benutzername, Passwort und Rolle
   erfassen. **Aktiv** muss für eine Anmeldung eingeschaltet sein.
3. **Benutzer erstellen** wählen.
4. Zum Wechseln **Abmelden** wählen und mit den neuen Zugangsdaten anmelden.

Anmeldung und Benutzerverwaltung verwenden denselben Benutzerbestand. Nur ein
angemeldeter ADMIN kann Benutzer anlegen, ändern oder löschen. Ein deaktiviertes
oder gelöschtes Konto gilt auch mit einer bereits gespeicherten Sitzung nicht mehr
als angemeldet. Der letzte aktive ADMIN mit Passwort kann nicht deaktiviert oder
auf eine andere Rolle umgestellt werden.

### Übernahme bisheriger Benutzer

Beim ersten Zugriff auf die neue Benutzerverwaltung werden die beiden alten
Benutzerbestände einmalig in einen gemeinsamen Bestand übernommen. Die alten
Speichereinträge bleiben unverändert erhalten. Bestehende Anmeldekonten behalten
ihre Passwörter und ihren Aktivierungsstatus. Der alte Benutzerwechsel ohne
Passwort wird nicht als Anmeldung übernommen.

Alte Verwaltungskonten hatten kein Anmeldepasswort. Sie bleiben erhalten und
zeigen **Passwort festlegen** an. Ein ADMIN kann über **Passwort festlegen / ändern**
ein Passwort vergeben. Erst danach ist eine Anmeldung möglich, sofern das Konto
aktiv ist. Bei gleichen Benutzernamen bleiben beide Konten erhalten; das zusätzlich
übernommene Verwaltungskonto erhält beispielsweise `admin-alt1`. Die Namen und
Rollen dieser getrennten Konten sollten vom ADMIN geprüft werden.

Fundsachen, Kassenbuch und Änderungsprotokolle werden bei dieser Übernahme nicht
verändert. Die Übernahme läuft erst im verwendeten Browser; bei der Entwicklung
werden keine echten Browserdaten gelesen oder verändert.

## Technische Prüfungen

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Die Tests verwenden den eingebauten Node.js-Testläufer und ausschließlich einen
flüchtigen Testspeicher. Sie prüfen Benutzeranlage, Anmeldung, Änderungen,
Deaktivierung, Schutz des letzten Admins und die Übernahme bisheriger Konten.
Zusätzlich werden Sicherung und Wiederherstellung einschließlich ungültiger
Dateien, Zugriffsrechten, Abmeldung und Zurücksetzen nach Speicherfehlern geprüft.
Es sind keine zusätzlichen Testpakete erforderlich.

## Entwürfe weiterbearbeiten

Für **Haus-/Anstaltsfunde** (beispielsweise Spital oder Geschäftslokal) werden
Einrichtung, Übergabekette, ursprüngliche Fundperson, Überbringer und rechtlich
relevante Finderstelle getrennt erfasst. Finderlohn ist bei dieser Fundart
gesperrt; es wird kein persönlicher Verzicht der Fundperson erklärt. Finderrechte
und Eigentum werden nicht automatisch zugewiesen. Bedienung und offene rechtliche
Punkte: [HAUS-UND-ANSTALTSFUNDE.md](docs/HAUS-UND-ANSTALTSFUNDE.md).

Neue Fundsachen übernehmen die Sachbearbeitung automatisch aus der Anmeldung.
Erfassungsdatum/-zeit werden automatisch gespeichert; Fund, Anzeige, Bekanntmachung,
Eingang und tatsächlicher Aufbewahrungsbeginn werden getrennt manuell angegeben.
Die frühere Kopplung an die Bekanntmachung gilt nicht mehr für neue Fälle.
Unter **Fundart / Fundregime** werden gewöhnliche Funde, Haus-/Anstaltsfunde,
ÖV-Funde und Sonderfälle bewusst eingeordnet. Unter **Fundumgebung** lassen
sich öffentliche Funde, ÖV-Funde, Gebäude/Anstalt, Privatgrund und Sonstiges trennen.
ÖV-Funde erhalten zusätzliche Angaben und keine normale Horgner Aufbewahrungsfrist.
Bedienung, Altbestandsverhalten und offene Rechtsfragen stehen in
[ERFASSUNG-UND-FUNDUMGEBUNG.md](docs/ERFASSUNG-UND-FUNDUMGEBUNG.md).

Auslagen können unabhängig von einer Zahlungsbuchung angemeldet und mit Begründung
geprüft werden. Der Status **Bezahlt** benötigt einen passenden bestätigten
Auslagen-Auszahlungsbeleg. Der konkrete Anspruchsteller ist separat zu erfassen;
ein Überbringer erhält nicht automatisch Finderrechte. Fundbargeld und andere
Inhalte lassen sich als eigene Bestandteile dokumentieren, ohne sie als Gebühr zu
buchen. Erlöse und offene Fundwerte verhindern einen voreiligen Gesamtabschluss.
Details und Grenzen: [FUNDREGIME-AUSLAGEN-UND-FUNDWERTE.md](docs/FUNDREGIME-AUSLAGEN-UND-FUNDWERTE.md).

1. Als ADMIN oder EDITOR unter **Neue Fundsache** Angaben erfassen und
   **Entwurf speichern** wählen. Noch fehlende Pflichtangaben sind bei einem
   Entwurf erlaubt; vorhandene Formatfehler werden angezeigt.
2. Zur **Übersicht** wechseln und beim gewünschten Entwurf
   **Entwurf weiterbearbeiten** wählen. Die Übersicht zeigt alle Entwürfe an.
3. Angaben ergänzen und erneut **Entwurf speichern** wählen. Derselbe Eintrag
   wird aktualisiert; es entsteht kein zweiter Entwurf.
4. Wenn die Pflichtangaben vollständig sind, **Definitiv erfassen** wählen.
   Danach öffnet sich die Detailansicht, und der Entwurf verschwindet aus der
   Entwurfsliste. Die definitive Übernahme erfolgt im geöffneten Formular.

Die angezeigte Fundnummer eines Entwurfs ist eine Vorschau und noch nicht
verbindlich. Entwürfe erhalten eine eigene interne ID; auch ältere Entwürfe ohne
ID können geladen und beim nächsten Speichern mit einer festen ID versehen
werden. Eine wiederholte Übernahme derselben Entwurfs-ID erzeugt keinen weiteren
definitiven Datensatz und überschreibt keine späteren Bearbeitungen.
Bereits definitive Fundsachen werden über **Bearbeiten → Änderungen speichern**
geändert und können nicht erneut als Entwurf gespeichert werden.

Ein nicht mehr vorhandener Entwurf zeigt einen Hinweis statt eines leeren
Erfassungsformulars. VIEWER haben keinen Zugriff auf die Entwurfsbearbeitung.
Die zwei bisherigen Fundnummernzähler sind weiterhin getrennt; ihre
Vereinheitlichung ist ein eigener Arbeitsschritt.

Automatisch geprüft wurden feste IDs, wiederholtes Speichern, fehlende
Pflichtangaben, definitive und wiederholte Übernahme, ältere Entwürfe ohne ID,
Rollenrechte und der Erhalt von Entwürfen nach einer Wiederherstellung.
Die praktische Browserprüfung dieses neuen Ablaufs steht noch aus: Mit Testdaten
einen unvollständigen Entwurf speichern, über die Übersicht wieder öffnen,
ergänzen und speichern. Danach prüfen, dass nur ein Entwurf vorhanden ist,
und ihn definitiv erfassen. Anschließend die Übersicht aktualisieren und prüfen,
dass genau eine definitive Fundsache und kein zugehöriger Entwurf vorhanden sind.

Der Build erzeugt Dateien in `dist`. Ein erfolgreicher Build ersetzt keine
Funktionstests. Die allgemeine ESLint-Prüfung enthält weiterhin bekannte Fehler
in anderen Anwendungsbereichen. Eine vollständige Browserprüfung steht noch aus.

## Herausgabe, Gebühren und Gesamtabschluss

Die Detailansicht trennt jetzt **Verbleib der Gegenstände**, **Zahlungen** und
**Gesamtabschluss**. Eine herausgegebene Sache bleibt als Vorgang offen, solange
beispielsweise ein Teil des Finderlohns noch auszuzahlen ist.

1. Unter **Gegenstände, Gebühren und offene Aufgaben festlegen** die Gegenstände
   erfassen. Es gibt kein Mengenfeld. Bisher gespeicherte Mengen bleiben erhalten.
   Für jeden Gegenstand die Gebührenauswahl bewusst treffen:
   **Schlüssel CHF 10.00** (auch für einen ganzen Bund), tatsächlich
   vermitteltes Mobiltelefon CHF 20.00, sonst gebührenfrei. Bei der Neuerfassung
   steht die Gebührenauswahl bereits im Formular zur Verfügung.
2. Finderlohn und Auslagenersatz separat festlegen. **Leer** bedeutet ungeklärt;
   wenn keine Auslagen bestehen, ausdrücklich **0.00** eintragen. Bei Auslagen den
   Kostenträger beziehungsweise Empfänger auswählen. Danach **Plan speichern**.
3. Unter **Schreiben vorbereiten und drucken** aus genau drei Schreiben wählen:
   **Fundquittung**, **Herausgabe an Eigentümer**, **Herausgabe an Finder**.
   Bei einer Herausgabe die zu übergebenden Gegenstände anhaken; es wird jeweils
   der noch vorhandene Bestand dieser Position übernommen. Empfänger und nur die
   tatsächlich auszuführenden Zahlungen angeben. Für eine spätere Zahlung beim
   passenden Herausgabeschreiben **Nur Zahlung zu diesem Schreiben** wählen.
   Dies bestätigt keine weitere Gegenstandsübergabe. Für verschiedene Personen
   getrennte Quittungen erstellen.
4. **Quittung vorbereiten und drucken** öffnet den Druckablauf. Dabei werden
   zunächst weder Übergabe noch Zahlung gespeichert. Danach nur dann **Ja,
   gedruckt und Vorgang tatsächlich erfolgt** wählen, wenn Ausdruck und Übergabe
   beziehungsweise Zahlung tatsächlich erfolgt sind. Bei Abbruch bleibt alles
   unbestätigt. Bereits früher bestätigte Zahlungen bleiben erhalten.
5. Neue Quittungen lassen sich unverändert **nachdrucken**. Dabei entsteht keine
   zweite Buchung. Nachträgliche Änderungen am Namen, Tarif oder Gegenstand ändern
   die gespeicherte Druckfassung nicht. Alte Quittungen ohne gespeicherten
   Snapshot bleiben als Altbelege sichtbar, erhalten aber keinen erfundenen
   Nachweis eines erfolgreichen früheren Ausdrucks.
6. **Vorgang vollständig abschließen** ist erst möglich, wenn sämtliche Teile
   abschließend behandelt, alle erforderlichen Ein-/Auszahlungen vollständig
   erledigt und keine Sperren oder Entscheidungen offen sind. Für spätere
   Änderungen ist eine begründete, protokollierte Wiederöffnung erforderlich.

Einzelne Gegenstandspositionen und Teilzahlungen sind möglich. Innerhalb einer
Position ist in der Oberfläche keine Teilmenge mehr auswählbar. Verwertung wird
unter **Verwertung dokumentieren (kein Schreiben)** ausschliesslich
als bereits fachlich freigegebene Maßnahme mit Begründung dokumentiert; ein
Fristablauf gibt nichts automatisch frei. Erlasse, Rückerstattungen und andere
ungeklärte Ausnahmen werden nicht durch erfundene Buchungsregeln ersetzt.

Die Sicherung prüft und erhält auch die neuen Workflow- und Quittungsdaten.
Die Fundquittung enthält keine Gebührenpositionen oder Betragstabelle. Die
ausdrückliche Finderlohnwahl und der vereinbarte Verzichtstext mit gemeinsamem
Unterschriftsfeld bleiben erhalten; dies ist keine rechtliche Freigabe.
Die Druckdarstellung blendet den übrigen Seiteninhalt vollständig aus, damit
dieser keine leeren Zusatzseiten erzeugt. Kurze Fund-, Eigentümer- und
Finderquittungen wurden als einseitige A4-PDFs geprüft; lange Inhalte können auf
weitere Seiten fliessen. Ein echter Papierausdruck bleibt manuell zu prüfen.
Die Oberfläche wurde automatisiert mit künstlichen Daten in einem separaten
Edge-Profil geprüft, einschließlich PDF und Nachdruck. Der Druckaufruf war dabei
simuliert; der echte Druckdialog beziehungsweise Papierdruck bleibt manuell zu
prüfen. Die vollständige Anleitung steht im
[Workflow-Testplan](docs/WORKFLOW-TESTPLAN.md), die bestätigten Vorgaben und offenen
Fragen in [WORKFLOW.md](docs/WORKFLOW.md).

## Berechtigungen

| Vorgang | ADMIN | EDITOR | VIEWER |
| --- | --- | --- | --- |
| Fundsachen suchen, ansehen und Bericht drucken | Ja | Ja | Ja |
| Entwürfe speichern und definitiv erfassen | Ja | Ja | Nein |
| Fundsachen, Status und Personenangaben ändern | Ja | Ja | Nein |
| Ermittlungsschritte hinzufügen oder löschen | Ja | Ja | Nein |
| Quittungen erstellen | Ja | Ja | Nein |
| Kassenbuch ansehen und drucken | Ja | Ja | Ja |
| Ein- und Auszahlungen buchen | Ja | Ja | Nein |
| Benutzer verwalten | Ja | Nein | Nein |
| Stammdaten verwalten | Ja | Nein | Nein |
| Änderungsprotokoll (Audit) in den Einstellungen ansehen | Ja | Nein | Nein |
| Daten sichern und wiederherstellen | Ja | Nein | Nein |

Die bestehende Rollenverteilung wurde beibehalten und ihre Prüfung in den
Fundsachen-Speicherfunktionen ergänzt. VIEWER sehen Personenangaben als gesperrte
Felder; Speicher- und Quittungsschaltflächen werden ausgeblendet oder gesperrt.
Die definitive Übernahme eines Entwurfs ist für VIEWER ebenfalls nicht verfügbar.
Berichtsdruck und Kassenbuchdruck verändern keine Geschäftsdaten und bleiben
verfügbar. Die technische Zuordnung erlaubt keine Aussage über die rechtlichen
Voraussetzungen einer Herausgabe oder Verwertung.

Die automatischen Rollentests prüfen sowohl erlaubte als auch abgewiesene
Schreibvorgänge. Bei einer Abweisung dürfen auch Nummernzähler, Änderungsprotokolle
und Kassenbuch nicht verändert werden. Abgemeldete und deaktivierte Konten sowie
unbekannte Rollen werden ebenfalls geprüft.

### Stand der praktischen Browserprüfung

Am 25.10.2026 hat der Projektverantwortliche den zuvor beschriebenen lokalen
VIEWER-Test im Browser als erfolgreich bestätigt: Suche und Detailansicht sind
zugänglich, Personenangaben und Status lassen sich nicht ändern, Quittungen und
definitive Erfassung sind nicht möglich und das Kassenbuch ist einsehbar.
Dies ist eine Rückmeldung des Projektverantwortlichen, keine vom Entwicklungsagenten
selbst ausgeführte Browserprüfung.

Die gesonderte Prüfung direkter Erfassungs-/Bearbeitungsadressen sowie die
vollständigen EDITOR- und ADMIN-Abläufe sind noch nicht als praktisch geprüft
bestätigt. Die folgende Liste bleibt als ergänzende Prüfanleitung erhalten.

Mit getrennten Testkonten und ausschließlich Testdaten prüfen:

1. Als VIEWER anmelden. Suche, Details, Ermittlungsschritte und Kassenbuch müssen
   lesbar sein. Änderungen, Quittungen und definitive Erfassung dürfen nicht
   möglich sein. Auch der direkte Aufruf von `/neu` und einer Bearbeitungsadresse
   muss verweigert werden.
2. Als EDITOR anmelden. Test-Fundsache erfassen, ändern und einen Ermittlungsschritt
   ergänzen. Mit Testbeträgen Quittungs- und Kassenbuchabläufe prüfen. Die
   Benutzerverwaltung muss verweigert werden.
3. Als ADMIN anmelden und Benutzerverwaltung sowie dieselben Fundsachenabläufe
   prüfen.

Die lokale Anmeldung und das bestehende einfache Passwortformat sind weiterhin
keine produktionsgeeignete Server-Authentifizierung. Die Rechteprüfung schützt
die vorgesehenen Anwendungsabläufe; der lokale Browserspeicher ist dadurch nicht
gegen direkte Manipulation geschützt.

## Lokale Sicherung und Wiederherstellung

Diese Funktion benötigt keinen zusätzlichen Server. Sie steht angemeldeten
ADMIN-Benutzern unter **Einstellungen → Übersicht** zur Verfügung.

### Sicherung herunterladen

1. **Sicherungsdatei herunterladen** wählen.
2. Im Downloadordner prüfen, dass eine Datei `LostTrack-Sicherung-….json`
   gespeichert wurde. Der Browser kann je nach Einstellung auch nach dem
   Speicherort fragen.
3. Die Datei sicher aufbewahren, möglichst mit einer zusätzlichen Kopie auf einem
   anderen Datenträger. Regelmäßig und vor einer Wiederherstellung erneut sichern.

Die Sicherung enthält die derzeit unterstützten Geschäftsdaten: definitive
Fundsachen, Entwürfe, Benutzer samt Passwortprüfwerten, Quittungsdaten innerhalb
der Fundsachen, Ermittlungsschritte, Kassenbuch, Änderungsprotokolle und beide
Nummernzähler. Noch vorhandene alte Benutzer- und Entwurfsbestände werden
ebenfalls mitgesichert. Gedruckte Quittungen oder separat gespeicherte PDF-Dateien
werden dadurch nicht mitgesichert. Anmeldesitzungen, fremde Browserdaten und
Entwicklungszeit-Erfassung gehören nicht zur Sicherung.

**Die Datei ist unverschlüsselt und enthält Personendaten sowie Passwortprüfwerte.**
Nur sicher aufbewahren und an berechtigte Personen weitergeben. Die Datei nicht
in Git oder GitHub aufnehmen. Git sichert den Programmcode, nicht die Browserdaten.
Der Download ist manuell; es gibt noch keine automatische regelmäßige Sicherung.

### Sicherung wiederherstellen

1. Den aktuellen Stand herunterladen und prüfen, dass die Datei gespeichert ist.
2. Andere LostTrack-Tabs und -Fenster schließen und während der Wiederherstellung
   nicht parallel in LostTrack arbeiten.
3. Unter **Sicherung wiederherstellen** die gewünschte JSON-Datei auswählen.
4. Sicherungsdatum und Anzahl der Einträge in der Vorschau prüfen.
5. Die Bestätigung aktivieren und **Daten jetzt ersetzen** wählen.
6. Mit einem Konto und Passwort aus dem wiederhergestellten Stand neu anmelden.

**Der Geschäftsdaten- und Benutzerbestand dieses Browsers wird ersetzt, nicht
zusammengeführt.** Neuere Daten gehen dabei verloren. Die Zugangsdaten aus der
Sicherung müssen bekannt sein. Es werden nur Sicherungen im unterstützten
LostTrack-Format bis 25 MB angenommen. Struktur, Pflichtbereiche, Benutzer,
Nummernzähler und die Kassenbuch-Prüfkette werden vor dem Ersetzen geprüft. Das
bestätigt keine vertrauenswürdige Herkunft oder vollständige fachliche Richtigkeit.

Bei einem abfangbaren Speicherfehler versucht die Anwendung, den vorherigen
Datenstand samt Sitzung wieder einzusetzen. Scheitert auch das, zeigt sie eine
ausdrückliche Fehlermeldung. Dann nicht weiterarbeiten und die vorhandenen
Sicherungsdateien aufbewahren. Der Browserspeicher bietet für mehrere Datenbereiche
keine gemeinsame Transaktion; ein Browser- oder Rechnerabsturz während der
Wiederherstellung kann nicht durch dieses Zurücksetzen abgesichert werden.

### Stand der Prüfung

Automatisch geprüft wurden Export und Wiederherstellung mit Testdaten,
unveränderte Quittungs-/Protokolldaten, weiterlaufende Nummernzähler, Abmeldung,
Zugriffsrechte, ungültige Dateien und simulierte Speicherfehler.
Echte Geschäftsdaten wurden dabei nicht gelesen oder verändert.

Am 25.10.2026 hat der Projektverantwortliche den lokalen Download einer
Sicherungsdatei im Browser als erfolgreich bestätigt. Dies ist seine Rückmeldung,
keine vom Entwicklungsagenten selbst ausgeführte Browserprüfung. Die heruntergeladene
Datei wird nicht in Git aufgenommen.

Am 25.10.2026 hat der Projektverantwortliche auch die Wiederherstellung im
Browser als erfolgreich bestätigt. Diese Rückmeldung wurde nicht vom
Entwicklungsagenten selbst überprüft; konkrete Einzelprüfungen und das verwendete
Browserprofil wurden nicht gesondert angegeben.

## Übersicht und Änderungsprotokoll

In der **Übersicht** einen Entwurf anklicken, um ihn als ADMIN oder EDITOR
weiterzubearbeiten. Erfasste Fundsachen lassen sich ebenfalls direkt anklicken;
die Detailseite enthält den Ablauf und den Link **Grunddaten bearbeiten**.
VIEWER können erfasste Fundsachen ansehen und keine Entwürfe bearbeiten.

Die fünf Hinweisfelder mit Zählern filtern die Liste der erfassten Fundsachen.
Der aktive Hinweis und die Trefferzahl werden angezeigt. Mit **Alle Fundsachen
anzeigen** wird der Filter aufgehoben. Die Übersicht zeigt alle Treffer, auch
mehr als zwölf. Die Entwurfsliste wird von diesem Filter nicht verändert.
Die Hinweise sind keine automatische fachliche oder rechtliche Freigabe.

Das **Änderungsprotokoll (Audit)** liegt ausschliesslich unter
**Einstellungen → Änderungsprotokoll** und ist nur für ADMIN zugänglich.
Es lässt sich nach Fundnummer, Benutzer oder Suchwort durchsuchen.
Dashboard, Detailansicht und Fundsachenbericht zeigen keine Audit-Ereignisse.
Die Protokollierung läuft bei Änderungen durch EDITOR weiterhin im Hintergrund.

Die Browserprüfung `node scripts/check-dashboard-ui.mjs` benötigt einen eigens
gestarteten leeren Testbrowser auf Port 9237 und den Entwicklungsserver auf
Port 5199. Sie verwendet künstliche Testdaten und darf niemals gegen ein normales
Benutzerprofil ausgeführt werden. Geprüft werden alle fünf Filter samt Zählern,
15 erreichbare Fundsachen, drei Entwürfe, Bearbeitungslinks und die Audit-Rechte.
Domain- und Rollentests laufen mit `npm.cmd test`.

## Gegenstandssuche und Stammdaten

In der Erfassung sind Suche und Auswahl in einem Feld kombiniert. Beispielsweise
`Handy` oder `Natel` eingeben und den Vorschlag `Mobiltelefon` anklicken, oder mit
Pfeiltasten und Enter auswählen. Die Auswahl übernimmt Bezeichnung und Gebührenvorschlag.

Als ADMIN unter **Einstellungen → Stammdaten** Gruppen, Gegenstände, Suchwörter
und Gebührenvorschläge ergänzen oder ändern. Gegenstände lassen sich deaktivieren.
Bestehende Fundsachen und Quittungen behalten ihre bisherigen Angaben. Diese
lokalen Stammdaten und ihr Änderungsverlauf sind Teil der herunterladbaren
Datensicherung; GitHub sichert den Browserspeicher nicht.

Die Bedienung und Prüfungen sind in [docs/GEGENSTANDSKATALOG.md](docs/GEGENSTANDSKATALOG.md) beschrieben.

## Ursprüngliche Vorlagenhinweise

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
