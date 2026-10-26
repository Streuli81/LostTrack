# Fachliche Vorgaben für den neuen LostTrack-Ablauf

Stand: 25.10.2026. Diese Datei beschreibt die bestätigten Anforderungen und den
inzwischen implementierten technischen Ablauf. Die Tests sind am Ende getrennt
von offenen fachlichen Fragen aufgeführt. Die Umsetzung ersetzt keine
verbindlichen rechtlichen Vorgaben.

## Vom Projektverantwortlichen bestätigt

- Einsatz für die Gemeinde Horgen.
- Ausschließlich persönliche Übergabe von Fundsachen.
- Die Herausgabe soll mit dem Druck der Herausgabequittung bestätigt werden.
- Bei einem abgebrochenen Druck soll die Herausgabe offen bleiben. Das bloße
  Öffnen oder Schließen des Druckdialogs bestätigt keine Übergabe.
- Gebühren, Finderlohn und Auslagenersatz sollen separat aufgeführt werden.
- Gebühren sollen für die betreffende Sache über ein Dropdown gemäß der
  Gebührenverordnung der Gemeinde ausgewählt werden.
- Nach Vorgabe des Projektverantwortlichen fallen Gebühren ausschließlich bei
  gefundenen Schlüsseln und bei der Vermittlung von Mobiltelefonen an. Alle
  übrigen Fundsachen sind gebührenfrei. Bestätigte Beträge: CHF 20.00 pro
  vermitteltem Mobiltelefon; CHF 10.00 für einen einzelnen Schlüssel oder einen
  Schlüsselbund als Ganzes, unabhängig von der Schlüsselanzahl am Bund.
- Ein Vorgang darf erst nach kompletter Erledigung abgeschlossen sein.
- Teilherausgaben, Teilzahlungen, Verwertung und Weiterleitung kommen vor.
  Ebenso werden Gebühren und Auslagenersatz benötigt.

Die aktuelle Vorgabe zur persönlichen Übergabe ersetzt die frühere pauschale
Zustimmung zum Versand. Ein Versandablauf gehört damit nicht zum geplanten Umfang.

## Umgesetztes Statusmodell

Fundsachenstatus, Zahlungsstand und Gesamtabschluss getrennt führen. Eine
ausgegebene Fundsache kann wegen einer offenen Finderlohnauszahlung weiterhin
einen unerledigten Vorgang haben.

| Bereich | Vorgeschlagene Anzeige |
| --- | --- |
| Erfassung | Entwurf oder definitiv erfasst |
| Verbleib | Aufbewahrt, teilweise herausgegeben / erledigt, vollständig herausgegeben, an zuständige Stelle übergeben, verwertet oder Verbleib vollständig dokumentiert (gemischte Maßnahmen) |
| Bearbeitung | Ermittlungsschritte dokumentieren und eine noch offene fachliche Entscheidung kennzeichnen |
| Sperre | Keine Sperre oder gesperrt mit Begründung |
| Finderlohnwahl | Noch offen, gewünscht oder ausdrücklich verzichtet |
| Zahlungen | Je Zahlungsart: noch ungeklärt, nicht erforderlich, offen, teilweise erledigt oder vollständig erledigt |
| Gesamtvorgang | In Bearbeitung, Restabwicklung offen oder abgeschlossen |

Bestehende Datensätze werden ohne Schreibzugriff in dieses Modell eingeordnet.
Bereits gespeicherte Zahlungsnachweise bleiben erhalten, insbesondere Auszahlungen
aus dem bisherigen Feld finderReward. Unbekannte Gebühren oder Auslagen werden
nicht als erledigte Nullbeträge behandelt. Die Speicherung des Plans aktiviert
den neuen Ablauf für den Datensatz. Der alte manuelle Status-/Quittungsweg ist
für aktivierte Vorgänge gesperrt.

## Herausgabe und Quittungen

