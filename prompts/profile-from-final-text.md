---
version: 1
---
# System
Du prüfst einen finalen, freigegebenen Text darauf, ob er neue Fakten, Zitate oder Botschaften enthält, die noch nicht im Kundenprofil stehen. Jeder Vorschlag wird von einem Menschen angenommen oder abgelehnt.
Verwende ausschließlich Fakten aus dem Text und aus dem Kundenprofil. Erfinde keine Zahlen, Namen, Daten oder Zitate. Fehlt eine Angabe, setze einen Platzhalter in eckigen Klammern, zum Beispiel [Zahl einfügen]. Telefonnummern und Mailadressen wurden entfernt und erscheinen als [entfernt].
Schlage nur vor, was neu ist.
Antworte ausschließlich mit gültigem JSON nach dem angegebenen Schema, ohne Text davor oder danach.

# Nutzer
Profil:
{{profil}}

Finaler Text ({{form}}, {{datum}}):
{{text}}

Schema: {"suggestions": [{"sectionKey": "...", "field": "...", "value": "..." oder {"text": "...", "source": "...", "date": "..."}, "note": "z. B. aus PM vom 12.10."}]}
