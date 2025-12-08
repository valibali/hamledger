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
- **Windows**: Automatikus Hamlib telepítés admin jogokkal és tűzfal konfigurációval
- **Linux**: Telepítési útmutatók és parancsok dialout csoport beállítással
- Tűzfal kivételek konfigurálása Windows Defender számára
- rigctld útvonal beállítása és COM port konfiguráció

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

### Windows Beállítás (Részletes)

#### Hamlib Telepítés
A HamLedger automatikusan telepíti a Hamlib-et Windows rendszeren, de ehhez admin jogosultságok szükségesek. Kattints a "Install Hamlib" gombra a setup wizard 6. lépésében, és engedélyezd az admin hozzáférést amikor a rendszer kéri. A telepítés során a program letölti a legfrissebb Hamlib verziót és telepíti a Program Files könyvtárba.

#### Tűzfal Konfiguráció
A CAT vezérlés működéséhez a Windows Defender tűzfalban kivételeket kell létrehozni a HamLedger.exe és rigctld.exe számára. Az alkalmazás automatikusan felajánlja ezt a setup során - kattints "Yes" amikor a Windows UAC kéri az engedélyt. Ha manuálisan szeretnéd beállítani: Windows Security → Firewall & network protection → Allow an app through firewall → Add both HamLedger and rigctld.

#### Core Isolation Figyelmeztetés
Windows 10/11 rendszereken a Core Isolation (Memory Integrity) funkció megakadályozhatja a Hamlib működését. Ha a CAT vezérlés nem működik, kapcsold ki ezt a funkciót: Windows Security → Device Security → Core Isolation Details → Memory Integrity (kapcsold ki). Ez csökkenti a rendszer biztonságát, ezért csak akkor tedd meg, ha szükséges.

### Linux Beállítás (Részletes)

#### Hamlib Telepítés
Linux rendszereken manuálisan kell telepíteni a Hamlib-et a csomagkezelővel. Ubuntu/Debian: `sudo apt install libhamlib-utils`, Fedora/CentOS: `sudo dnf install hamlib`. A telepítés után ellenőrizd hogy a rigctld elérhető: `which rigctld` paranccsal.

#### Dialout Csoport Beállítás
A soros port eléréséhez a felhasználót hozzá kell adni a dialout csoporthoz: `sudo usermod -a -G dialout $USER`. Ezután jelentkezz ki és vissza, vagy használd a `newgrp dialout` parancsot. Ellenőrizd a tagságot: `groups` paranccsal.

### Rigctld Konfiguráció

#### Alapbeállítások
A Settings gombra kattintva állítsd be a kapcsolat paramétereit: Host (általában localhost), Port (4532), Rig Model (válaszd ki a rádió típusát a listából), COM Port (pl. COM3 Windows-on vagy /dev/ttyUSB0 Linux-on). A rig model kiválasztása javítja a kompatibilitást és engedélyezi a speciális funkciókat.

#### Kapcsolat Létrehozása
A Connect gombbal indítsd el a kapcsolatot - a státusz zöldre vált ha sikeres. Ha sárga marad, ellenőrizd a COM port beállításokat és hogy a rádió be van-e kapcsolva CAT módban. A Reconnect gomb újraindítja a kapcsolatot, a Disconnect bontja azt.

### Automatikus Funkciók

#### Frekvencia Szinkronizálás
A kapcsolat létrejötte után a HamLedger automatikusan követi a rádió frekvenciáját és frissíti a QSO beviteli mezőket. A frekvencia változtatása a rádiónál azonnal megjelenik az alkalmazásban, és automatikusan beállítja a megfelelő sávot a QSO formban.

#### Mód Szinkronizálás
A rádió módváltása (LSB/USB/CW/DATA) automatikusan szinkronizálódik az alkalmazással. A HamLedger felismeri a digitális módokat és megfelelően beállítja a QSO beviteli mezőket.

### Hibaelhárítás

#### Gyakori Windows Problémák
Ha a "rigctld not found" hibaüzenet jelenik meg, ellenőrizd hogy a Hamlib telepítve van-e és a PATH környezeti változóban szerepel. Ha a port foglalt, más alkalmazás (pl. másik CAT program) használhatja - zárd be azokat. Tűzfal problémák esetén add hozzá manuálisan a kivételeket.

