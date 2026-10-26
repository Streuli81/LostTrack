# Fundregime, Auslagen und verwahrte Fundwerte

Stand: 26.10.2026. Umsetzung der zuletzt eingefügten fachlichen Angaben. Dies ist keine pauschale Rechtsfreigabe der Gesprächsnotizen.

## Bestätigte Richtungsentscheidungen

Der Projektverantwortliche hat ausdrücklich bestätigt:

- Die frühere Kopplung **Aufbewahrungsbeginn = Bekanntmachung** wird für neue Fälle aufgehoben. Die Ereignisse werden getrennt erfasst.
- Tiere, amtliche Dokumente und gefährliche Gegenstände werden vorerst nur als Sonderfälle mit Zuständigkeitsprüfung aufgenommen. Es werden dafür keine automatischen Fristen, normale Verwertung oder reguläre Herausgabe eingerichtet.
- Die bereits bestätigte Finderlohnsperre bei Haus-/Anstaltsfunden bleibt bestehen. Die widersprüchliche Einzelzeile „Finderlohnanspruch: Migros“ im eingefügten Text wird nicht als neue Freigabe behandelt; der Text präzisiert später selbst den fehlenden Finderlohn.

## Fundregime und Fundumgebung

Die Erfassung beginnt mit **Fundart / Fundregime**:

| Auswahl | Umgesetzte Behandlung |
| --- | --- |
| Gewöhnlicher Fund | Getrennte kommunale Prüfgrenzen, manuelle Finderlohnwahl und Zahlungsplanung |
| Haus-/Anstaltsfund | Getrennte Fundperson/Überbringer/Finderstelle, kein Finderlohn, geprüfter Auslagenempfänger |
| Öffentlicher Verkehr | Zuständigkeit des tatsächlichen Unternehmens erfassen, kein Finderlohn, keine kommunalen Standard-Prüfgrenzen |
| Tierfund | Nur Sonderprüfung/Erfassung, keine normale Herausgabe, Auszahlung oder Verwertung |
| Amtliches Dokument | Nur Sonderprüfung/Erfassung, keine normale Herausgabe oder Verwertung |
| Gefährlicher/Sondergegenstand | Nur Sonderprüfung/Erfassung; zuständige Stelle klären |
| Sonstiger Fund | Einordnung offen; kein normaler Abwicklungsautomatismus |

**Fundumgebung** bleibt eine getrennte Orts-/Kontextangabe. Privatgrund ist nicht automatisch ein Haus-/Anstaltsfund. Ein gewöhnlicher Fund kann nach bewusster Einordnung auch auf Privatgrund erfasst werden. Die Ortsauswahl kann bei noch nicht manuell festgelegtem Fundregime einen Vorschlag setzen; sie entscheidet keine streitige Rechtsfrage. Bei Auswahl von Reisepass oder Identitätskarte im Katalog wird in neuen Erfassungen vorsichtig auf Dokumenten-Sonderprüfung umgestellt, ohne eine konkrete Staatsangehörigkeit oder behördliche Massnahme zu unterstellen.

Die drei Personenrollen sind sichtbar getrennt:

- Entdecker / tatsächliche Fundperson (aus Kompatibilitätsgründen weiterhin unter `finder`).
- Überbringer (Person oder Organisation).
- Rechtlicher Finder / Finderstelle.

Bei gewöhnlichen Funden lässt sich ausdrücklich angeben, ob Fundperson, Überbringer und rechtlicher Finder dieselbe Person sind. Bei ÖV-Funden werden Überbringer und Finderstelle manuell erfasst. Beim Haus-/Anstaltsfund bleiben die institutionellen Rollenfelder mit Prüfvermerk erhalten. Niemand erlangt durch blosses Überbringen automatisch Finder- oder Eigentumsrechte.

## Getrennte Zeitpunkte und Prüfgrenzen

Neue Einträge speichern:

- Erfassungszeitpunkt automatisch.
- Funddatum und Fundzeit.
- Datum/Zeit der Polizeianzeige.
- Datum/Zeit der Bekanntmachung.
- Datum/Zeit des Eingangs beim Fundbüro.
- Tatsächlichen Aufbewahrungsbeginn als eigenes Datum mit Uhrzeit.

Die Grundlage der **Finderfrist** wird ausdrücklich gewählt: Polizeianzeige oder Bekanntmachung. Ohne festgelegte Grundlage wird bei neuen Fällen keine Finder-Prüfgrenze erfunden. Die Aufbewahrungs-Prüfgrenze hängt am eigenen Aufbewahrungsbeginn. Beide Ereignisse dürfen auseinanderliegen.

Geprüftes technisches Beispiel für ein gewöhnliches Fundregime:

| Ereignis | Datum |
| --- | --- |
| Fund / Anzeige | 01.05.2026 |
| Bekanntmachung | 02.05.2026 |
| Eingang und Beginn tatsächlicher Aufbewahrung | 01.08.2026 |
| Einjahres-Prüfgrenze | 01.08.2027 |
| Fünfjahres-Prüfgrenze bei gewählter Anzeige | 01.05.2031 |

