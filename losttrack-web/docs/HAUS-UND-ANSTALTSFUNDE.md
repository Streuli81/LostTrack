# Haus-/Anstaltsfunde: Rollen und Übergabekette

Stand: 26.10.2026. Diese Ergänzung beschreibt die umgesetzte Erfassung und Schutzregeln. Sie entscheidet keine konkrete Finder- oder Eigentumsberechtigung.

## Bestätigte Anforderungen

Der Projektverantwortliche möchte Spital-, Geschäfts- und vergleichbare Haus-/Anstaltsfunde von normalen öffentlichen Funden unterscheiden. Fundperson, Überbringer und rechtlich relevante Finderstelle werden getrennt geführt. Direktabgabe durch eine Person und spätere Abgabe durch die Einrichtung sind unterschiedliche Fälle.

Auf ausdrückliche Rückfrage hat der Projektverantwortliche bestätigt: **Bei dieser Fundart Finderlohnforderungen und -zahlungen sperren, ohne dies als persönlichen Verzicht der Fundperson darzustellen. Auslagenersatz bleibt separat.**

## Bedienung

1. In **Neue Fundsache → Fundumgebung** die Auswahl **Haus-/Anstaltsfund** treffen. Die übrigen Fundarten einschliesslich Privatgrund bleiben erhalten.
2. **Einrichtung / Betrieb** und den **genauen Fundort innerhalb der Einrichtung** angeben. Beispiele sind See-Spital Horgen/Wartebereich oder Migros-Filiale/Kühlregal. Dies sind Eingabebeispiele; die Anwendung bestimmt die rechtliche Einordnung nicht anhand einer Marke oder eines Stichworts.
3. Funddatum und Fundzeit in den vorhandenen allgemeinen Feldern erfassen. Eine zusätzliche konkurrierende Funddatumsangabe wird nicht angelegt.
4. Soweit tatsächlich bekannt, **Datum der Übergabe an die Einrichtung** und **Datum der Übergabe an das Fundbüro** erfassen. Diese historischen Angaben sind vom automatischen Erfassungszeitpunkt verschieden. Unbekannte Daten leer lassen.
5. Den **Überbringer / die Kontaktperson** erfassen. Unter **Eingang beim Fundbüro** zwischen Direktabgabe durch eine Person, Abgabe durch die Einrichtung und noch ungeklärtem Eingang unterscheiden. Bei Abgabe durch die Einrichtung deren Namen gesondert angeben.
6. Die **ursprüngliche Fundperson** im bisherigen Personenbereich erfassen, soweit sie bekannt ist. Sie darf bei einem Haus-/Anstaltsfund unbekannt bleiben. Ihre persönlichen Finderlohn-Radioknöpfe werden ausgeblendet. Im Datenbestand bleibt sie aus Kompatibilitätsgründen unter `finder`; daraus folgt bei dieser Fundart keine Anspruchszuordnung.
7. **Rechtlicher Finder / zuständige Finderstelle** und deren Kontakt separat eintragen. Die Anwendung kopiert weder die Fundperson noch den Einrichtungs-/Markennamen automatisch in diese Rolle.
8. Erst nach fachlicher Prüfung **Zuständige Finderstelle und Berechtigung fachlich geprüft** bestätigen und eine **Prüfgrundlage** dokumentieren. Name der Finderstelle und Prüfvermerk sind dafür erforderlich. Bei Änderung von Einrichtung oder Finderstelle im Formular wird die Bestätigung zurückgenommen; eine erneute Prüfung ist erforderlich.

Die blosse Eingabe von „Migros“ oder „Spital“ bestätigt keinen konkreten Rechtsträger, keine Vertretungsbefugnis und keine Herausgabeberechtigung.

## Verhalten im Ablauf

- Fundquittungen sind auch bei noch ungeklärter Finderzuordnung möglich. Sie bestätigen die dokumentierte Abgabe; noch ungeklärte Rollen werden so bezeichnet.
- Die Fundquittung nennt Überbringer, ursprüngliche Fundperson, Einrichtung und erfasste Finderstelle getrennt. Sie enthält keine Betragstabelle. Bei Haus-/Anstaltsfunden wird keine persönliche Verzichtserklärung oder darauf bezogene Unterschrift der Fundperson ausgegeben.
- Das Schreiben **Herausgabe an Finder** bezieht sich bei dieser Fundart auf die manuell erfasste Finderstelle. Die ursprüngliche Fundperson und ein mit ihr vorbelegter Abholer werden nicht automatisch als Empfänger eingesetzt.
- Ohne bestätigte Finderzuordnung mit Prüfvermerk werden Finderherausgabe und Auslagenauszahlung durch die Speicherfunktion abgewiesen. Die allgemeine Eigentümerherausgabe ist kein automatischer Nachweis der Finderrechte; die Empfängerprüfung bleibt Aufgabe des Fundbüros.
- Neue Finderlohnforderungen und -zahlungen sind im Ablauf und in den alten Finderlohn-Speicherfunktionen gesperrt. Der reguläre neue Finderlohnbetrag beträgt CHF 0 ohne persönliche Verzichtserklärung. Auslagen werden weiterhin separat geplant und können nach geprüfter Berechtigung getrennt ein-/ausgezahlt werden.
- Historische Finderlohnbuchungen und Forderungen werden bei einer späteren Klassifizierung nicht gelöscht oder stillschweigend umgerechnet. Abweichungen sperren den Gesamtabschluss und müssen fachlich geklärt werden. Bereits bebuchte Beträge können nicht einfach über einen neuen Plan auf null gesetzt werden.
- Ein Gesamtabschluss verlangt auch die bestätigte Finderzuordnung. Es gibt keine automatische Eigentumsübertragung an Fundperson, Einrichtung oder Fundbüro.
- Kommunale Standard-Prüfgrenzen für Verwertung/Findererwerb werden weiterhin nicht pauschal auf Haus-/Anstaltsfunde angewendet. Die blosse Übernahme durch das Fundbüro aktiviert diese Fristen nicht.

