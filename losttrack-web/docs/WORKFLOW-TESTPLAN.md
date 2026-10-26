# Neuen Ablauf im Browser prüfen

Diese Anleitung beschreibt noch auszuführende praktische Prüfungen. Sie ist kein
Nachweis, dass die Browserprüfungen bereits erfolgreich waren. Nur erfundene
Personen, Gegenstände und Geldbeträge verwenden; keine echten Übergaben oder
Zahlungen für einen Test auslösen.

## Vorbereitung

1. Den bisherigen Datenbestand als ADMIN über **Einstellungen → Übersicht**
   herunterladen und prüfen, ob die Sicherungsdatei gespeichert wurde.
2. Für die folgenden Prüfungen möglichst ein separates Browserprofil verwenden.
   Dort LostTrack über dieselbe lokale Adresse öffnen. Andere LostTrack-Tabs
   während der Tests geschlossen halten.
3. Mit einem ADMIN- oder EDITOR-Testkonto anmelden. Für die Rollenprüfung wird
   außerdem ein VIEWER-Testkonto benötigt. Die Zugangsdaten aus einer eingelesenen
   Sicherung gelten nach deren Wiederherstellung.
4. Vor jedem Versuch den Verbleib, die Gegenstandsmengen, die Zahlungsstände und
   die Anzahl der Belege/Buchungen für genau diese Fundsache notieren. Bei bereits
   vorhandenen Testfällen sind die Summen des gesamten Kassenbuchs nicht gleich
   den Beträgen eines einzelnen Vorgangs.

## 1. Gebührenauswahl bei der Erfassung

Mit **Neue Fundsache** drei voneinander getrennte Testfälle anlegen und die
erforderlichen Finder- und Fundangaben ausfüllen:

| Gegenstand / Gebührenauswahl | Erwarteter Gebührenbetrag |
| --- | ---: |
| Einzelner Schlüssel | CHF 10.00 |
| Ganzer Schlüsselbund, beispielsweise mit fünf Schlüsseln | CHF 10.00 für den ganzen Bund |
| Tatsächlich vermitteltes Mobiltelefon | CHF 20.00 pro Telefon |

Zusätzlich einen gewöhnlichen Gegenstand mit der Auswahl **Übrige Fundsache –
gebührenfrei** erfassen. Er darf keine Gemeindegebühr erhalten. Der bloße Fund
eines Mobiltelefons bestätigt noch keine erfolgte Vermittlung; die Auswahl
**Mobiltelefon vermittelt** nur für diesen bewusst angegebenen Testfall verwenden.

Nach der definitiven Erfassung die Detailansicht öffnen und unter **Ablauf und
Zahlungen** die Gebührenposition prüfen. Die Auswahl darf noch keine Einnahme
erzeugt haben.

## 2. Finderlohnverzicht und unbekannte Auslagen

Beim Schlüsseltest ausdrücklich **Verzicht auf Finderlohn** wählen. Danach in
der Detailansicht **Gegenstände, Gebühren und offene Aufgaben festlegen** öffnen.

1. Prüfen, dass der Finderlohnbetrag bei CHF 0.00 liegt.
2. Das Feld für Auslagen zunächst leer lassen und **Plan speichern** wählen.
   Auslagen müssen weiterhin als ungeklärt erscheinen. Finderlohnverzicht darf
   das Feld nicht automatisch auf erledigte CHF 0.00 setzen.
3. Wenn bei diesem Test keine Auslagen anfallen, dort ausdrücklich `0.00`
   eintragen und den Plan erneut speichern.
4. Die Gebührenforderung muss unverändert CHF 10.00 betragen. Noch wurde kein
   Geld eingenommen, und die Sache bleibt aufbewahrt.

## 3. Druckabbruch darf nichts übergeben oder buchen

Mit dem gerade vorbereiteten Schlüsseltest:

1. Den gespeicherten Plan verwenden. Unter **Schreiben vorbereiten und drucken**
   das Schreiben **Herausgabe an Eigentümer** wählen.
2. Einen erfundenen Empfänger eintragen und den Schlüssel zur Übergabe anhaken.
   Bei **Gebühren – Einnahme heute** `10.00` eintragen.
