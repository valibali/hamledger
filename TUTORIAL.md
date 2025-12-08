# HamLedger Tutorial - Teljes Funkcionalitás Útmutató

## Tartalomjegyzék

1. [Bevezetés](#bevezetés)
2. [Kezdeti Beállítás](#kezdeti-beállítás)
3. [Főképernyő Áttekintés](#főképernyő-áttekintés)
4. [QSO Bevitel](#qso-bevitel)
5. [Távoli Állomás Információk](#távoli-állomás-információk)
6. [Rig Vezérlés (CAT Control)](#rig-vezérlés-cat-control)
7. [Frekvencia és S-Meter](#frekvencia-és-s-meter)
8. [Propagációs Adatok, Óra és Időjárás](#propagációs-adatok-óra-és-időjárás)
9. [DX Cluster](#dx-cluster)
10. [Napló Terület](#napló-terület)
11. [Naplókönyv](#naplókönyv)
12. [QSL Kártya Kezelés](#qsl-kártya-kezelés)
13. [ADIF Import/Export](#adif-importexport)
14. [WSJT-X Integráció](#wsjt-x-integráció)
15. [Konfigurációs Beállítások](#konfigurációs-beállítások)
16. [Díjak és Statisztikák](#díjak-és-statisztikák)
17. [Hibaelhárítás](#hibaelhárítás)

## Bevezetés

A HamLedger egy modern, Electron-alapú amatőr rádió naplózó alkalmazás, amely átfogó funkcionalitást biztosít a QSO-k kezeléséhez, rig vezérléshez és DX cluster integrációhoz.

### Főbb Jellemzők

- **Modern felhasználói felület**: Vue.js alapú, reszponzív design
- **CAT Control**: Hamlib alapú rig vezérlés
- **DX Cluster integráció**: Valós idejű spot információk
- **QRZ.com integráció**: Automatikus állomás információ lekérdezés
- **ADIF támogatás**: Import/export funkcionalitás
- **QSL kártya kezelés**: Automatikus címke generálás
- **WSJT-X integráció**: Digitális módok támogatása
- **Propagációs adatok**: Valós idejű ionoszféra információk

## Kezdeti Beállítás

### Setup Wizard

Az alkalmazás első indításakor egy beállítási varázsló vezeti végig a konfigurációs folyamaton:

#### 1. lépés: Állomás Információk
- **Hívójel**: Kötelező mező, automatikus nagybetűs konverzió
- **QTH**: Állomás helye (pl. Budapest, Hungary)

#### 2. lépés: Kiegészítő Információk
- **Maidenhead Locator**: Opcionális, valós idejű validáció (pl. JN97)
- **IARU Régió**: Választás a három régió közül

#### 3. lépés: Sávválasztás
- **HF sávok**: 160m-10m közötti sávok
- **VHF/UHF sávok**: 6m, 2m, 70cm
- **Gyors kiválasztás**: "All HF", "VHF/UHF", "Clear All" gombok

#### 4. lépés: ADIF Import
- Meglévő napló importálása
- Valós idejű progress követés
- Hibakezelés és visszajelzés

#### 5. lépés: QRZ.com Konfiguráció
- API hozzáférés beállítása
- Felhasználónév és jelszó megadása
- Helyi tárolás biztonsági megjegyzésekkel

#### 6. lépés: CAT Control Beállítás
- **Windows**: Automatikus Hamlib telepítés
- **Linux**: Telepítési útmutatók és parancsok
- Tűzfal kivételek konfigurálása
- rigctld útvonal beállítása

## Főképernyő Áttekintés

### Navigációs Oldalsáv

A bal oldali navigációs sáv négy fő nézetet biztosít:

1. **QSO nézet** (📡): Fő naplózási felület
2. **Naplókönyv** (📖): Teljes QSO lista kezelése
3. **Díjak** (🏆): Statisztikák és díjak (fejlesztés alatt)
4. **Beállítások** (⚙️): Konfigurációs panel

### Főképernyő Elrendezés

A QSO nézet három fő területre oszlik:

- **Bal oszlop**: Header, QSO bevitel, napló terület
- **Jobb oszlop**: DX Cluster
- **Header**: Rig vezérlés, frekvencia/S-meter, propagáció/óra/időjárás

## QSO Bevitel

### Beviteli Mezők

#### Hívójel
- **Automatikus nagybetűs konverzió**
- **Valós idejű validáció**: Érvénytelen hívójel esetén piros háttér
- **Enter billentyű**: Gyors QSO hozzáadás

#### Sáv
- **Automatikus detektálás**: Rig frekvencia alapján
- **Csak olvasható mező**: Rig vezérlés esetén

#### RST Jelentések
- **RSTr**: Kapott jelentés
- **RSTt**: Küldött jelentés
- **Alapértelmezett értékek**: "59" phone módokhoz

#### Dátum és Idő
- **Automatikus UTC idő**: Valós idejű frissítés
- **Kézi felülírás lehetősége**
- **Formátum**: DD/MM/YYYY és HH:MM:SS

#### Megjegyzések
- **Remark**: Rövid megjegyzés (pl. "CQ Test")
- **Notes**: Részletes jegyzet (többsoros)

### QSO Hozzáadás

Három módszer a QSO hozzáadásához:
1. **"Add QSO" gomb** kattintás
2. **Enter billentyű** a hívójel mezőben
3. **Automatikus**: WSJT-X integráció esetén

## Távoli Állomás Információk

### Automatikus Információ Lekérdezés

A hívójel bevitele után 500ms késleltetéssel automatikusan lekérdezi:

#### QRZ.com Adatok (ha konfigurálva)
- **Név és cím**: Teljes állomás információ
- **QTH**: Helység és ország
- **Grid locator**: Maidenhead koordináták
- **QSL információk**: LOTW, eQSL státusz

#### Földrajzi Adatok
- **Koordináták**: Szélesség és hosszúság
- **Távolság számítás**: Haversine formula
- **Helyi idő**: Időzóna alapú számítás
- **Időjárás**: OpenMeteo API integráció

#### Hordozható Működés Detektálás
- **/P, /M, /MM** utótagok felismerése
- **Speciális működési módok** jelzése

### Hibaelhárítás

#### QRZ Hiba Kezelés
- **Piros keret**: Sikertelen lekérdezés esetén
- **Figyelmeztetés üzenet**: Hitelesítési problémák
- **Offline mód**: Helyi adatok használata

## Rig Vezérlés (CAT Control)

### Kapcsolat Beállítás

#### Rigctld Konfiguráció
- **Host**: Alapértelmezetten localhost
- **Port**: Alapértelmezetten 4532
- **Rig Model**: Opcionális, de ajánlott
- **COM Port**: Soros port beállítás

#### Automatikus Funkciók
- **Frekvencia szinkronizálás**: Rig → Alkalmazás
- **Sáv detektálás**: Frekvencia alapú automatikus sáv
- **Mód szinkronizálás**: LSB/USB/CW/DATA

### Kapcsolat Állapotok

#### Állapot Jelzők
- **Zöld**: Kapcsolódva és működik
- **Piros**: Kapcsolat megszakadt
- **Sárga**: Kapcsolódás folyamatban
- **Kék**: WSJT-X mód aktív

#### Vezérlő Gombok
- **Connect**: Kapcsolat létrehozása
- **Reconnect**: Újrakapcsolódás
- **Disconnect**: Kapcsolat bontása
- **Settings**: Beállítások módosítása

### Hibaelhárítás

#### Gyakori Problémák
- **rigctld nem található**: PATH beállítás ellenőrzése
- **Port foglalt**: Más alkalmazás használja
- **Soros port hozzáférés**: Linux dialout csoport
- **Tűzfal blokkolás**: Windows kivételek

## Frekvencia és S-Meter

### Frekvencia Megjelenítés

#### Formátum
- **Nagy számjegyek**: MHz egész rész
- **Kis számjegyek**: kHz tizedes rész
- **Szerkeszthető**: Kattintásra input mező
- **VFO jelző**: Aktív VFO megjelenítése

#### Split Működés
- **SPLIT gomb**: Split mód aktiválása
- **TX frekvencia**: Zárójelben megjelenítve
- **Külön szerkesztés**: TX frekvencia módosítása

### S-Meter

#### Skála Elemek
- **S1-S9**: Hagyományos S-egységek
- **+20, +40, +60**: dB értékek S9 felett
- **Színkódolás**: Fehér → Szürke → Narancs

#### Gyártó Specifikus Kalibrálás
- **Generic**: Alapértelmezett skála
- **Gyártó specifikus**: Különböző rig típusokhoz

### Mód Választás

#### Támogatott Módok
- **Phone**: LSB, USB
- **CW**: Morse kód
- **Digital**: DATA, FT8, FT4, PSK31
- **Automatikus váltás**: Frekvencia alapú

## Propagációs Adatok, Óra és Időjárás

### Propagációs Információk

#### Ionoszféra Adatok
- **SFI**: Napfolt index (Zöld: >50, Narancs: 25-50, Piros: <25)
- **A-index**: Geomágneses aktivitás (Zöld: ≤10, Narancs: 10-12, Piros: >12)
- **K-index**: Geomágneses zavar (Zöld: ≤2.25, Narancs: 2.25-5.4, Piros: >5.4)
- **Aurora**: Sarki fény aktivitás

#### Adatforrás
- **WWV/WWVH**: Hivatalos propagációs adatok
- **15 perces frissítés**: Automatikus adatletöltés
- **Állomás információ**: Adatforrás megjelenítése

### UTC Óra

#### Jellemzők
- **Valós idejű frissítés**: Másodperces pontosság
- **UTC formátum**: HH:MM:SS
- **Színkódolás**: Fehér szöveg

### Helyi Időjárás

#### Adatok
- **Hőmérséklet**: Celsius fokban
- **Időjárás kód**: Szöveges leírás
- **Helyi koordináták**: Grid locator alapján

#### Konfiguráció
- **OpenMeteo API**: Ingyenes időjárás szolgáltatás
- **Automatikus helymeghatározás**: Maidenhead locator alapján

## DX Cluster

### Spot Megjelenítés

#### Frekvencia Skála
- **Vertikális elrendezés**: Frekvencia alapú pozicionálás
- **Nagyobb és kisebb osztások**: 10 részre osztott skála
- **MHz címkék**: Frekvencia értékek megjelenítése

#### Spot Címkék
- **Két oszlop**: Újabb és régebbi spotok
- **Átlátszóság**: Kor alapú fade-out effekt
- **Színkódolás**: 
  - Zöld keret: Már dolgozott állomás
  - Kék jobb szél: LOTW
  - Narancs jobb szél: eQSL

### Nagyító Funkció

#### Aktiválás
- **Mouse hover**: Spot felett lebegés
- **±5 kHz tartomány**: Közeli spotok megjelenítése
- **Részletes információk**: Frekvencia, mód, idő, spotter

#### Tartalom
- **Callsign és frekvencia**: Nagy betűkkel
- **Mód és idő**: Kiegészítő információk
- **Spotter lista**: Több spotter esetén
- **Worked státusz**: Zöld/narancs jelzés

### Szűrők

#### Sáv Szűrő
- **Elérhető sávok**: Dinamikus lista a spotok alapján
- **Egy sáv kiválasztás**: Aktív szűrő megjelenítése

#### Kontinens Szűrők
- **DX**: Távoli állomás kontinense
- **DE**: Spotter kontinense
- **Többszörös kiválasztás**: Kombinálható szűrők

#### Mód Szűrők
- **PHONE, CW, FT8, FT4, RTTY, PSK31**
- **Többszörös kiválasztás**: Kombinálható módok

#### Egyéb Opciók
- **Valid**: Csak validált spotok
- **Spot szám**: 25, 50, 65, 100, 200 opciók

### Spot Kattintás

#### Automatikus Beállítások
- **Rig frekvencia**: kHz → Hz konverzió
- **Mód beállítás**: 
  - PHONE → LSB (<10 MHz) vagy USB (≥10 MHz)
  - CW → CW
  - Digital → DATA
- **QSO form**: Hívójel automatikus kitöltés
- **Állomás info**: Automatikus lekérdezés

## Napló Terület

### Aktuális Session

#### Megjelenítés
- **Táblázatos forma**: Dátum, idő, hívójel, sáv, frekvencia, mód, RST, megjegyzések
- **Ország zászlók**: Hívójel mellett automatikus megjelenítés
- **Kattintható sorok**: QSO részletek megnyitása

#### Rendezés
- **Oszlop fejlécek**: Kattintható rendezés
- **Fel/le nyilak**: Rendezési irány jelzése
- **Alapértelmezett**: Dátum szerint csökkenő

### Szűrési Lehetőségek

#### Szöveg Keresés
- **Hívójel, megjegyzés, jegyzet**: Többmezős keresés
- **Wildcard támogatás**: * és ? karakterek
- **Regex mód**: Reguláris kifejezések
- **Case sensitive**: Kis/nagybetű érzékeny

#### Kategória Szűrők
- **Sáv**: Legördülő lista
- **Mód**: Elérhető módok
- **Dátum tartomány**: Kezdő és záró dátum

#### Szűrő Vezérlők
- **Show/Hide Filters**: Szűrő panel megjelenítés
- **Clear**: Összes szűrő törlése
- **Szűrt eredmények**: Találatok száma megjelenítése

### Statisztikák

#### Session Számláló
- **Aktuális session**: QSO-k száma az indítás óta
- **Összes QSO**: Teljes napló mérete
- **Szűrt eredmények**: Aktív szűrők esetén

## Naplókönyv

### Teljes Napló Kezelés

#### Virtuális Scrolling
- **Nagy adatmennyiség**: Hatékony megjelenítés
- **50 QSO batch**: Memória optimalizálás
- **Smooth scrolling**: Folyamatos görgetés

#### Batch Műveletek

##### Batch Mód Aktiválás
- **"Batch Select" gomb**: Többszörös kiválasztás mód
- **Checkbox oszlop**: Minden sor mellett
- **"Select all visible"**: Látható sorok kiválasztása
- **"Clear selection"**: Kiválasztás törlése

##### Batch Műveletek
- **QSL státusz változtatás**: Tömeges státusz frissítés
- **Export**: Kiválasztott QSO-k exportálása
- **Törlés**: Többszörös QSO törlés (megerősítéssel)

### QSO Részletek

#### Detail Dialog
- **Teljes információ**: Minden QSO adat megjelenítése
- **Állomás adatok**: QRZ.com integráció
- **Térkép**: OpenStreetMap beágyazás
- **Szerkesztés**: "Edit QSO" gomb

#### Edit Dialog
- **Minden mező szerkeszthető**: Inline szerkesztés
- **Validáció**: Valós idejű ellenőrzés
- **Mentés**: PouchDB frissítés
- **Törlés**: Megerősítéssel

## QSL Kártya Kezelés

### QSL Státusz Rendszer

#### Státusz Kódok
- **N**: Not sent/received (Piros)
- **P**: Print label (Narancs) - PDF generálás
- **L**: Label printed (Kék) - Nyomtatásra kész
- **S**: Sent (Sárga) - Elküldve
- **R**: Received (Zöld) - Megérkezett
- **B**: Both (Kék) - Mindkét irány
- **Q**: QSL requested (Lila) - Kérve

#### Státusz Váltás
- **Bal klik**: Előre ciklikus váltás
- **Jobb klik**: Hátra ciklikus váltás
- **Tooltip**: Státusz jelentések és használati útmutató

### Címke Generálás

#### Automatikus PDF Generálás
- **"P" státusz**: Automatikus címke generálás
- **Megerősítő dialog**: "Generate Label?" kérdés
- **Állomás adatok**: QRZ.com címadatok lekérdezése
- **PDF kimenet**: Nyomtatható formátum

#### Batch Címke Generálás
- **Többszörös kiválasztás**: Batch módban
- **Progress követés**: 0-100% megjelenítés
- **Automatikus státusz**: P → L váltás sikeres generálás után
- **Fájl megnyitás**: "Open Folder" gomb

#### Címke Adatok
- **Hívójel és név**: QRZ.com adatokból
- **Cím sorok**: addr1, addr2 mezők
- **Ország**: Automatikus meghatározás
- **QSO adatok**: Dátum, sáv, mód, RST

## ADIF Import/Export

### Import Funkció

#### Fájl Kiválasztás
- **Támogatott formátumok**: .adi, .adif
- **Fájl böngésző**: Natív rendszer dialog
- **Előnézet**: QSO számok megjelenítése

#### Import Folyamat
- **Progress bar**: Valós idejű előrehaladás
- **Batch feldolgozás**: Memória hatékony
- **Hibakezelés**: Részletes hibaüzenetek
- **Eredmény**: Importált QSO-k száma

#### Wizard Integráció
- **Setup során**: Meglévő napló importálása
- **Progress követés**: Vizuális visszajelzés

### Export Funkció

#### Export Opciók
- **Teljes napló**: Összes QSO exportálása
- **Szűrt eredmények**: Csak a szűrt QSO-k
- **Kiválasztott QSO-k**: Batch módban

#### Export Dialog
- **Opció választás**: Teljes/szűrt/kiválasztott
- **QSO számok**: Előnézet megjelenítése
- **Fájl mentés**: Natív rendszer dialog

#### ADIF Formátum
- **Szabványos mezők**: Teljes ADIF kompatibilitás
- **Kódolás**: UTF-8 támogatás
- **Dátum formátum**: YYYYMMDD
- **Idő formátum**: HHMMSS

## WSJT-X Integráció

### Konfiguráció

#### Beállítások
- **UDP Port**: Alapértelmezetten 2237
- **Auto Log**: Automatikus QSO naplózás
- **Log Only Confirmed**: Csak megerősített QSO-k
- **Enable Integration**: Főkapcsoló

#### CAT Control Átadás
- **"Hand over to WSJT-X"**: CAT vezérlés átadása
- **Rigctld leállítás**: Automatikus disconnect
- **WSJT-X listener**: UDP kommunikáció indítása

### Működés

#### UDP Kommunikáció
- **WSJT-X protokoll**: Natív üzenet formátum
- **Valós idejű adatok**: Frekvencia, mód, decode-ok
- **QSO logging**: Automatikus napló bejegyzés

#### CAT Control Visszavétel
- **Figyelmeztetés**: WSJT-X CAT kikapcsolása
- **Megerősítő dialog**: Biztonsági ellenőrzés
- **Rigctld restart**: Automatikus újrakapcsolás

#### Státusz Jelzők
- **Kék státusz**: WSJT-X mód aktív
- **Running/Stopped**: Listener állapot
- **Error handling**: Kapcsolat hibák kezelése

## Konfigurációs Beállítások

### Kategóriák

#### Station (Állomás)
- **Callsign**: Saját hívójel
- **QTH**: Állomás helye
- **Grid**: Maidenhead locator
- **IARU Region**: Régió beállítás
- **Selected Bands**: Aktív sávok

#### CAT Control
- **Enabled**: CAT vezérlés engedélyezése
- **Host/Port**: Rigctld kapcsolat
- **Rig Model**: Rádió típus
- **COM Port**: Soros port
- **rigctld Path**: Executable útvonal

#### Online Services
- **QRZ.com**: API hozzáférés
- **Username/Password**: Hitelesítési adatok
- **Enabled**: Szolgáltatás aktiválás

#### APIs
- **Nominatim**: Geocoding szolgáltatás
- **OpenMeteo**: Időjárás API
- **Base URLs**: Szolgáltatás végpontok

#### Database
- **PouchDB**: Helyi adatbázis
- **Sync options**: Szinkronizálási beállítások

#### UI
- **Theme**: Megjelenés beállítások
- **Language**: Nyelv választás

#### WSJT-X
- **Integration**: Integráció engedélyezése
- **UDP Port**: Kommunikációs port
- **Auto logging**: Automatikus naplózás

### Platform Specifikus Beállítások

#### Windows
- **Hamlib Auto-install**: Automatikus telepítés
- **Firewall Exceptions**: Tűzfal kivételek
- **Core Isolation Warning**: Biztonsági figyelmeztetés

#### Linux
- **Package Installation**: Telepítési útmutatók
- **Dialout Group**: Soros port hozzáférés
- **Permission Commands**: Sudo parancsok

### Validáció és Tesztelés

#### Valós Idejű Ellenőrzés
- **rigctld Path**: Executable létezés
- **QRZ Credentials**: API hozzáférés
- **Network Connectivity**: Szolgáltatás elérhetőség

#### Hibaüzenetek
- **Részletes hibák**: Konkrét problémák
- **Megoldási javaslatok**: Hibaelhárítási tippek
- **Dokumentáció linkek**: További segítség

## Díjak és Statisztikák

### Jelenlegi Állapot
- **"Not yet available"**: Fejlesztés alatt
- **Jövőbeli funkciók**: DXCC, WAS, WAZ számítások

### Tervezett Funkciók
- **DXCC Progress**: Országok státusza
- **Award Tracking**: Díj követés
- **Statistics**: QSO statisztikák
- **Charts**: Grafikus megjelenítés

## Hibaelhárítás

### Gyakori Problémák

#### CAT Control
1. **rigctld not found**
   - PATH ellenőrzése
   - Hamlib telepítés
   - Absolute path használata

2. **Connection refused**
   - Port foglaltság ellenőrzése
   - Tűzfal beállítások
   - rigctld restart

3. **Serial port access** (Linux)
   - Dialout csoport tagság
   - Újrabejelentkezés szükségessége

#### QRZ.com Integration
1. **Authentication failed**
   - Felhasználónév/jelszó ellenőrzése
   - API hozzáférés aktiválása
   - Network connectivity

2. **Rate limiting**
   - Túl gyakori lekérdezések
   - Késleltetés beállítása

#### Database Issues
1. **PouchDB errors**
   - Adatbázis fájl jogosultságok
   - Disk space ellenőrzése
   - Backup és restore

#### WSJT-X Integration
1. **UDP communication**
   - Port konfliktusok
   - Firewall blokkolás
   - WSJT-X beállítások

### Logok és Diagnosztika

#### Console Logs
- **Developer Tools**: F12 billentyű
- **Console tab**: Hibaüzenetek
- **Network tab**: API hívások

#### Fájl Helyek
- **Settings**: userData/settings.json
- **Database**: userData/HamLedger.db
- **Logs**: userData/logs/

### Támogatás

#### Dokumentáció
- **GitHub Repository**: Forráskód és issues
- **Wiki**: Részletes dokumentáció
- **FAQ**: Gyakori kérdések

#### Közösség
- **GitHub Issues**: Hibabejelentés
- **Discussions**: Közösségi támogatás
- **Feature Requests**: Új funkció kérések

---

*Ez a tutorial a HamLedger alkalmazás teljes funkcionalitását lefedi. A funkciók folyamatosan fejlődnek, ezért érdemes rendszeresen ellenőrizni a frissítéseket.*
