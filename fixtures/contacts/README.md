# Beispieldateien Kontaktimport (BRIEFING 13.4)

Erfundene Kontakte, Telefonnummern aus dem fiktiven Bereich 555, Mailadressen unter example.org.

- `kontakte_sample.csv`: 25 Zeilen mit Semikolon, davon 3 Dubletten zu den Seed-Kontakten
  (Jana Hofmann über die Mailadresse, Peter Albrecht über die Telefonnummer, Stefan Lorenz über Name und Medium)
  und 2 Zeilen ohne Mailadresse (Nina Berger, Noah Zimmermann).
- `kontakte_sample.vcf`: 10 Einträge im vCard-Format 3.0 wie aus iCloud exportiert (N, FN, ORG, TITLE, EMAIL, TEL, NOTE),
  Greta Fischer mit zwei Telefonnummern, Peter Albrecht als Dublette zum Seed.

- `kontakte_sample.xlsx`: dieselben Daten wie die CSV-Datei (erzeugt mit `node scripts/contacts-xlsx.mjs`).