#### Gyakori Linux Problémák
Soros port hozzáférési problémák esetén ellenőrizd a dialout csoport tagságot és a port jogosultságokat (`ls -l /dev/ttyUSB*`). Ha a rigctld nem található, telepítsd újra a hamlib csomagot és ellenőrizd a PATH-t.

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

### Spot Megjelenítés és Navigáció

#### Frekvencia Skála Használata
A DX Cluster egy vertikális frekvencia skálát használ ahol minden spot a pontos frekvenciája alapján pozicionálódik. A skála bal oldalán látható a frekvencia értékek MHz-ben, nagyobb és kisebb osztásokkal a könnyebb tájékozódás érdekében. A spotok két oszlopban jelennek meg: az újabbak balra, a régebbiek jobbra, automatikus átlátszósági effekttel az életkor alapján.

#### Spot Információk és Színkódolás
Minden spot címke tartalmazza a hívójelet, és színkódolással jelzi a státuszt: zöld keret jelzi ha már dolgoztad az állomást, kék jobb szél a LOTW megerősítést, narancs jobb szél az eQSL státuszt. A spotok automatikusan frissülnek és eltűnnek egy idő után, így mindig a legfrissebb információkat látod.

### Nagyító Funkció Használata

#### Aktiválás és Működés
Ha az egérmutatót egy spot fölé viszed, automatikusan megjelenik a nagyító ablak amely az adott frekvencia ±5 kHz tartományában lévő összes spotot megjeleníti. Ez különösen hasznos zsúfolt sávokban ahol több állomás is közel van egymáshoz. A nagyító ablak részletes információkat mutat: pontos frekvencia, mód, idő, spotter hívójel és megjegyzések.

#### Részletes Spot Adatok
A nagyító ablakban minden spot külön sorban jelenik meg, worked státusszal és QSL információkkal. Kattinthatsz bármelyik spotra a nagyítóban is, ugyanúgy működik mint a fő nézetben. A nagyító automatikusan eltűnik ha elviszed róla az egeret.

### Szűrési Rendszer

#### Sáv Szűrő Használata
A jobb oldali szűrő panelen válaszd ki a kívánt sávot - csak az adott sávban lévő spotok jelennek meg. A sáv lista dinamikusan frissül a beérkező spotok alapján, így csak azok a sávok láthatók ahol jelenleg van aktivitás. Egyszerre csak egy sáv választható ki, de a "Band" gombra kattintva visszatérhetsz az összes sáv nézetéhez.

#### Kontinens Szűrők (DX és DE)
A DX szűrő a távoli állomás (akit spotoltak) kontinensét jelöli, a DE szűrő pedig a spotter kontinensét. Például ha csak európai állomásokat szeretnél látni, válaszd az EU-t a DX szűrőnél. Ha csak európai spotterek jelentéseit akarod, válaszd az EU-t a DE szűrőnél. Több kontinens is kiválasztható egyszerre a kombinált szűréshez.

#### Mód és Egyéb Szűrők
A mód szűrőkkel (PHONE, CW, FT8, stb.) csak a kiválasztott módokban működő állomásokat jelenítheted meg. A "Valid" kapcsoló csak a validált spotokat mutatja, kiszűrve a hamis vagy hibás jelentéseket. A spot szám beállítással (25-200) korlátozhatod a megjelenített spotok számát a teljesítmény optimalizálásához.

### Spot Kattintás és QSO Integráció

#### Automatikus Rig Beállítás
Amikor rákattintasz egy spotra, a HamLedger automatikusan beállítja a rig frekvenciáját (ha CAT vezérlés aktív) és a megfelelő módot. A frekvencia konvertálódik kHz-ről Hz-re a rig számára, a mód pedig intelligensen választódik ki: PHONE spotok LSB-re (<10 MHz) vagy USB-re (≥10 MHz), CW spotok CW módra, digitális spotok DATA módra.