Die vorhandene Berechnung arbeitet mit Kalendermonaten und Monatsenden. Diese Daten sind **Prüfgrenzen**, keine automatische Verwertungs- oder Eigentumsfreigabe. Die Gesprächsnotiz „frühestens am Folgetag verwerten“ wird nicht als vollständige behördliche Genehmigung umgesetzt. Auch die Uhrzeitfelder machen die Berechnung nicht zu einer sekundengenauen juristischen Fristenprüfung.

Alte Datensätze werden nicht rückwirkend umdatiert. **Getrennte Zeitpunkte aktivieren, bisherige Angaben zuordnen** stellt einen Eintrag ausdrücklich um. Als Polizeianzeige gekennzeichnete alte Daten werden in die neuen Anzeigefelder übertragen; Aufbewahrungsdaten bleiben bestehen. Fehlende/mehrdeutige Grundlagen müssen manuell geklärt werden.

## Auslagen anmelden, prüfen und abrechnen

In der Detailansicht gibt es eine eigene Karte **Auslagen anmelden, prüfen und Belege zuordnen**. Eine Anmeldung enthält Person/Stelle, Rolle, beanspruchten Betrag, Begründung, Belegangabe, Anspruchsgrundlage und Prüfentscheidung.

Die Zustände sind bewusst getrennt:

1. **Angemeldet – Prüfung offen**: keine Forderungsanerkennung und keine Buchung.
2. **Anerkannt – Rückgabe noch offen**: Betrag und Entscheidung wurden dokumentiert. Bei Finderrecht wird eine bestätigte Eigentümerrückgabe abgewartet.
3. **Fällig nach dokumentierter Anerkennung und Eigentümerrückgabe**: keine automatische Auszahlung; der Zahlungsablauf bleibt separat.
4. **Bezahlt – bestätigter Beleg zugeordnet**: nur mit tatsächlichem bestätigtem Auslagen-Auszahlungsbeleg für diese Person/Stelle und ausreichendem Betrag. Ein Beleg darf nicht über seinen Auszahlungsbetrag hinaus zugeordnet werden.

Ablehnungen benötigen ebenfalls einen Entscheidungsvermerk. Bei einer anderen zivilrechtlichen Anspruchsgrundlage erscheint **Geprüft – gesonderte Anspruchsgrundlage/Abwicklung** statt einer automatischen Fälligkeit nach Finderrecht.

Bei Haus-/Anstalts- und ÖV-Funden dürfen private Kosten der Fundperson nicht einfach als Anspruch aus Finderrecht anerkannt werden. Eine andere Grundlage kann dokumentiert werden; die Anwendung entscheidet deren rechtliche Tragfähigkeit nicht. Eine Anerkennung als rechtlicher Finder erfordert die passende erfasste Finderstelle und bei Haus-/Anstaltsfunden deren Rollenprüfung.

Eine Anmeldung ändert den Zahlungsplan nicht automatisch. Für tatsächlich abzurechnende Auslagen werden im Plan Anspruchsteller, Rolle, Grundlage und dokumentierte Freigabe festgelegt. Bei neuen Fundregime-Fällen lässt die Auszahlung aus Finderrecht erst eine bestätigte Eigentümerrückgabe zu und prüft den tatsächlichen Auszahlungsempfänger. Ein anderer zivilrechtlicher Weg setzt eine gesondert dokumentierte Entscheidung voraus. Keine beliebige Ausgabe wird allein wegen ihrer Eingabe als notwendig anerkannt.

Für neue Fälle ist auch Finderlohn kein zeitgesteuerter Vorgang: keine Auszahlung bei Annahme oder nach einem/fünf Jahren. Es gibt **keine pauschale 10-%-Berechnung**. Eine tatsächliche Auszahlung knüpft an die dokumentierte Eigentümerrückgabe an. Ein abweichender Zahlungsempfänger verlangt einen dokumentierten Vertretungs-/Berechtigungsgrund. Alte Buchungen und Altfälle werden nicht rückwirkend verändert; ihre rechtliche Einordnung bleibt bei Weiterbearbeitung gesondert zu prüfen.

## Fundbargeld und Verwertungserlöse

Unter **Inhalt / Fundbestandteile** werden beispielsweise Bargeld, Karten und Ausweise einzeln erfasst. Bargeld erhält einen CHF-Betrag und eine ausdrückliche Zählbestätigung. Ohne Prüfung bleibt es als ungeprüfte Angabe kenntlich. Ungültige Beträge dürfen nicht definitiv gespeichert werden.

Beispiel **Portemonnaie mit CHF 250**:

