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

Der Build erzeugt Dateien in `dist`. Ein erfolgreicher Build ersetzt keine
Funktionstests. Die allgemeine ESLint-Prüfung enthält weiterhin bekannte Fehler
in anderen Anwendungsbereichen. Eine vollständige Browserprüfung steht noch aus.

## Benutzerrollen

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

## Ursprüngliche Vorlagenhinweise

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