3. **Quittung vorbereiten und drucken** wählen. Im Druckdialog abbrechen.
4. Anschließend **Abgebrochen / nicht erfolgt** wählen.
5. Prüfen: Gegenstand weiterhin aufbewahrt, abgegebene Menge unverändert,
   Gebühreneinnahme unverändert, kein neuer bestätigter Beleg und keine neue
   Kassenbuchung für diesen Vorgang.

Den Versuch wiederholen und nach dem Druckdialog die Seite verlassen oder neu
laden, ohne die Rückfrage zu bestätigen. Auch dann dürfen Herausgabe und Zahlung
nicht gespeichert sein. Der Browserdruckdialog selbst ist keine Bestätigung.

## 4. Erfolgreichen Druck und Übergabe ausdrücklich bestätigen

Den Schlüsseltest erneut wie oben vorbereiten und die Testquittung beispielsweise
als PDF drucken. Im Anschluss nur für den simulierten Testvorgang **Ja, gedruckt
und Vorgang tatsächlich erfolgt** wählen.

Erwartet:

- Genau eine Herausgabe und ein bestätigter Beleg.
- Gegenstand als vollständig herausgegeben, keine Menge mehr beim Fundbüro.
- Genau CHF 10.00 Gebühreneinnahme; keine Finderlohn- oder Auslagenbuchung.
- Das Kassenbuch zeigt eine intakte Prüfkette.
- Bei Gebühren, Finderlohn und Auslagenersatz bestehen keine offenen Beträge.
- Der Gesamtvorgang bietet den Abschluss an, ist bis zur ausdrücklichen
  Abschlussaktion aber noch nicht als abgeschlossen markiert.

## 5. Teilherausgabe und getrennte Zahlungen

Einen neuen Testfall anlegen, diesmal mit **Finderlohn gewünscht**. In der
Detailansicht den Plan auf zwei Gegenstandspositionen aufteilen:

| Position | Gebührenauswahl |
| --- | --- |
| TEST Schlüsselbund | Schlüssel – CHF 10.00 |
| TEST Regenschirm | Übrige Fundsache – gebührenfrei |

Die Positionen einzeln erfassen. Es gibt kein Mengenfeld; bei der Herausgabe
wird durch Anhaken ausgewählt, welche Positionen übergeben werden.

Als frei gewählte, rein fiktive Testbeträge Finderlohn `30.00` und Auslagenersatz
`5.00` festlegen. Für diesen Versuch als Auslagenempfänger **Finder / andere
berechtigte Person** auswählen. Diese Testbeträge sind keine rechtlich geprüfte
Berechnung von Finderlohn oder Auslagenersatz. **Plan speichern** wählen.

1. Nur den Schlüsselbund an den Test-Eigentümer herausgeben. In diesem Vorgang
   Gebühreneingang CHF 10.00, Finderlohneingang CHF 30.00 und Auslageneingang
   CHF 5.00 angeben. Drucken und den tatsächlichen Testvorgang bestätigen.
2. Erwartet: Schlüsselbund abgegeben, Regenschirm noch vorhanden; Verbleib nur
   teilweise erledigt. Einnahmen getrennt nach den drei Zahlungsarten. Die
   Finderlohn- und Auslagenauszahlungen stehen noch offen.
3. Anschließend nur den Regenschirm mit einer weiteren Herausgabequittung
   übergeben. Keine bereits erhaltenen Beträge nochmals eingeben.
4. Erwartet: Beide Gegenstände sind abgegeben, der Gesamtvorgang bleibt aber
   wegen der noch offenen Auszahlungen in **Restabwicklung offen**. Abschluss
   darf nicht möglich sein.

### Teilzahlung und tatsächlicher Zahlungsempfänger

5. **Herausgabe an Finder** wählen und **Nur Zahlung zu diesem Schreiben, keine
   weitere Gegenstandsübergabe** anhaken. Als Empfänger den tatsächlich gemeinten
   Test-Finder angeben, nicht den Eigentümer.
6. Zunächst Finderlohnauszahlung CHF 10.00 bestätigen. Es darf kein Gegenstand
   erneut übergeben werden. Vom Finderlohn müssen noch CHF 20.00 offen bleiben.
7. In einem weiteren Zahlungsvorgang Finderlohnauszahlung CHF 20.00 und
   Auslagenauszahlung CHF 5.00 an denselben Test-Finder bestätigen.
