# Hamledger Útmutató (Magyar)

![Hamledger Fő Nézet](./public/qso.png)

## Áttekintés

Ez az útmutató végigvezet a Hamledger használatán az első indítástól a versenyzésig és a keyer funkciókig. Gyakorlati, lépésről‑lépésre leírás képernyőképekkel.

---

## Tartalomjegyzék

1. [Első Indítás és Állomás Beállítás](#első-indítás-és-állomás-beállítás)
2. [Főképernyő Elrendezés](#főképernyő-elrendezés)
3. [QSO Bevitel Munkafolyamat](#qso-bevitel-munkafolyamat)
4. [Távoli Állomás Információk](#távoli-állomás-információk)
5. [Rig Vezérlés (CAT)](#rig-vezérlés-cat)
6. [DX Cluster](#dx-cluster)
7. [Napló Terület és Szűrés](#napló-terület-és-szűrés)
8. [QSO Részletek](#qso-részletek)
9. [Díjak (Awards)](#díjak-awards)
10. [Contest Mód](#contest-mód)
11. [Speed Dial és Multiplierek](#speed-dial-és-multiplierek)
12. [Contest Szezonok](#contest-szezonok)
13. [Voice Keyer](#voice-keyer)
14. [CW Keyer](#cw-keyer)
15. [Hotkeyek és Sorolás](#hotkeyek-és-sorolás)
16. [Beállítások Összefoglaló](#beállítások-összefoglaló)
17. [Hibaelhárítás](#hibaelhárítás)

---

## Első Indítás és Állomás Beállítás

Az első indításnál add meg a legfontosabb adatokat.

![Beállítások - Állomás és Rig](./public/settings-station-rig.png)

Ajánlott minimum:
- **Hívójel**
- **QTH / Hely**
- **Locator (Maidenhead)** távolság/azimut számításhoz
- **IARU régió**

Opcionális:
- QRZ felhasználó/jelszó automatikus lekérdezéshez
- Használt sávok kijelölése

---

## Főképernyő Elrendezés

![Főképernyő](./public/qso.png)

A fő nézet gyors munkára van optimalizálva:
- **QSO bevitel** bal oldalon
- **DX Cluster** jobb oldalon
- **Rig státusz + frekvencia** felül
- **Napló terület** középen

---

## QSO Bevitel Munkafolyamat

![QSO Bevitel](./public/qso.png)

1. Írd be a hívójelet (automatikus nagybetű).
2. Sáv/mód/frekvencia jön CAT‑ből, ha aktív.
3. Add meg az RST‑t és az exchange‑et.
4. **Enter** – naplózás.

Tipp:
- Contest módban a Serial S / Serial R mindig látható.
- Hívójel javaslatok gépelés közben megjelennek (a karakterek bárhol egyezhetnek).

---

## Távoli Állomás Információk

![QSO Részletek](./public/qso_detail.png)

Automatikus állomásadatok:
- Ország, QTH, grid
- Távolság és azimut
- Helyi idő és időjárás (ha elérhető)

---

## Rig Vezérlés (CAT)

![CAT Beállítás](./public/cat-settings.png)

1. Nyisd meg a CAT beállítást.
2. Válaszd a rig modellt, portot, baudot.
3. Csatlakozás.

Sikeres kapcsolat után:
- Frekvencia és mód élőben frissül.
- VFO/mód jelvények megjelennek.

---

## DX Cluster

![DX Cluster](./public/dxcluster.png)

Funkciók:
- Spotok frekvencia alapján elhelyezve
- Hover kiemelés
- Kattintás → hívójel bekerül a QSO mezőbe

---

## Napló Terület és Szűrés

![Napló](./public/logbook.png)

Lehetőségek:
- Rendezés oszlop szerint
- Szűrők (gombbal előhívható)
- Sorra kattintva QSO részletek

---

## QSO Részletek

![QSO Részletek](./public/qso_detail.png)

Részletek:
- Teljes állomásadatok
- Térkép
- Jegyzetek, megjegyzések, QSL státusz

---

## Díjak (Awards)

![Awards](./public/awards.png)
![Awards Részletek](./public/awards-detail.png)
![Awards DXCC](./public/awards-detail-dxcc.png)

---

## Contest Mód

![Contest Mód](./public/contest-mode.png)

Tartalom:
- Versenyhez optimalizált QSO bevitel
- Speed dial
- Multiplierek és worked állapot
- Rate & score panel

---

## Speed Dial és Multiplierek

![Speed Dial Beállítás](./public/speed-dial-settings.png)
![Multiplier Szabályok](./public/multiplier-rules.png)

Speed dial beállítás:
- Javaslattípus
- Kártyaszám + időlimit

Multiplierek:
- Prefix/wildcard szabályok
- A legnagyobb érték számít
- Pontszámításba beépítve

---

## Contest Szezonok

![Contest Setup](./public/contest-setup.png)
![Contest Szezonok](./public/contest-sessions.png)
![Contest Statisztika](./public/contest-stats.png)

Folyamat:
1. Contest setup (név, típus, exchange).
2. Start gomb vagy első QSO indítja a sessiont.
3. Session lista, statisztika, export.

---

## Voice Keyer

![Voice Keyer](./public/voice-keyer.png)

Voice keyer:
- Voice clip felvétel
- Üzenetek építése
- Hotkey hozzárendelés
- Lejátszás sorban (nincs átfedés)

---

## CW Keyer

![CW Keyer](./public/voice-keyer-cw.png)

CW keyer:
- CW clip felvétel
- Üzenetek építése
- Winkeyer kompatibilis workflow

---

## Hotkeyek és Sorolás

![Hotkeys Strip](./public/hotkeys-strip.png)

Állapotjelzés:
- **Aktív**: villogó keret
- **Várakozik**: kiemelt keret

---

## Beállítások Összefoglaló

![Beállítások - Állomás és Rig](./public/settings-station-rig.png)

Fontos beállítások:
- Állomásadatok és locator
- Rig konfiguráció
- QRZ beállítások
- Sávok kijelölése

---

## Hibaelhárítás

Gyakori megoldások:
- CAT nem csatlakozik: rig modell/port/baud ellenőrzés, Hamlib telepítés.
- QRZ hibák: jelszó ellenőrzés a beállításokban.
- Audio gondok: OS bemenet/kimenet beállítás.

---

Ha bővítenéd (pl. WSJT‑X, ADIF import/export részletesen), szólj és kibővítem.