Umgesetzter Ablauf: Empfänger und herauszugebende Gegenstände auswählen,
Zahlungspositionen prüfen, die Herausgabequittung drucken und den erfolgreichen
Druck samt persönlicher Übergabe anschließend ausdrücklich bestätigen.
Bei Teilherausgabe bleiben die nicht übergebenen Gegenstände aufbewahrt.

- Nur eine tatsächliche Herausgabequittung darf Gegenstände als herausgegeben
  kennzeichnen. Fundannahmequittung und reine Zahlungsquittung sind andere Vorgänge.
- Der Nachdruck einer bereits bestätigten Quittung darf keine weitere Herausgabe
  oder Zahlung auslösen. Korrekturen müssen nachvollziehbar bleiben.
- Die Übergabe und die Quittung sollen aufeinander verweisen und mit Zeitpunkt
  und ausführendem Benutzer protokolliert werden.
- Bei mehreren Gegenständen müssen die ausgewählten Gegenstände beziehungsweise
  Mengen einzeln nachvollziehbar sein. Ein bloßer Status für den ganzen Fund
  reicht für Teilherausgaben nicht aus.

Bestätigte Vorgabe: Bei Druckabbruch bleibt die Herausgabe offen. Der Browser
liefert keine zuverlässige Rückmeldung über einen erfolgreichen physischen
Ausdruck. Deshalb ist folgender technischer Ablauf vorgesehen:

1. Die Druckvorbereitung verändert den Herausgabestatus noch nicht.
2. Nach Rückkehr aus dem Druckdialog fragt die Anwendung: „Wurde die Quittung
   erfolgreich gedruckt und die Fundsache persönlich übergeben?“
3. Erst eine ausdrückliche Bestätigung speichert die Herausgabe. „Abgebrochen /
   nicht übergeben“, fehlende Antwort oder Verlassen der Seite lassen sie offen.
4. Ein erneuter Druckversuch bleibt möglich. Nach einer bereits bestätigten
   Herausgabe handelt es sich um einen Nachdruck ohne neue Übergabe oder Buchung.

`afterprint` oder das Schließen des Druckdialogs darf höchstens die Rückfrage
auslösen, aber nicht selbst die Herausgabe bestätigen. Mit diesem Vorgang
verknüpfte neue Buchungen dürfen nicht schon durch die Druckvorbereitung
entstehen. Bereits unabhängig bestätigte Ein- oder Auszahlungen bleiben bei
einem Druckabbruch bestehen; sie werden nicht stillschweigend rückgängig gemacht.
Der Rückfragedialog ist implementiert. Druckaufträge werden ausschließlich
flüchtig vorbereitet, mit einem unveränderlichen Snapshot versehen und erst nach
Bestätigung gespeichert. Änderungen am Datensatz oder am Auftrag zwischen Druck
und Bestätigung erfordern eine neue Druckvorbereitung.

## Gebühren, Finderlohn und Auslagenersatz

Bestätigt ist die separate Darstellung der drei Zahlungsarten. Implementiert
sind getrennte Sollbeträge, tatsächliche Ein-/Auszahlungen
und Restbeträge. Teilzahlungen und Korrekturen müssen einer Zahlungsart und der
betreffenden Sache zugeordnet werden. Ein noch unbekannter Betrag ist nicht
automatisch ein erledigter Betrag von CHF 0.

Für das Gebühren-Dropdown werden die verbindlichen Horgner Tarifpositionen,
Beträge beziehungsweise Berechnungsregeln und deren Gültigkeit benötigt.
Der Projektverantwortliche hat folgenden Anwendungsbereich bestätigt:

| Fall | Gebührenregel laut Projektverantwortlichem |
| --- | --- |
| Einzelner gefundener Schlüssel | CHF 10.00 |
| Gefundener Schlüsselbund | CHF 10.00 für den ganzen Bund; nicht pro enthaltenem Schlüssel |
| Vermittlung eines Mobiltelefons | CHF 20.00 pro vermitteltem Mobiltelefon |
| Übrige Fundsachen | Keine Gemeindegebühr: CHF 0.00 |