#### QSO Form Automatikus Kitöltés
A spot kattintás után a hívójel automatikusan bekerül a QSO beviteli mezőbe, és elindul a QRZ.com lekérdezés (ha be van állítva) az állomás információinak megszerzéséhez. A sáv és mód mezők is automatikusan frissülnek a spot adatai alapján, így azonnal kezdheted a QSO-t anélkül hogy manuálisan állítanád be ezeket.

#### Worked Állomás Jelzés
A rendszer automatikusan ellenőrzi hogy az adott hívójelet már dolgoztad-e korábban, és zöld kerettel jelöli ezeket a spotokat. Ez segít elkerülni a duplikált QSO-kat és gyorsan azonosítani az új állomásokat.

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

### QSO Részletek és Szerkesztés

#### QSO Detail Dialog Megnyitása
Bármelyik QSO sorra kattintva megnyílik a részletes nézet amely minden információt megjelenít az adott QSO-ról. A dialog bal oldalán látható a hívójel nagy betűkkel, az ország zászlója és az állomás neve (QRZ.com adatok alapján). A jobb oldalon táblázatos formában jelennek meg a QSO adatok: dátum/idő, sáv, mód, frekvenciák, RST jelentések és QSL státusz.

#### Állomás Információk és Térkép
A dialog alsó részében láthatók a részletes állomás adatok: ország, grid square, QTH, helyi idő és időjárás információk. Ha rendelkezésre állnak koordináták, egy beágyazott OpenStreetMap térkép mutatja az állomás pontos helyét. A térkép interaktív, nagyítható és mozgatható a jobb tájékozódás érdekében.

#### QSO Szerkesztés Módja
Az "Edit QSO" gombra kattintva átváltasz szerkesztési módba ahol minden mező módosítható. A szerkesztő form ugyanazokat a mezőket tartalmazza mint a QSO bevitel: hívójel, sáv, mód, frekvenciák, RST jelentések, dátum/idő, megjegyzések és QSL státusz. A változtatások valós időben validálódnak, hibás adatok esetén piros kerettel jelezve a problémát.

#### Mentés és Törlés
A "Save Changes" gomb elmenti a módosításokat az adatbázisba és frissíti a naplót. A "Delete QSO" gomb megerősítés után véglegesen törli a QSO-t - ez a művelet nem visszavonható! A "Cancel" gombbal eldobhatod a változtatásokat és visszatérhetsz a részletes nézethez.

#### Batch Szerkesztés Lehetőségek
A LogBook nézetben a "Batch Select" móddal több QSO-t is kiválaszthatsz egyszerre szerkesztéshez. Ez hasznos QSL státusz tömeges frissítéséhez, exportáláshoz vagy törléshez. A kiválasztott QSO-k száma megjelenik a felületen, és különböző batch műveletek érhetők el: QSL státusz változtatás, export vagy törlés.

## QSL Kártya Kezelés

### QSL Státusz Rendszer

#### Státusz Kódok és Színek
A QSL státusz egy egyszerű betűkóddal és színkódolással jelzi a QSL kártya állapotát minden QSO-nál. **N** (piros) = még nem küldött/kapott, **P** (narancs) = címke nyomtatásra vár, **L** (kék) = címke kinyomtatva, **S** (sárga) = elküldve, **R** (zöld) = megérkezett, **B** (kék) = mindkét irányban rendben, **Q** (lila) = QSL kérve. Minden státusz más színnel jelenik meg a könnyebb azonosítás érdekében.

#### Státusz Váltás Módjai
A QSL státusz mezőre bal egérgombbal kattintva előre léphetsz a státuszok között (N→P→L→S→R→B→Q→N), jobb egérgombbal pedig visszafelé. A tooltip mindig megmutatja az aktuális státusz jelentését és a használati útmutatót. Ez lehetővé teszi a gyors státusz frissítést anélkül hogy külön dialógust kellene megnyitni.

#### Automatikus Címke Generálás
Amikor a státuszt "P"-re (Print label) állítod, a rendszer automatikusan felajánlja a QSL címke PDF generálását. A program lekérdezi a QRZ.com adatbázisból a címzett adatait (név, cím) és létrehoz egy nyomtatható PDF fájlt a QSO adatokkal. A sikeres generálás után a státusz automatikusan "L"-re (Label printed) vált.

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