- Die CHF 250 stehen als eigener Fundbestandteil im Datensatz und im Quittungssnapshot.
- Die Fundquittung dokumentiert den Inhalt als Textliste, ohne Gebühren-/Finderlohn-/Auslagentabelle.
- Die Erfassung erzeugt weder Gemeindegebühren noch Finderlohn noch eine Kassenbucheinnahme aus dem Fundbargeld.
- Rückgabe des Hauptgegenstands an den Eigentümer und Gebühren-/Auslagenzahlungen bleiben getrennte Vorgänge.
- Ohne bestätigte Rückgabe der Hauptposition bleibt Fundbargeld bei einem Verwertungs-/Abschlussversuch als offener Fundwert erkennbar. Neue Teilfälle benötigen dafür eine klare Zuordnung; es wird keine freie Geldverteilung unterstellt.

Eine freigegebene Verwertung kann mit dem tatsächlichen Erlös dokumentiert werden. Dieser wird **nicht automatisch als Gebühreneinnahme oder Finderlohnauszahlung gebucht**. In neuen Fundregime-Fällen beendet eine Verwertung den Gesamtvorgang nicht automatisch. Erlös, gegebenenfalls verbleibendes Fundbargeld und weitere Finderrechte bleiben offen.

Die vollständige kassentechnische Verwahrung, Aufteilung, Berechtigtenauszahlung und abschliessende Behandlung von Fundbargeld/Verwertungserlösen ist **noch kein freigegebener Spezialablauf**. Dafür sind verbindliche Vorgaben erforderlich. Es wurde keine Auszahlung oder Vereinnahmung nach einem oder fünf Jahren erfunden. Gegenstände und Fundwerte werden nicht automatisch gelöscht.

## Sonderfälle und bewusst offene Rechtsfragen

Tierfunde, amtliche Dokumente und gefährliche Gegenstände werden nur erfasst und zur Zuständigkeitsprüfung gekennzeichnet. Die regulären Speicherfunktionen für Herausgabe, Zahlung und Verwertung weisen diese Fälle ab; eine Fundannahmequittung bleibt möglich. Sonderfristen von zwei Monaten bei Tieren oder einem/drei Monaten im ÖV werden **nicht** als Horgner Verwertungsautomatik programmiert.

Die ÖV-Kennzeichnung organisiert keine automatische Beförderung. Es gilt weiterhin die Vorgabe persönlicher Übergabe; das konkrete Unternehmen und der Weiterleitungsnachweis müssen geklärt werden.

Ein tatsächlicher Finder-/Eigentumsanspruch ist ein eigener Prüfungsschritt. Bei neuen gewöhnlichen Fällen verlangt das Finderschreiben eine dokumentierte Freigabe der zuständigen Stelle. Ein Fristdatum allein reicht nicht. Dies gilt nicht als Ersatz für die Prüfung von Finderpflichten, berechtigter Person, früherer Verwertung und noch vorhandenem Wert.

Offen bleiben die verbindliche rechtliche Fristenmatrix für Horgen einschliesslich exakter Fristabläufe, übernommener Anstaltsfunde, Tierfälle, Dokumente, gefährlicher Sachen, konkreter Weiterleitung und abschliessender Geldverwahrung. Die Software bildet belegte Ereignisse und manuelle Entscheidungen ab und trifft diese Rechtsentscheidungen nicht selbst.

## Quellenprüfung

Am 26.10.2026 wurden der [Bundesratsbericht von April 2015](https://www.newsd.admin.ch/newsd/message/attachments/39169.pdf) und die [Behördeninformationen der Luzerner Polizei zu ZGB/VPB](https://polizei.lu.ch/organisation/verwaltungspolizei/fundbuero/Gesetzliche_Grundlage) erneut geprüft. Sie stützen die Unterscheidung der Finderrolle und die Trennung von Finderlohn/Auslagen, ersetzen aber keine aktuelle Einzelfallfreigabe für Horgen. Der eingefügte Gesprächstext ist keine eigenständige verbindliche Rechtsquelle.

## Technische Prüfungen

`npm.cmd test` prüft zusätzlich getrennte Fristbeginne, Umstellung alter Daten, getrennte Rollen, Sonderfallsperren, ÖV-Finderlohnsperre, Auslagenanmeldung/Anerkennung/Fälligkeit/Zahlungsbeleg, Ablehnung erfundener Belege, Fundbargeld ohne Gebührenbuchung, Erlösdokumentation, offene Rechtsabwicklung, Sicherung/Wiederherstellung und fehlende zeitgesteuerte Zahlungen.

`node scripts/check-regimes-ui.mjs` prüft in einem leeren Testprofil getrennte Fristbeginne, das Portemonnaie mit CHF 250, CHF 6 angemeldete/erkannte Auslagen, Eigentümerrückgabe, bestätigte Ein-/Auszahlung, Belegzuordnung und anschliessenden Abschluss. Ausserdem werden die einseitige Fundquittung ohne Zahlungstabelle und die Sonderfall-Erfassung geprüft. Nur mit separat gestartetem Testbrowser auf Port 9237 und Entwicklungsserver auf Port 5199 ausführen. Der Druckaufruf ist simuliert; kein Papierausdruck wird daraus abgeleitet.