8. Erwartet: Gebühreneingang CHF 10.00, Finderlohneingang/-ausgang je CHF 30.00,
   Auslageneingang/-ausgang je CHF 5.00. Alle Positionen bleiben getrennt, alle
   Restbeträge sind null, und die Prüfkette ist intakt.
9. Eine weitere Finderlohnauszahlung versuchen. Sie muss abgewiesen werden,
   ohne neue Buchung oder neuen bestätigten Beleg.

Für unterschiedliche zahlende oder empfangende Personen getrennte Quittungen
verwenden. In einem Eigentümer-Herausgabevorgang keine Auszahlung an den Finder
erfassen.

## 6. Nachdruck, Abschluss und Wiederöffnung

1. Einen bestätigten Beleg aufklappen und **Nachdrucken** wählen. Danach die
   Anzahl der Herausgaben, Einnahmen und Ausgaben vergleichen: keine Änderung.
   Der Nachdruck muss denselben gespeicherten Quittungsinhalt verwenden.
2. Beim vollständig erledigten Testfall **Vorgang vollständig abschließen**
   wählen. Der Gesamtvorgang muss nun als abgeschlossen erscheinen.
3. Prüfen, dass neue Herausgaben und Zahlungen sowie Änderungen am Plan für
   diesen abgeschlossenen Vorgang nicht mehr angeboten werden. Nachdruck darf
   weiterhin möglich sein.
4. Eine Wiederöffnung ohne Begründung versuchen: Sie darf nicht ausgeführt
   werden. Danach mit einer erfundenen Testbegründung wieder öffnen.
5. Der Verlauf muss die Wiederöffnung samt Begründung enthalten. Sie darf keine
   zuvor bestätigte Übergabe oder Zahlung rückgängig machen oder verdoppeln.

## 7. VIEWER und ältere Daten

Mit dem VIEWER-Testkonto anmelden. Verbleib, Gegenstandsmengen und Zahlungsstände
müssen sichtbar sein. Planänderung, Druck neuer Quittungen, Herausgabe,
Zahlungsbuchung, Abschluss und Wiederöffnung dürfen nicht möglich sein.

In einem separaten Testprofil eine ältere Sicherung mit ausschließlich erfundenen
Daten einlesen. Bei alten Datensätzen:

- Vorhandene Ein- und Auszahlungen müssen erhalten bleiben; insbesondere muss
  eine alte Finderlohnauszahlung als solche erkennbar sein.
- Unbekannte Gebühren oder Auslagen dürfen nicht automatisch als erledigte
  CHF 0.00 gelten. Fehlende Angaben bewusst im Plan ergänzen.
- Ein alter Status „zurückgegeben“, „übertragen“ oder „verwertet“ beweist keinen
  vollständigen Zahlungsabschluss. Der Gesamtvorgang darf nicht allein deshalb
  abgeschlossen erscheinen.
- Alte Belege besitzen unter Umständen noch keine gespeicherte Druckfassung
  und keine gesonderte Druck-/Übergabebestätigung. Sie dürfen nicht als neu
  bestätigte Herausgaben umgedeutet werden.

Nach diesen Tests eine neue Sicherung erstellen, in einem weiteren leeren
Testprofil wiederherstellen und Gegenstandsmengen, Gebührenpositionen,
Zahlungsstände, bestätigte Belege und Abschlusszustand vergleichen.

## Rechtliche Grenzen und Prüfergebnis

Diese Anleitung gibt keine Verwertung, Herausgabe an Finder, Sperraufhebung oder
Abweichung von kommunalen Regeln rechtlich frei. Verwertung nur mit einer bereits
vorliegenden fachlichen Freigabe dokumentieren; ein erreichtes Fristdatum allein
ist keine solche Freigabe. Die Regeln für rechtliche Sonderfälle bleiben gesondert
zu klären.

Für jeden durchgeführten Abschnitt notieren: Testdatum, Rolle, Fundnummer,
erwartetes und tatsächliches Ergebnis. Fehler möglichst mit dem letzten
Arbeitsschritt und der sichtbaren Fehlermeldung melden. Erst diese tatsächliche
Rückmeldung bestätigt eine praktische Prüfung.