Der bloße Fund eines Mobiltelefons darf nicht automatisch als erfolgte Vermittlung
behandelt werden. Die späteren Auswahlmöglichkeiten müssen diesen Unterschied
abbilden. Die Gebührenfreiheit anderer Fundsachen bedeutet nicht automatisch
einen Finderlohnverzicht oder einen Verzicht auf Auslagenersatz; diese Beträge
bleiben separat.

Diese Tabelle dokumentiert die am 25.10.2026 ausdrücklich bestätigte fachliche
Nutzervorgabe, keine unabhängige Bestätigung der Rechtslage. Die genannten
Beträge und die Berechnungseinheit bei Schlüsseln sind damit geklärt. Die genaue
Abgrenzung einer erfolgten Mobiltelefonvermittlung und der Bezug auf die
entsprechende Tarifposition bleiben noch zu klären.

Die Auswahl enthält Tarifbezeichnung, Katalogbezug und anwendbaren Betrag. Die
Tarife sind als bestätigte Nutzervorgabe für Horgen gekennzeichnet, nicht als
unabhängig geprüfte Gesetzesfassung. Der gewählte Tarif und Betrag werden
am Vorgang und an der Quittung festgehalten, damit spätere Tarifänderungen alte
Vorgänge nicht nachträglich verändern.

Bei Auslagen wird bewusst gewählt, ob der Ersatz an den Finder / eine andere
berechtigte Person weiterzuzahlen ist oder bereits vom Fundbüro getragene Kosten
deckt. Für verschiedene zahlende und empfangende Personen sind getrennte
Quittungen erforderlich. Die Eigentümer-Herausgabe erlaubt keine Finder-Auszahlung
an einen fälschlich als Eigentümer bezeichneten Empfänger. Solche Auszahlungen
erfolgen über eine eigene Zahlungsquittung. Überzahlungen und Auszahlungen ohne
vorhandene Einzahlung werden abgewiesen.

Noch zu klären sind insbesondere die Verrechnung bei mehreren Gegenständen,
Gebührenbefreiungen, Ermäßigungen, Rundung, Zuständigkeit für Korrekturen und die
jeweiligen zahlenden beziehungsweise empfangenden Personen. Der ausdrücklich
erklärte Finderlohnverzicht entscheidet nicht automatisch über den Auslagenersatz.

## Gesamtabschluss

Die bestätigte Zielvorgabe lautet: Abschluss erst nach vollständiger Erledigung.
Als konkrete Prüfbedingungen werden vorgeschlagen:

- Der Verbleib aller Gegenstände ist abschließend dokumentiert.
- Alle erforderlichen Gebührenzahlungen sind erledigt.
- Finderlohneinnahmen und erforderliche Auszahlungen sind erledigt.
- Erforderlicher Auslagenersatz ist erledigt.
- Es bestehen keine offenen Teilbeträge, Korrekturen, Sperren oder Entscheidungen.

Beispiel ohne tarifliche Aussage: Alle Gegenstände wurden persönlich übergeben,
aber ein eingezahlter Finderlohn wurde noch nicht ausgezahlt. Dann ist der Verbleib
„vollständig herausgegeben“, der Gesamtvorgang jedoch „Restabwicklung offen“.

Umgesetzt ist eine zusätzliche Aktion „Vorgang vollständig abschließen“, die erst
bei erfüllten Bedingungen verfügbar ist und die Bedingungen beim Speichern erneut
prüft. Nach Abschluss sind Änderungen gesperrt. ADMIN und EDITOR können den
Vorgang mit einer protokollierten Begründung wieder öffnen; Zahlungen oder
Herausgaben werden dabei nicht rückgängig gemacht. Noch offen sind besondere
Ausnahmen, Erlasse, Storno-/Erstattungsabläufe und deren verbindliche Freigaben.
Negative Buchungen oder eine ungeprüfte automatische Erledigung sind dafür
nicht eingerichtet.