## Daten und Nachvollziehbarkeit

Die zusätzlichen Angaben stehen unter `institution`. Entwürfe, definitive Erfassung, Bearbeitung, Audit, Sicherung/Wiederherstellung und neue Drucksnapshots erhalten diese Angaben. Nachdrucke verwenden den damaligen Rollenstand. Die Suche nach Fundperson/Finderstelle/Überbringer berücksichtigt auch Einrichtungen und deren Kontaktangaben.

Bestehende Personenangaben werden nicht automatisch einer Einrichtung zugeschrieben. Bereits als `BUILDING` erfasste Fälle erhalten die vorsichtige Rollenprüfung; es wird dadurch keine Berechtigung bestätigt. Alte Quittungen ohne solche Angaben werden nicht nachträglich mit erfundenen Rollen ergänzt.

## Geprüfte Quellen und offene Rechtsfragen

Am 26.10.2026 geprüft:

- [Bundesratsbericht „Befristung der Aufbewahrungspflicht?“, April 2015, Ziffer 2.3.2, PDF-Seite 7](https://www.newsd.admin.ch/newsd/message/attachments/39169.pdf): Der Bericht erläutert Anstaltsfunde am Beispiel zurückgelassener Sachen und unterscheidet sie von Sachen, die aufgrund eines Vertrags anvertraut wurden. Er beschreibt die Ablieferung an die zuständige Haus-/Anstaltsstelle, deren Finderstellung sowie die Übergabe zur Aufbewahrung an Polizei oder Fundbüro. Er ist ein Bericht von 2015 und keine aktuelle Einzelfallfreigabe für Horgen.
- [Luzerner Polizei: Gesetzliche Grundlage, Art. 720 und 722 ZGB](https://polizei.lu.ch/organisation/verwaltungspolizei/fundbuero/Gesetzliche_Grundlage): Die Behördeninformation gibt die besondere Finderstellung und den fehlenden Finderlohnanspruch beim Haus-/Anstaltsfund wieder. Ihre Regeln werden nicht pauschal als vollständiger Horgner Ablauf übernommen.

Verbindlich zu klären bleiben insbesondere der konkrete Rechtsträger bzw. Hausherr/Mieter/Aufsichtsträger, Rechte bei Grenzfällen, die Vereinbarung über die Übernahme durch Horgen, Bekanntmachung, Fristregime und Voraussetzungen eines späteren Eigentumserwerbs. Auch der Wortlaut neuer institutioneller Quittungserklärungen ist noch nicht rechtlich freigegeben. Aus reparatur-, lagerungs- oder anderen Vertragsverhältnissen zurückgelassene Sachen sind nicht automatisch Fundsachen.

## Tatsächlich ausgeführte Prüfungen

`npm.cmd test` prüft zusätzlich Spital/Migros, unbekannte Fundperson, Einrichtungspflicht, getrennte Übergabeketten, Datumsfehler, fehlende Prüfvermerke, Finderlohnsperre, unbelegte Finderherausgabe, getrennten Auslagenersatz, Erhalt historischer Buchungen, Suche, Audit, Drucksnapshot und Sicherung/Wiederherstellung.

`node scripts/check-institution-ui.mjs` prüft in einem eigens gestarteten leeren Edge-Testprofil auf Port 9237 mit lokalem Entwicklungsserver auf Port 5199 zwei erfundene Fälle: Spital/Direktabgabe und Migros/Einrichtungsabgabe. Geprüft sind die Erfassung ohne persönliche Finderlohnwahl, gesperrte ungeprüfte Finderherausgabe, manuelle Finderzuordnung sowie einseitige Fundquittungs-PDFs ohne Beträge und ohne persönlichen Verzicht. Der Druckaufruf wird simuliert; kein Papierausdruck wurde bestätigt. Niemals ein normales Benutzerprofil für diesen Test verwenden.
