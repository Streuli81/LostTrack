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
Es sind keine zusätzlichen Testpakete erforderlich.

Der Build erzeugt Dateien in `dist`. Ein erfolgreicher Build ersetzt keine
Funktionstests. Die allgemeine ESLint-Prüfung enthält weiterhin bekannte Fehler
in anderen Anwendungsbereichen. Eine vollständige Browserprüfung steht noch aus.

Die lokale Anmeldung und das bestehende einfache Passwortformat sind weiterhin
keine produktionsgeeignete Server-Authentifizierung. Die vollständige Durchsetzung
der Rollenrechte in den Fundsachenabläufen ist ein gesonderter nächster Schritt.

## Ursprüngliche Vorlagenhinweise

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