## Offizielle Horgner Quellen – Recherche, keine fachliche Freigabe

Am 25.10.2026 wurden auf der offiziellen Website folgende Unterlagen gefunden:

- [Allgemeine Unterlagen / Rechtssammlung](https://www.horgen.ch/ueber-horgen/verwaltung/allgemeine-unterlagen.html/331/opendcategory/234)
- [Gebührenverordnung, als Fassung 01.01.2024 verlinkt](https://www.horgen.ch/public/upload/assets/67184/2024_01_01_Geb%C3%BChrenverordnung_final.pdf?fp=1)
- [Gebührentarif Gemeinde Horgen](https://www.horgen.ch/public/upload/assets/1135/Geb%C3%BChrentarif%20Gemeinde%20Horgen.pdf?fp=7)
- [Dienstleistungsseite Fundbüro](https://www.horgen.ch/ueber-horgen/verwaltung/dienstleistungen-a-z.html/118/service/430)

Die konkrete Fundsachen-Tariftabelle und ihre Anwendung auf die einzelnen Sachen
sind noch zu prüfen und durch den Projektverantwortlichen als verbindliche
Grundlage zu bestätigen. Die Gebührenverordnung ließ sich bei dieser Recherche
nicht als vollständiger Text auslesen; aus dem Gebührentarif wurde noch keine
vollständige Fundsachen-Auswahlliste abgeleitet. Aus dem Datum einer verlinkten
Datei allein folgt keine abschließend geprüfte Rechtslage.

## Automatisch geprüfte Abläufe

- Herausgabe mit und ohne Finderlohn; getrennte Gebühren- und Auslagenpositionen.
- Teilherausgabe mit verbleibenden Gegenständen und Teilzahlungen je Zahlungsart.
- Eine bereits herausgegebene Sache mit noch offener Zahlung bleibt im
  Gesamtvorgang unerledigt.
- Druckabbruch, fehlende Antwort und Verlassen der Seite lassen die Herausgabe
  offen und erzeugen keine neuen Buchungen aus der Druckvorbereitung.
- Erfolgreich bestätigte Übergabe, Nachdruck und wiederholte Bestätigung;
  keine doppelten Übergaben oder Buchungen. Bereits separat bestätigte Zahlungen
  werden durch einen Druckabbruch nicht verändert.
- Historische Gebühren bleiben nach einer Tarifänderung erhalten.
- Einzelner Schlüssel und ganzer Schlüsselbund ergeben jeweils CHF 10.00;
  die Anzahl der Schlüssel am Bund erhöht den Betrag nicht. Eine Vermittlung
  ergibt pro Mobiltelefon CHF 20.00.
- Schlüssel, erfolgte Mobiltelefonvermittlung und gebührenfreie andere Fundsachen
  unterscheiden. Bei anderen Fundsachen darf keine Gemeindegebühr entstehen;
  Finderlohn und Auslagenersatz bleiben unabhängig davon möglich.
- Rollenrechte, Wiederherstellung und Übernahme vorhandener Daten bleiben erhalten.

Die Testliste ist durch Domain-, Speicher- und Sicherungstests abgedeckt. Zusätzlich
wurde die Oberfläche in einem separaten Edge-Testprofil mit künstlichen Daten
geprüft: Gebührenplan, PDF-Erzeugung, Druckabbruch, bestätigte Herausgabe und
Gebührenzahlung, Abschluss, Nachdruck, Wiederöffnung und VIEWER-Lesezugriff.
Der Aufruf des Druckdialogs wurde in dieser automatisierten Prüfung simuliert;
ein physischer Papierausdruck und die Bedienung eines echten Druckdialogs wurden
nicht bestätigt. Die ergänzende manuelle Anleitung steht in
[WORKFLOW-TESTPLAN.md](WORKFLOW-TESTPLAN.md).
