# LUCIFER LUA API — COMPLETE EXHAUSTIVE REFERENCE

---

## ⚠️ META-CONTEXT (Baca Ini Dulu)

### Apa Itu Lucifer API?
Lucifer adalah **multibot automation framework** untuk game Growtopia. API ini memungkinkan developer menulis script Lua yang mengontrol satu atau lebih akun bot secara otomatis untuk melakukan farming, trading, grinding, dan aktivitas lainnya di dalam game.

### Konteks Penggunaan
- **Target platform:** Windows desktop application
- **Bahasa scripting:** Lua 5.x (1-based array indexing)
- **Eksekusi:** Script berjalan di dalam konteks bot individual
- **Tujuan:** Otomatisasi gameplay (farming, trading, grinding, event participation)

### Konvensi Dokumen
1. **`bot:method()`** = method yang dipanggil dengan colon (mengirim `self` sebagai parameter pertama)
2. **`bot.property`** = property yang diakses dengan dot
3. **`R`** = Read-only (tidak bisa diubah)
4. **`R/W`** = Read-write (bisa diubah)
5. **`nil`** = Tidak ada nilai / operasi gagal / fire-and-forget
6. **Array indexing:** Lua 1-based (index pertama = 1, bukan 0)
7. **Koordinat:** `x, y` = tile coordinates (kecuali disebut "pixel")
8. **Waktu:** detik (kecuali disebut "milliseconds")

### Warning Penting
1. **Fire-and-forget:** Method seperti `bot:hit()`, `bot:place()`, `bot:warp()` return `nil`. Ini **bukan error**. Mereka mengirim request ke server tapi tidak menunggu konfirmasi. Verifikasi sukses via event atau state query setelahnya.

2. **World state volatile:** Setelah warp/reconnect, seluruh objek `World`, `Tile`, `Player` bisa di-replace. **Jangan cache** objek lama. Query ulang via `getWorld()` setelah transisi.

3. **Event callback harus ringan:** Jangan gunakan `sleep()` atau loop berat di dalam callback event. Simpan data ke variabel, proses di thread utama.

4. **Enum symbolic:** Jangan hardcode angka untuk enum. Gunakan simbol (`BotStatus.online`, bukan `1`). Nilai numerik bisa berubah antar versi.

5. **Protocol raw packets:** `bot:sendPacket()` dan `bot:sendRaw()` adalah low-level. Format tergantung versi protokol game. Malformed packet bisa disconnect bot. **Prefer typed actions** (`bot:hit`, `bot:place`) kecuali absolutely necessary.

6. **Security:** Jangan print atau expose proxy credentials, webhook URLs, atau account tokens di shared files.

### Cara Baca Dokumen Ini
- **Section 0 (Quick Start):** Contoh minimal untuk mulai
- **Section 1 (Global Functions):** Fungsi yang bisa dipanggil tanpa prefix bot
- **Section 2 (Bot Object):** Semua method dan property dari instance bot
- **Section 3 (Automation Modules):** Fitur otomatisasi built-in (auto_farm, auto_fish, dll)
- **Section 4 (Structures):** Objek data (World, Tile, Player, Inventory, dll)
- **Section 5 (Events):** Sistem event listener
- **Section 6-8 (Console, HTTP, Proxy):** Utility dan networking
- **Section 9 (Enums):** Konstanta simbolik
- **Section 10 (Troubleshooting):** Diagnosa masalah umum

### Untuk AI/LLM Parser
Jika kamu adalah AI yang membaca dokumen ini untuk membantu developer:
1. **Setiap entitas API sudah memiliki definisi eksplisit** (apa yang dilakukan, apa yang dikembalikan)
2. **Contoh kode tersedia** untuk setiap modul utama
3. **Return type selalu disebutkan** (`nil`, `boolean`, `string`, `integer`, `table`, atau objek spesifik)
4. **Side-effect dijelaskan** jika ada (misal: blocking, fire-and-forget, replace state)
5. **Jangan asumsikan** method return success/failure kecuali disebutkan eksplisit

### Version Compatibility
Dokumen ini adalah **merge dari v1.8, v2.32, v2.54.2, dan v2.86**. Baseline utama adalah v2.86. Jika script perlu kompatibel dengan versi lama, gunakan feature-check:
```lua
if bot.getSignal ~= nil then
    local signal = bot:getSignal()
    print(signal.x .. ", " .. signal.y)
end
```

---

## 0. QUICK START

```lua
local bot = getBot()
if bot == nil or not bot:isInWorld() then return end

print("Bot: " .. bot.name .. " | World: " .. bot:getWorld().name)
print("Pos: " .. bot.x .. "," .. bot.y .. " | Gems: " .. bot.gem_count)

local inv = bot:getInventory()
local dirt = inv:getItem(2)
if dirt then print("Dirt: " .. dirt.count) end
```

---

## 1. GLOBAL FUNCTIONS

### 1.1 Bot & Account Management
| API | Definisi Eksplisit | Return |
|---|---|---|
| `getBot()` | Mengambil instance bot induk yang sedang mengeksekusi script. | `Lucifer` atau `nil` |
| `getBot(name)` | Mencari instance bot berdasarkan nama GrowID (case-sensitive). | `Lucifer` atau `nil` |
| `getBot(index)` | Mencari instance bot berdasarkan urutan indeks (1-based) di daftar. | `Lucifer` atau `nil` |
| `getBots()` | Mengambil seluruh array bot yang terdaftar di aplikasi saat ini. | `table` (array of `Lucifer`) |
| `addBot(name, pass)` | Mendaftarkan akun baru ke manajer bot dengan GrowID dan password. | `Lucifer` |
| `addBot(name, pass, mac, rid)` | Mendaftarkan akun baru dengan spoofing device ID (MAC dan RID). | `Lucifer` |
| `addBot(name, pass, mac, rid, platform)` | Mendaftarkan akun baru dengan memaksa platform login tertentu. | `Lucifer` |
| `addBot(options)` | Mendaftarkan akun menggunakan tabel konfigurasi lengkap (proxy, steam, otp, dll). | `Lucifer` |
| `addTokenBot(token, proxy)` | Login menggunakan session token yang sudah ada, opsional dengan proxy. | `Lucifer` |
| `addUbiBot(email, pass, otp)` | Mendaftarkan atau login ke akun via Ubisoft Connect, opsional dengan OTP. | `Lucifer` |
| `addSteamBot(ubi_email, ubi_pass, steam_login)` | Login via Steam link dengan kredensial Ubisoft. | `Lucifer` |
| `removeBot()` | Menghapus bot yang sedang aktif (parent script) dari daftar. | `nil` |
| `removeBot(name)` | Menghapus bot spesifik berdasarkan nama dari daftar. | `nil` |
| `getUsername()` | Mengambil nama akun Lucifer (launcher) yang sedang login. | `string` |
| `getBanRate()` | Mengambil persentase atau skor tingkat ban terkini yang terdeteksi sistem. | `number` |

### 1.2 Utility & File I/O
| API | Definisi Eksplisit | Return |
|---|---|---|
| `sleep(ms)` | Menunda eksekusi script saat ini selama milidetik. Tetap responsif terhadap stop. | `nil` |
| `read(path)` | Membaca seluruh konten teks dari file di path lokal. Kosong jika gagal. | `string` |
| `write(path, content)` | Menimpa (overwrite) file di path lokal dengan konten string baru. | `boolean` |
| `append(path, content)` | Menambahkan konten string baru ke akhir file yang sudah ada di path lokal. | `boolean` |
| `removeColor(text)` | Menghapus semua kode warna format Growtopia (misal: `` `4 ``) dari string. | `string` |
| `clearConsole()` | Membersihkan seluruh teks yang tampil di panel console aplikasi. | `nil` |
| `runThread(fn, ...)` | Menjalankan fungsi Lua `fn` di thread terpisah (non-blocking), meneruskan argumen. | `nil` |

### 1.3 Item Catalog & Managers
| API | Definisi Eksplisit | Return |
|---|---|---|
| `getInfo(id_or_name)` | Mencari deskripsi item berdasarkan ID numerik atau nama string. | `ItemDescription` atau `nil` |
| `getInfos()` | Mengambil seluruh katalog item yang tersedia di database game. | `table` (array of `ItemDescription`) |
| `getProxyManager()` | Mengambil instance manajer proxy global untuk konfigurasi jaringan. | `ProxyManager` |
| `getWorldManager()` | Mengambil instance manajer dunia global untuk konfigurasi rotasi farm/storage. | `WorldManager` |
| `getSwitchManager()` | Mengambil instance manajer switch global untuk rotasi bot. | `SwitchManager` |
| `addProxy(data)` | Menambahkan string proxy ke daftar manajer proxy jika belum ada. | `nil` |
| `removeProxy(ip, port)` | Menghapus proxy dari daftar berdasarkan IP dan port. | `nil` |
| `addPack(data)` | Menambahkan definisi pack ke sistem. | `nil` |
| `removePack(data)` | Menghapus definisi pack dari sistem. | `nil` |
| `getTrashList()` | Mengambil daftar ID item global yang ditandai untuk trash. | `integer[]` |
| `setTrashList(ids)` | Mengganti daftar trash global dengan array ID baru. | `nil` |

### 1.4 Shortcut Functions (Global Access)
Fungsi shortcut yang bisa diakses langsung tanpa prefix bot:
- `getTile(x, y)`, `getTiles()`, `getTilesSafe()`
- `getObject(oid)`, `getObjects()`
- `getPlayer(name_or_netid)`, `getPlayers()`
- `getNPC(id)`, `getNPCs()`
- `getLocal()`, `hasAccess(x, y)`
- `getWorld()`, `getInventory()`, `getConsole()`, `getLog()`, `getLogin()`, `getDialog()`

---

## 2. BOT OBJECT (`Lucifer`)

### 2.1 Identity & Status (Read-Only)
| Properti | Definisi Eksplisit | Tipe |
|---|---|---|
| `name` | Nama GrowID dari bot ini. | `string` |
| `index` | Posisi urutan bot di daftar (1-based). `-1` jika tidak tersedia. | `integer` |
| `status` | Status koneksi/akun saat ini (lihat Enum `BotStatus`). | `BotStatus` |
| `custom_status` | Teks status kustom yang diatur pengguna. | `string` (R/W) |
| `google_status` | Status koneksi Google (jika terkait). | `GoogleStatus` |
| `malady` | Identifier penyakit (malady) yang sedang diderita bot. | `string` |
| `home_world` | Nama dunia yang terdeteksi sebagai dunia utama (home) bot. | `string` |
| `selected` | Apakah bot dipilih di UI. | `boolean` (R/W) |
| `x`, `y` | Koordinat tile posisi bot saat ini. `0,0` jika belum masuk dunia. | `integer` |
| `history` | Riwayat pesan generic terbaru. | `table` |
| `warp_count` | Counter jumlah warp. | `integer` (R/W) |
| `gem_count` | Jumlah total gem yang dimiliki bot saat ini. | `integer` |
| `obtained_gem_count` | Jumlah gem yang diperoleh selama run yang dilacak. | `integer` |
| `obtained_pack_count` | Jumlah pack yang diperoleh selama run yang dilacak. | `integer` |
| `pearl_count` | Jumlah pearl yang dimiliki bot. | `integer` |
| `voucher_count` | Jumlah voucher yang dimiliki bot. | `integer` |
| `level` | Level akun bot saat ini. | `integer` |
| `is_account_secured` | `true` jika akun memiliki pengaman (2FA/Email) terdeteksi. | `boolean` |
| `maximum_ping` | Ping maksimum yang dapat diterima (konfigurasi). | `number` (R/W) |

### 2.2 Writable Settings (Konfigurasi Perilaku)
*Ubah properti ini sebelum mengaktifkan fitur terkait.*
- **Reconnect:** `auto_reconnect`, `reconnect_multiplier`, `random_reconnect`, `reconnect_interval`, `min_reconnect`, `max_reconnect`, `bypass_logon`. *(Definisi: Mengatur logika otomatis menyambung ulang saat terputus).*
- **Safety:** `auto_leave_on_admin`, `auto_leave_on_mod`, `auto_ban`, `auto_stop`, `maximum_ping`. *(Definisi: Memicu aksi evasi otomatis saat kondisi berbahaya terdeteksi).*
- **World:** `leave_world_before_warp`, `legit_mode`, `auto_accept`, `auto_follow`, `anti_toxic`, `anti_fire`, `hide_gems`. *(Definisi: Mengatur perilaku bot terhadap lingkungan dunia).*
- **Inventory:** `auto_trash`, `auto_wear`, `auto_clothes`, `auto_birth`, `auto_consume`, `auto_expand_inventory`, `wear_id`, `wear_storage`, `birth_storage`, `gem_limit`, `consume_id`, `consume_interval`. *(Definisi: Mengatur manajemen inventaris otomatis).*
- **Resting:** `auto_rest_mode`, `auto_disconnect` (alias `disconnect_on_rest`), `rest_time`, `rest_interval`. *(Definisi: Mengatur siklus istirahat dan disconnect sementara).*
- **Collection:** `auto_collect`, `collect_path_check`, `collect_all`, `object_collect_delay`, `collect_range`, `ignore_gems`, `ignore_essences`. *(Definisi: Mengatur radius dan filter pengambilan item jatuh).*
- **Movement:** `move_range`, `move_x`, `move_y`, `dynamic_delay`. *(Definisi: Mengatur parameter pergerakan dan pathfinding).*
- **Special:** `auto_tutorial`, `auto_alien_scanner`, `auto_mooncake_magnificence`. *(Definisi: Mengaktifkan fitur otomatisasi event khusus).*

### 2.3 Connection & World Actions
| Method | Definisi Eksplisit | Return |
|---|---|---|
| `bot:connect()` | Memulai proses login dan koneksi bot ke server game. | `nil` |
| `bot:disconnect()` | Memutus koneksi bot dari server game secara paksa. | `nil` |
| `bot:hasToken()` | Memeriksa apakah data token login tersedia. | `boolean` |
| `bot:updateToken(token)` | Mengganti token login dengan yang baru. | `nil` |
| `bot:updateProxy(proxy)` | Mengubah proxy yang digunakan bot. | `boolean` |
| `bot:getProxy()` | Mengambil detail proxy saat ini. | proxy snapshot |
| `bot:getPing()` | Mengambil nilai ping saat ini dalam milidetik. | `integer` |
| `bot:getSignal()` | Mengambil sinyal Geiger terbaru dengan `x`, `y`, dan `type`. | `Signal` |
| `bot:getCaptcha()` | Mengambil URL captcha saat ini, atau string kosong. | `string` |
| `bot:getPlaytime()` | Mengambil nilai playtime akun. | `integer` |
| `bot:getAge()` | Mengambil nilai umur akun. | `integer` |
| `bot:getActiveTime()` | Mengambil nilai waktu aktif terformat. | `string` |
| `bot:setMac(mac)` | Memperbarui nilai MAC yang dikonfigurasi. | `nil` |
| `bot:setRid(rid)` | Memperbarui nilai RID yang dikonfigurasi. | `nil` |
| `bot:setPlatform(platform)` | Memperbarui platform login. | `nil` |
| `bot:warp(world)` | Mengirim permintaan warp ke dunia tertentu. | `nil` |
| `bot:warp(world, door)` | Mengirim permintaan warp ke dunia tertentu dan masuk via ID door. | `nil` |
| `bot:leaveWorld()` | Keluar dari dunia saat ini kembali ke lobby (START). | `nil` |
| `bot:say(text)` | Mengirim pesan teks atau command slash (`/`) ke chat dunia. | `nil` |
| `bot:respawn()` | Memaksa bot untuk respawn di spawn point dunia saat ini. | `nil` |
| `bot:enter([pass/button])` | Berinteraksi dengan door di tile bot. Opsional: kirim password atau ID button. | `nil` |
| `bot:active(x, y)` | Mengirim paket "Tile Active" ke server untuk tile koordinat tertentu. | `nil` |

### 2.4 Inventory & Tile Actions
| Method | Definisi Eksplisit | Return |
|---|---|---|
| `bot:use(id)` | Menggunakan item consumable dari inventaris berdasarkan ID item. | `nil` |
| `bot:activate(id)` | Alias dari `wear`. | `nil` |
| `bot:wear(id)` | Memakaikan (equip) item ke avatar bot berdasarkan ID item. | `nil` |
| `bot:unwear(id)` | Melepas (unequip) item dari avatar bot berdasarkan ID item. | `nil` |
| `bot:drop(id, count)` | Menjatuhkan item ke tanah melalui animasi/flow normal game. | `nil` |
| `bot:trash(id, count)` | Menghancurkan item dari inventaris melalui flow normal game. | `nil` |
| `bot:fastDrop(id, count)` | Menjatuhkan item menggunakan metode packet injection (bypass animasi). | `boolean` |
| `bot:fastTrash(id, count)` | Menghancurkan item menggunakan metode packet injection. | `boolean` |
| `bot:buy(store_id)` | Membeli item dari store berdasarkan ID store. | `nil` |
| `bot:buy(id, count, max_price)` | Membeli item dari vend lokal dengan batas harga maksimum per item. | `boolean` |
| `bot:retrieve(x, y, [count])` | Mengambil item dari storage block (Gaia/Storage Box) di koordinat tersebut. | `boolean` |
| `bot:place(x, y, id)` | Menempatkan (place) item dari inventaris ke tile kosong di koordinat tersebut. | `nil` |
| `bot:hit(x, y)` | Memukul (punch) tile di koordinat tersebut. | `nil` |
| `bot:hit(npc_id)` | Memukul entitas NPC berdasarkan ID jaringan (netid) NPC tersebut. | `nil` |
| `bot:wrench(x, y)` | Menggunakan wrench pada tile di koordinat tersebut. | `nil` |
| `bot:wrenchPlayer(net_id)` | Menggunakan wrench pada pemain lain berdasarkan netid mereka. | `nil` |
| `bot:setDirection(left)` | Menghadap kiri saat true, kanan saat false. | `nil` |
| `bot:setBubble(bubble)` | Mengubah status bubble chat. | `nil` |
| `bot:setSkin(skin_id)` | Mengubah nilai skin (1-6). | `nil` |
| `bot:setCountry(country)` | Mengubah nilai negara dua huruf. | `nil` |

### 2.5 Movement & Pathfinding
| Method | Definisi Eksplisit | Return |
|---|---|---|
| `bot:moveTo(dx, dy)` | Bergerak relatif dari posisi sekarang sebesar delta X dan delta Y tile. | `nil` |
| `bot:moveTile(x, y)` | Bergerak absolut ke koordinat tile X dan Y yang ditentukan. | `nil` |
| `bot:moveLeft([count])` | Bergerak ke kiri sebanyak `count` tile (default 1). | `nil` |
| `bot:moveRight([count])` | Bergerak ke kanan sebanyak `count` tile (default 1). | `nil` |
| `bot:moveUp([count])` | Bergerak ke atas sebanyak `count` tile (default 1). | `nil` |
| `bot:moveDown([count])` | Bergerak ke bawah sebanyak `count` tile (default 1). | `nil` |
| `bot:getPath(x, y)` | Menghitung rute pathfinding A* ke koordinat target tanpa bergerak. | `table` (array of `PathNode`) |
| `bot:findPath(x, y)` | Menghitung rute dan **secara otomatis menggerakkan** bot ke target (blocking). | `boolean` |
| `bot:findWorldPath(x, y)` | Mencari path dunia dan bergerak ke tujuan. | `boolean` |
| `bot:collectObject(oid, range)` | Mencoba mengambil objek dunia (dropped item) berdasarkan Object ID dalam radius. | `boolean` |
| `bot:collectByID(id)` | Mencari dan mencoba mengambil satu objek dengan ID item tersebut. | `boolean` |
| `bot:collect(range, [interval])` | Memindai dan mengambil semua objek jatuh dalam radius `range` dengan jeda `interval` ms. | `nil` |
| `bot:findOutput([id])` | Mencari atau mendekati lokasi output yang dikonfigurasi. | `boolean` |

### 2.6 State Checks & Access
| Method | Definisi Eksplisit | Return |
|---|---|---|
| `bot:isInWorld()` | Memeriksa apakah bot sudah sepenuhnya memuat data dunia. | `boolean` |
| `bot:isInWorld(name)` | Memeriksa apakah bot berada di dunia dengan nama persis seperti `name`. | `boolean` |
| `bot:isInTutorial()` | Memeriksa apakah dunia saat ini adalah dunia tutorial. | `boolean` |
| `bot:isInTile(x, y)` | Memeriksa apakah posisi bot saat ini persis di tile `x, y`. | `boolean` |
| `bot:isInArea(min_x, min_y, max_x, max_y)` | Memeriksa apakah posisi bot berada di dalam kotak batas yang ditentukan. | `boolean` |
| `bot:isSupporter()` | Memeriksa apakah status supporter terdeteksi. | `boolean` |
| `bot:isResting()` | Memeriksa apakah bot sedang dalam mode istirahat (AFK/disconnect sementara). | `boolean` |
| `bot:isRunningScript()` | Memeriksa apakah bot executor sedang menjalankan script. | `boolean` |

### 2.7 State Access
| Method | Return |
|---|---|
| `bot:getWorld()` | `World` |
| `bot:getInventory()` | `Inventory` |
| `bot:getConsole()` | `Console` |
| `bot:getLog()` | `Log` |
| `bot:getLogin()` | `Login` |

### 2.8 Timing & Roles
| Method | Definisi Eksplisit | Return |
|---|---|---|
| `bot:setInterval(action, sec)` | Mengatur jeda dasar (detik) untuk aksi tertentu (`Action.move`, `collect`, dll). | `nil` |
| `bot:getInterval(action)` | Mengambil nilai jeda efektif saat ini untuk aksi tertentu. | `number` |
| `bot:startRole(role)` | Memulai alur kerja otomatis berdasarkan peran (`farm`, `build`, `surg`, `fish`, `cook`, `startopia`). | `boolean` |
| `bot:stopRole()` | Menghentikan alur kerja peran yang sedang berjalan. | `nil` |
| `bot:finishRole()` | Mencoba menyelesaikan misi peran saat ini. | `boolean` |
| `bot:getRoleMission()` | Meminta misi peran saat ini. | `string` |
| `bot:runScript(source)` | Menjalankan source code Lua kustom pada bot ini. | `nil` |
| `bot:stopScript()` | Menghentikan script yang sedang berjalan pada bot ini. | `nil` |
| `bot:setPack(name)` | Memilih pack yang dikonfigurasi berdasarkan nama. | `nil` |
| `bot:getMaladyDuration()` | Mengembalikan durasi malady yang tersisa. | duration value |

### 2.9 Account Update Methods
| Method | Definisi Eksplisit | Return |
|---|---|---|
| `bot:updateBot(...)` | Memperbarui detail bot (nama, password, mac, rid, secret, hash, platform). | `nil` |
| `bot:updateCustomBot(options)` | Memperbarui bot menggunakan tabel opsi kustom. | `nil` |
| `bot:updateTokenBot(token, proxy)` | Memperbarui bot menggunakan token login. | `nil` |
| `bot:updateUbiBot(email, pass, secret, is_steam)` | Memperbarui bot Ubisoft Connect. | `nil` |

### 2.10 Advanced Protocol (WARNING)
| Method | Definisi Eksplisit | Return |
|---|---|---|
| `bot:sendPacket(type, text)` | Mengirim paket teks mentah. ⚠️ Protocol-version dependent, mudah disalahgunakan. | `nil` |
| `bot:sendRaw(packet)` | Mengirim GameUpdatePacket mentah. ⚠️ Dapat memutus koneksi jika malformed. | `nil` |

**WARNING:** Gunakan typed actions (`bot:hit`, `bot:place`, dll) daripada raw packets kecuali absolutely necessary.

---

## 3. AUTOMATION MODULES

*Akses via `bot.auto_<nama>`. Konfigurasi properti dulu, lalu set `enabled = true` atau panggil `:start()`.*

| Modul | Properti & Method Kunci (Definisi Eksplisit) |
|---|---|
| **AutoTutorial** | `enabled`, `set_high_level`, `set_random_skin`, `set_random_profile`, `detect_tutorial`, `clear_inventory`. R/O: `world`, `message`. |
| **AutoFarm** | `enabled`, `auto_place`, `auto_break`, `auto_retrieve`, `auto_remote`, `mag_x`, `mag_y`, `id`, `block_storage`, `seed_storage`. **Method:** `setActive(state)` aktifkan slot tile. |
| **AutoSpam** | `enabled`, `show_emote`, `use_color`, `random_interval`, `auto_interval`, `randomizer`, `interval`, `messages`. **Method:** `setText(idx, msg)` set teks di slot 0-3. |
| **AutoMessage** | `enabled`, `type` (0-3), `ignore_admin`, `auto_sb`, `loop_mode`, `interval`, `victim_uid`, `anti_exit`, `message`. **Method:** `load()`, `save()`, `clear()`, `start()`. |
| **AutoGeiger** | `enabled`, `use_chocolate`, `insta_path`. **Method:** `addWorld(name)`, `removeWorld(name)`, `addStorage(name)`, `removeStorage(name)`, `spread()`. |
| **AutoFish** | `enabled`, `auto_trash`, `auto_drill`, `auto_trawler`, `auto_gemonade`, `x`, `y`, `world`, `item_storage`, `reward_storage`. **Method:** `setRod(id)`, `setBait(id)`, `getRod()`, `getBait()`. |
| **AutoCook** | `is_cooking` (R/O), `x`, `y`, `interval`, `world`, `ingredient_storage`, `food_storage`. **Method:** `setActive(idx, bool)`, `setFood(idx)` (0-33), `setTemperature(level)` (0=low, 1=med, 2=high), `start()`, `stop()`. |
| **AutoCrime** | `enabled`, `auto_wave`, `auto_bbq`, `world`, `tool_storage`, `reward_storage`. **Method:** `setActive(idx, bool)` aktifkan villain ke-`idx`. |
| **AutoCarnival** | `enabled`, `auto_trash`, `auto_buy`, `selected_game`, `reward_storage`, `ticket_storage`. |
| **AutoParkour** | `enabled`, `type` (0=wolf, 1=fenrir, 2=clash), `limit`, `block`. **Method:** `setWebhook(url)`, `setTicket("NAME\|ID")`, `setReward("NAME\|ID")`. |
| **AutoSynth** | `enabled`, `x`, `y`, `world`, `tool_storage`, `reward_storage`. |
| **AutoNPC** | `enabled`, `auto_spawner`, `auto_sucker`, `collect_mode`, `spawner_limit`, `sucker_limit`, `main_world`, `item_storage`, `reward_storage`. |
| **AutoTransfer** | `enabled`, `drop_vertical`, `restock_vend`, `auto_vend`, `itemid`, `set_price`, `buy_price`, `per_item`, `input`, `output`. |
| **AutoHarvest** | `enabled`, `recycle`, `useFuel`, `storage`, `loop`. **Method:** `add(world)`, `remove(world)`, `setStorage("NAME\|ID")`. |
| **AutoPlant** | `enabled`, `storage`, `loop`. **Method:** `add(world)`, `remove(world)`, `setStorage("NAME\|ID")`. |
| **AutoEvent** | `enabled`, `storage`. |
| **AutoSkin** | `enabled`, `interval`. |
| **AutoBlarney** | `enabled`, `storage`. R/O: `index`, `state`, `console`. |
| **AutoSetPos** | `enabled`, `warp_delay`, `move_delay`, `world`. |
| **AutoClear** | `enabled`, `name_length`, `keep_jammer`, `keep_lock`, `no_number`, `output_path`, `item_storage`, `seed_storage`. |
| **AutoBuild** | `enabled`, build options, storage names, output path, selected item IDs. R/O: `console`. |
| **AutoMalady** | `enabled`, treatment options, `disconnect_interval`, `storage`, `vial`. **Method:** `addHospital(name)`, `removeHospital(name)`. |
| **AutoZombie** | `enabled`, `infect_mode`, `punch_mode`, `punch_door`, `cell_limit`, `zombie_world`, `gvirus_storage`, `reward_storage`. |
| **AutoFossil** | `enabled`, `loop_mode`, `use_rock`, `interval`, `tool_storage`, `fossil_storage`. |
| **AutoCombine** | `enabled`, `output_id`, `world`, `ingredient_storage`, `output_world`. **Method:** `setIngredient(idx, id, count)`. |
| **Rotation** | `enabled`, `status`, rest/fill/fossil/exchange options, storage suppression, break position, item IDs, custom tiles. |

---

## 4. STRUCTURES (Data Objects)

### 4.1 World
| API | Definisi Eksplisit | Return |
|---|---|---|
| `world.name` | Nama string dari dunia saat ini. | `string` |
| `world.x`, `world.y` | Lebar dan tinggi dunia dalam tile. | `integer` |
| `world.tile_count` | Jumlah total tile di dunia. | `integer` |
| `world.weather` | Identifier cuaca saat ini. | `string` |
| `world.public` | Apakah dunia bersifat publik. | `boolean` |
| `world.version` | Versi map saat ini. | `integer` |
| `world.growscan` | Agregat hitungan item dari growscan. | `Growscan` |
| `world.battle` | Status battle saat ini. | `string` |
| `world:getTile(x, y)` | Mengambil objek `Tile` pada koordinat absolut. | `Tile` atau `nil` |
| `world:getTilesSafe()` | Mengambil salinan (snapshot) aman dari seluruh array tile untuk di-loop. | `table` (array of `Tile`) |
| `world:getObject(oid)` | Mengambil objek `NetObject` berdasarkan object ID. | `NetObject` atau `nil` |
| `world:getObjects()` | Mengambil snapshot semua objek yang jatuh. | `table` (array of `NetObject`) |
| `world:getPlayer(name_or_net_id)` | Mencari objek `Player` berdasarkan nama atau netid. | `Player` atau `nil` |
| `world:getPlayers()` | Mengambil snapshot semua pemain. | `table` (array of `Player`) |
| `world:getLocal()` | Mengambil objek `Player` yang merepresentasikan bot itu sendiri. | `Player` atau `nil` |
| `world:getNPC(id)` | Mengambil objek `NPC` berdasarkan ID. | `NPC` atau `nil` |
| `world:getNPCs()` | Mengambil snapshot semua NPC. | `table` (array of `NPC`) |
| `world:getTileParent(x, y)` | Mengambil tile induk efektif. | `Tile` atau `nil` |
| `world:hasAccess(x, y)` | Memeriksa akses di tile tertentu. | access value |
| `world:isValidTile(x, y)` | Memeriksa batas tile. | `boolean` |
| `world:isValidPosition(x, y)` | Memeriksa batas posisi pixel. | `boolean` |
| `world:getAdventures()` | Mengambil marker adventure. | `table` (array of `Adventure`) |
| `world:getAdventure(id)` | Mencari marker adventure. | `Adventure` atau `nil` |
| `world:hasAdventure(id)` | Memeriksa keberadaan marker adventure. | `boolean` |

### 4.2 Tile
| API | Definisi Eksplisit | Return |
|---|---|---|
| `tile.fg` / `tile.foreground` | ID item dari foreground (lapisan depan). | `integer` |
| `tile.bg` / `tile.background` | ID item dari background (lapisan belakang). | `integer` |
| `tile.x`, `tile.y` | Koordinat tile. | `integer` |
| `tile.parent` | Indeks atau identifier tile induk. | `integer` |
| `tile.flags` | Flag tile. | `integer` |
| `tile:hasExtra()` | Memeriksa apakah metadata tambahan tersedia. | `boolean` |
| `tile:getExtra()` | Mengambil objek metadata tambahan jika `hasExtra()` adalah `true`. | `TileExtra` atau `nil` |
| `tile:canHarvest()` | Memeriksa apakah pohon/tanaman di tile ini sudah mencapai fase siap panen. | `boolean` |
| `tile:hasFlag(flag)` | Memeriksa flag tile tertentu. | `boolean` |

*Extra metadata umum:* `type`, `label`, `owner`, `locked`, `growth`, `item1`, `item2`, `item_count`, `item_price`, `fruit_count`, `flags`.

### 4.3 Player (Read-Only)
| Properti | Definisi Eksplisit |
|---|---|
| `name`, `altName`, `country` | Identitas tampilan pemain. |
| `netid`, `userid` | Identifier sesi dan pengguna unik. |
| `posx`, `posy` | Posisi pixel absolut pemain. |
| `vecx`, `vecy` | Nilai pergerakan (velocity). |
| `bubble` | Status bubble. |
| `isModerator`, `isSuperModerator` | Indikator status moderator. |
| `isLocalPlayer`, `isFriendWithOwner` | Indikator hubungan. |
| `skincolor`, `roleskin`, `roleicon` | Penampilan karakter. |
| `clothes` | Objek `Clothes` berisi ID item pakaian. |
| `team`, `battle_item`, `battle_score` | Status battle. |

### 4.4 Clothes (Read-Only)
| Properti | Definisi |
|---|---|
| `hat`, `shirt`, `pants`, `shoes` | ID item pakaian utama. |
| `face`, `hand`, `wings`, `mask` | ID item aksesoris. |
| `neck`, `ances` | ID item leher dan ancillary. |
| `unk1`, `unk2` | Nilai unknown terkait pakaian. |

### 4.5 NetObject, NPC, PathNode (Read-Only)
- **NetObject:** `id`, `x`, `y` (pixel), `count`, `flags`, `oid`.
- **NPC:** `type`, `id`, `x`, `y`, `destx`, `desty`, `var`, `unk`.
- **PathNode:** `x`, `y` (tile coords).

### 4.6 Login
| Properti | Definisi |
|---|---|
| `mac` | MAC address yang dikonfigurasi untuk bot. |
| `rid` | RID (device ID) yang dikonfigurasi untuk bot. |

### 4.7 Signal
| Properti | Definisi |
|---|---|
| `x` | Koordinat tile X dari sinyal Geiger terbaru. |
| `y` | Koordinat tile Y dari sinyal Geiger terbaru. |
| `type` | Tipe area Geiger (lihat enum `GeigerArea`). |

### 4.8 Inventory
| API | Definisi Eksplisit | Return |
|---|---|---|
| `inv.itemcount` | Jumlah slot inventaris yang saat ini terisi oleh item. | `integer` |
| `inv.emptyslots` | Slot yang tersedia. | `integer` |
| `inv.slotcount` | Kapasitas total slot. | `integer` |
| `inv.version` | Versi inventaris. | `integer` |
| `inv:getItem(id_or_name)` | Mencari objek `InventoryItem` berdasarkan ID numerik atau nama string. | `InventoryItem` atau `nil` |
| `inv:getItems()` | Mengambil snapshot semua item. | `table` (array of `InventoryItem`) |
| `inv:findItem(id_or_name)` | Menghitung total jumlah (stack) dari item tertentu di seluruh slot inventaris. | `integer` |
| `inv:getItemCount(id_or_name)` | Alias dari `findItem`. | `integer` |
| `inv:canCollect(id)` | Memeriksa apakah ada ruang kosong yang cukup untuk menampung item ID tersebut. | `boolean` |
| `inv:price()` | Mengembalikan harga upgrade inventaris berikutnya. | price value |

*InventoryItem:* R/O `id`, `count`, `isActive`.

### 4.9 ItemDescription (v2.86)
| Properti | Definisi |
|---|---|
| `id`, `name`, `desc` | Identifier dan deskripsi item. |
| `flags`, `level`, `rarity` | Metadata gameplay. |
| `growth`, `strength` | Parameter tanaman. |
| `action_type`, `collision_type`, `clothing_type` | Tipe interaksi. |
| `type`, `collision`, `clothing` | Klassifikasi item. |
| `texture`, `visual` | Data rendering. |

### 4.10 ItemInfo (v1.8 - Legacy)
| Properti | Definisi |
|---|---|
| `id`, `name` | Identifier dan nama item. |
| `editable_type`, `item_category`, `item_kind` | Klassifikasi item. |
| `action_type`, `hit_sound_type` | Tipe interaksi dan audio. |
| `collision_type`, `clothing_type` | Tipe collision dan pakaian. |
| `rarity`, `seed_color`, `seed_overlay_color` | Visual dan rarity. |
| `grow_time`, `drop_chance` | Parameter gameplay. |
| `texture`, `texture_hash`, `texture_x`, `texture_y` | Data sprite. |
| `null_Item` | True jika nama item mengandung "null". |

### 4.11 Growscan
```lua
local gs = bot:getWorld().growscan
for id, count in pairs(gs:getObjects()) do
    print(getInfo(id).name .. ": x" .. count)
end
```
**Methods:** `getTiles()` → `map<id, count>`, `getObjects()` → `map<id, count>`.

### 4.12 Vector2 & Vector3
- **Vector2:** `x`, `y` (posisi 2D).
- **Vector3:** `x`, `y`, `z` (posisi 3D).

### 4.13 GameUpdatePacket
| Properti | Definisi |
|---|---|
| `type`, `object_type` | Tipe paket dan perubahan objek. |
| `count1`, `count2` | Variabel count untuk paket tertentu. |
| `netid`, `item` | Network ID dan item yang diupdate. |
| `flags` | Flag paket. |
| `float_var`, `int_data` | Variabel numerik. |
| `vec_x`/`pos_x`, `vec_y`/`pos_y` | Posisi komponen. |
| `vec2_x`/`pos2_x`, `vec2_y`/`pos2_y` | Velocity komponen. |
| `particle_rotation` | Rotasi partikel. |
| `int_x`, `int_y` | Variabel integer (misal: tile position). |

### 4.14 variant & variantlist
```lua
local v = variant.new()
v:set(5)
print(v:getInt())

local vl = variantlist.new()
vl:get(4):set("nuron")
print(vl:get(4):getString())
```
**variant Methods:** `getType()`, `print()`, `set(...)`, `reset()`, `getString()`, `getInt()`, `getFloat()`, `getVector2()`, `getVector3()`.  
**variantlist Methods:** `get(index)`, `print()`.

### 4.15 RTVAR & RTParam
```lua
local r = RTVAR.new()
r:append("action", "dialog_return", false)
r:append("dialog_name", "nuron", false)
r:append("x", 36, true)
print(r:dump())
```
**RTVAR Methods:** `new()`, `new(str)`, `params()`, `append(k,v,sep)`, `contains(k)`, `dump()`, `erase(k)`, `find(k)`, `get(k)`, `getInt(k)`, `getLong(k)`, `getParam(k)`, `getParams(k)`, `modify(k,params,sep)`, `parse(str)`, `size()`.

**RTParam Properties:** `parameters` (table), `key` (string), `has_seperator` (boolean).

---

## 5. EVENTS (Sistem Event)

| API | Definisi Eksplisit | Return |
|---|---|---|
| `addEvent(type, fn)` | Mendaftarkan fungsi callback `fn` untuk dipanggil saat event `type` terjadi. | `nil` |
| `listenEvents(seconds)` | **Blocking.** Membekukan eksekusi script utama untuk memproses antrian event selama `seconds`. | `nil` |
| `unlistenEvents()` | Meminta listener yang sedang berjalan untuk berhenti segera (biasanya dipanggil di dalam callback). | `nil` |
| `removeEvent(type)` | Mencabut pendaftaran semua callback yang terkait dengan `type` event tertentu. | `nil` |
| `removeEvents()` | Membersihkan seluruh pendaftaran event dari memori (reset total). | `nil` |

**Event callback arguments:**
| Event | Callback |
|---|---|
| `Event.variantlist` | `function(values, net_id)` |
| `Event.update_packet` | `function(packet)` |
| `Event.track_packet` | `function(text)` |
| `Event.generic_text` | `function(text)` |
| `Event.game_message` | `function(text)` |
| `Event.mod_enter` | `function(text)` |
| `Event.got_punched` | `function(text)` |
| `Event.render` | `function()` |

*Catatan Kritis:* Callback event harus dieksekusi secepat mungkin. Jangan gunakan `sleep()` atau loop berat di dalam callback. Simpan data ke variabel, lalu proses di thread utama.

---

## 6. CONSOLE, LOG, DIALOG

### 6.1 Console & Log
| Object | Members |
|---|---|
| `Console` | `enabled`, `contents` (table), `append(text)`, `clear()` |
| `Log` | `content` (string), `append(text)`, `clear()` |

### 6.2 Dialog
| Method | Definisi |
|---|---|
| `dialog:get()` | Mengembalikan dialog yang sedang di-parse. |
| `dialog:clear()` | Membersihkan state dialog saat ini. |
| `dialog:getCustom()` | Mengembalikan hasil custom-dialog terbaru. |
| `dialog:setCustom(builder)` | Menampilkan custom dialog. |

`dialog.active` mengontrol apakah dialog normal ditampilkan.

**DialogBuilder:** `clear()`, `setTitle(text)`, `addLabel(text)`, `addButton(name, label)`, `addCheckbox(name, label[, default])`, `addInput(name, label[, default])`.

---

## 7. HTTP & WEBHOOK

### 7.1 HttpClient
```lua
local client = HttpClient.new()
client.url = "https://example.invalid/status"
client:setMethod(Method.get)
client.timeout = 10
local result = client:request()
if result.error == 0 then
    print("HTTP " .. result.status)
end
```
**Props (writable):** `content`, `method`, `headers`, `url`, `timeout`.  
**Methods:** `setMethod(method)`, `setProxy(type, ...)`, `removeProxy()`, `request()`.  
**Result (R/O):** `body`, `error`, `status`, `getError()`.

**Available methods:** `Method.get`, `post`, `put`, `patch`, `delete`, `head`.  
**Proxy kinds:** `Proxy.none`, `http`, `https`, `socks5`.

### 7.2 Webhook
```lua
local hook = Webhook.new("https://example.invalid/webhook")
hook.username = "Lucifer"
hook.content = "Script completed"
hook:send()
```
**Props:** `url`, `message_id`, `content`, `username`, `avatar_url`, `embed1`, `embed2`.  
**Methods:** `makeContent()`, `send()`, `edit(message_id)`.

**Embed props:** `use`, `color`, `title`, `type`, `description`, `url`, `thumbnail`, `timestamp`, `image`, `footer` (`text`, `icon_url`), `author` (`name`, `url`, `icon_url`).  
**Embed methods:** `addField(name, value, inline)`.

### 7.3 HttpServer (main context only)
**Methods:** `get`, `post`, `put`, `delete`, `patch`, `setLogger`, `listen(ip, port)`.  
**Request:** `getHeader(name)`, `getParam(name)`.  
**Response:** `status`, `body`, `setContent(body, content_type)`.

---

## 8. PROXY & SWITCH MANAGER

### 8.1 ProxyManager
```lua
local manager = getProxyManager()
manager:addProxy("127.0.0.1", 1080, "user", "pass")
manager:setLimit(3)
manager.spread = true
manager.localize = true
```
**Props:** `proxies`, `spread`, `localize`, `auto_switch`, `auto_check`, `switch_on_shadow`, `switch_on_ban`, `switch_on_block`, `cooldown`, `bypass_cooldown`, `timeout`, `main_ip_reference` (R/O).  
**Methods:** `addProxy`, `removeProxy`, `setLimit`.

**Proxy snapshot (R/O):** `ip`, `port`, `username`, `password`.  
**Managed proxy extra:** `cooldown`, `country`, `reference`, `selected`, `setCooldown()`, `removeCooldown()`, `hasCooldown()`.

### 8.2 SwitchManager
**Methods:** `addBot(name)`, `removeBot([name])`, `switch()`, `exists(name)`.  
**Settings:** auto switch triggers, rest behavior, loop mode, limits, storage, `drop_on_switch`.

---

## 9. ENUMS (Konstanta Simbolik)

*Jangan gunakan angka mentah. Gunakan simbol ini agar script tahan terhadap perubahan internal versi.*

| Enum | Values |
|---|---|
| `Platform` | `windows`, `android`, `macos`, `ios`, `ubiconnect`, `steam`, `apple` |
| `Bubble` | `none`, `talk`, `brb` |
| `Role` | `farm`, `build`, `surg`, `fish`, `cook`, `startopia` |
| `Action` | `move`, `collect`, `hit`, `place`, `harvest`, `plant`, `warp`, `drop`, `trash` |
| `GeigerArea` | `null`, `red`, `yellow`, `green`, `rapid`, `prize` |
| `StorageType` | `pack`, `seed` |
| `Method` | `get`, `post`, `put`, `patch`, `delete`, `head` |
| `Proxy` | `none`, `http`, `https`, `socks5` |
| `Event` | `variantlist`, `update_packet`, `track_packet`, `generic_text`, `game_message`, `mod_enter`, `got_punched`, `render` |
| `VariantType` | `float`, `int32`, `uint32`, `string`, `unused`, `vector2`, `vector3`, `component`, `entity` |

### BotStatus
**Normal:** `offline`, `online`, `getting_server_data`, `retrieving_token`, `changing_subserver`, `captcha_requested`, `stopped`.  
**Failure:** `wrong_password`, `account_banned`, `account_suspended`, `location_banned`, `version_update`, `advanced_account_protection`, `server_overload`, `too_many_login`, `maintenance`, `server_busy`, `guest_limit`, `ubi_disabled`, `account_restricted`, `network_restricted`, `http_block`, `bad_name_length`, `invalid_account`, `error_connecting`, `logon_fail`, `could_not_warp`, `bad_inventory`, `bad_gateway`, `server_issue`, `two_factor`, `google_logon_fail`, `steam_logon_fail`, `steam_not_linked`, `failed_captcha`, `banwave_detected`, `sms_error`.  
**Info:** `mod_entered`, `player_entered`, `high_load`, `high_ping`, `bypassing_server_data`, `linking_steam`, `solving_captcha`.

### CaptchaStatus
`no_captcha`, `not_found`, `solved`, `solving`, `wrong`, `failed`, `no_access`, `invalid_key`, `invalid_token`.

### GoogleStatus
`idle`, `processing`, `bad_server`, `bad_connection`, `invalid_key`, `missing_server`, `missing_local_server`, `timeout`, `driver_closed`, `init_error`, `invalid_credentials`, `invalid_secret`, `account_disabled`, `captcha_required`, `phone_required`, `recovery_required`, `otp_required`, `invalid_challenge`, `couldnt_verify`, `unknown_url`, `redirect`.

### Empty Enums (Declared but no values documented)
- `PlayerState`
- `TileType`
- `TileFlag`
- `NpcType`

---

## 10. TROUBLESHOOTING (Diagnosa Eksekusi)

| Gejala | Penyebab Akar | Solusi Eksekusi |
|---|---|---|
| Lookup return `nil` | Objek (bot, tile, player) tidak ada di snapshot memori saat ini. | Selalu bungkus akses properti dengan `if obj ~= nil then`. |
| Data dunia berubah tiba-tiba | Terjadi warp, reconnect, atau map reload yang mengganti seluruh objek `World`. | Jangan cache objek `Tile` atau `Player` lama. Query ulang via `getWorld()` setelah warp. |
| Action return `nil` | Normal. Method aksi (seperti `bot:hit`) adalah *fire-and-forget*. | Jangan andalkan return value untuk sukses. Gunakan `Event.update_packet` atau cek state tile setelahnya. |
| Event tidak terpicu | `listenEvents()` dipanggil sebelum `addEvent()`, atau durasi listen habis. | Pastikan urutan: 1. `addEvent`, 2. `listenEvents`. Gunakan loop `while` jika perlu listen terus-menerus. |
| Script tidak stop segera | Callback blocking atau long-running menunda shutdown kooperatif. | Keep callback pendek, gunakan bounded operations. |

### Compatibility check
```lua
if bot.getSignal ~= nil then
    local s = bot:getSignal()
    print(s.x, s.y)
end
```

---

# 11. PRACTICAL SCRIPT PATTERNS — USER-SUPPLIED LUCIFER v2.86/v2.87 EXAMPLES

This section distills patterns from seven user-supplied scripts. These are implementation examples, not proof that every line is correct or compatible. The API reference above remains authoritative. Before generating code, verify each method/property against the relevant API section and preserve the target version stated by the user. Do not copy webhook URLs, credentials, private identifiers, or hardcoded personal configuration from examples.

## 11.1 Safe Item Catalog Cache

A script may build a lookup cache once with `getInfos()`, then use `getInfo(id)` as a fallback:

```lua
local ITEM_CACHE = {}

local ok, infos = pcall(getInfos)
if ok and type(infos) == "table" then
    for _, info in pairs(infos) do
        local id = tonumber(info.id)
        if id and info.name and info.name ~= "" then
            ITEM_CACHE[id] = info.name
        end
    end
end

local function getItemName(id)
    id = tonumber(id)
    if not id then return "Unknown" end
    if ITEM_CACHE[id] then return ITEM_CACHE[id] end
    local okInfo, info = pcall(getInfo, id)
    if okInfo and info and info.name and info.name ~= "" then
        ITEM_CACHE[id] = info.name
        return info.name
    end
    return "ID_" .. tostring(id)
end
```

Use numeric IDs consistently as cache keys. Catalog data may be unavailable; always provide a readable fallback.

## 11.2 World Scan Data Pipeline

A reusable scanner should separate collection from reporting:
1. Validate bot and connection state.
2. Leave the previous world if needed, request warp, and wait with a bounded timeout.
3. After warp, fetch a fresh world object with `bot:getWorld()`; do not reuse a World snapshot from before warp/reconnect.
4. Read tile data using `world:getTilesSafe()`; count foreground and background separately when the task requires it.
5. Read dropped objects using `world:getObjects()`; aggregate by item ID and count.
6. Return a structured table (world name, tile counts, floating counts, optional tile coordinates, lock metadata).
7. Keep filtering, sorting, webhook formatting, and output outside the scanner.

A growscan API may be used when documented and available, with safe tile/object enumeration as fallback. Treat an empty result separately from a failed read; do not silently report an API error as a genuinely empty world.

## 11.3 Warp, Door, and Reconnect State

Examples use `bot:warp(world)` or `bot:warp(world, door)`, followed by bounded polling of `bot:isInWorld(world)`. A robust flow:
- Check `bot.status` against symbolic `BotStatus` values.
- Use a finite retry count and timeout; never wait forever for a warp.
- After reconnect or warp, reacquire `bot:getWorld()`, local player/tile, and inventory snapshots as needed.
- Validate that the bot is actually in the intended world before acting.
- A door tile check such as foreground ID 6 is an example-specific heuristic, not a universal proof of successful entry.
- Return an explicit boolean/result object from helper functions and let the caller decide whether to retry, abort, or report failure.

Avoid global cached `world` and `inventory` references across transitions. Prefer small accessors that reacquire current state.

## 11.4 Inventory and Dropped-Object Accounting

Common pattern:
- `bot:getInventory()` returns an inventory object; use `inventory:getItemCount(itemId)` for counts.
- `world:getObjects()` returns dropped objects; aggregate `obj.count` by `obj.id`.
- Object pixel coordinates can be converted to tile coordinates with `math.floor(obj.x / 32)` and `math.floor(obj.y / 32)` when the API's object coordinates are pixels.
- Before drop/trash/wear/collect actions, validate item ID and positive count.
- Keep collection toggles and inventory actions explicit; restore settings if a helper temporarily changes them.

Do not assume `getObjects()` is a global function in every context when the documented world method `world:getObjects()` is available.

## 11.5 HTTP Client and Webhook Reporting

The examples demonstrate the following API shape; verify the HTTP section of this reference for exact response fields:
- `HttpClient.new()`
- `client.url = url`
- `client:setMethod(Method.get|Method.post|Method.patch)`
- `client.headers = { ["Content-Type"] = "application/json" }`
- `client.content = body`
- `client.timeout = seconds` where supported
- `client:request()`

Use `pcall()`, inspect the returned error/status/body fields, and handle non-2xx responses explicitly. Encode JSON with a real JSON encoder if one is documented; if manual encoding is unavoidable, escape backslashes, quotes, and control characters. Respect the destination service's documented rate limits.

Webhook examples also use `Webhook.new(url)`, `hook:send()`, `hook:edit()`, embed title/description/color, and `hook.embed1:addField(...)`. Message editing requires a valid message ID. Persist only the message ID in a local state file; never persist or commit the webhook URL. If the message was deleted (404), clear the stored ID before creating a replacement. Treat 429 as rate limiting and wait according to the service's response guidance. Never assume an edit succeeded solely because `pcall` did not throw; inspect the response when available.

## 11.6 Event Listener and Chat Parsing

The supplied event example uses:
```lua
local function on_variantlist(varlist, netid)
    if not varlist then return end
    local head = varlist:get(0)
    if not head or head:getType() ~= VariantType.string then return end
    local eventName = head:getString()
    -- Keep callback work short; pass parsed data to the main loop/thread.
end

addEvent(Event.variantlist, on_variantlist)
while true do
    listenEvents(1.0)
end
```

Use the documented event names and variant types. Event callbacks should validate every optional element before reading it and remain lightweight; do not perform long loops, repeated warps, or long sleeps inside callbacks. Remove listeners during cleanup with the documented event-removal API. Treat chat text as untrusted input; parse commands with explicit allowlists and verify the sender identity/permissions before acting.

## 11.7 Threads and Multi-World Auto-Transfer

The examples demonstrate:
- `runThread(worker, ...)` for an independent worker.
- `bot.auto_transfer.enabled`, `input`, `output`, and `itemid` for configuring the documented auto-transfer module.
- A list of world targets parsed from `WORLD|DOORID` or `WORLD:DOORID`.
- Index-based iteration over item IDs and world targets.
- `bot:getLog():append(message)` for application log output.

Before enabling a worker, validate its inputs and define how it stops. Avoid two threads mutating the same bot settings without coordination. Disable auto-transfer and stop worker loops during cleanup. Do not assume undocumented property names or that changing `input` immediately completes a transfer.

## 11.8 PNB / Reconnect Automation Architecture

The PNB example illustrates a large workflow split into helpers: join/reconnect, position lookup, tile checks, break/place, inventory retrieval, machine retrieval, drop/storage, trash, and main loop. For new code:
- Keep configuration together and validate world names, door IDs, item IDs, counts, and mode strings at startup.
- Prefer local variables over shared globals.
- Factor repeated tile operations into one helper parameterized by coordinates.
- Check tile/world/inventory objects for nil before indexing.
- Reacquire the current world after every warp/reconnect.
- Bound every retry loop and provide a stop condition.
- Check inventory changes after retrieval instead of assuming packet submission succeeded.
- Avoid unnecessary raw packets when a typed API method exists in the reference.
- Keep multi-bot coordination deterministic; sort names only if stable ordering is required, and handle a missing bot explicitly.
- Ensure cleanup restores auto_collect/auto_transfer and other temporary settings.

The user-supplied PNB listing is a reference for architecture only; its many globals and state assumptions should not be copied as-is.

## 11.9 Pack and Item Dataset Parsing

A pack catalog record may have the shape:
`Display Name : pack_name : gem_price : item_id,item_id,...`

Parse each record into a structured table with fields `display_name`, `pack_name`, `gem_price`, and `item_ids`. Validate numeric prices and each item ID. Some supplied records contain malformed or placeholder values (for example `nul`), so preserve the raw record and flag invalid tokens instead of silently converting them to zero. Treat this dataset as user-supplied reference data, not an authoritative live game catalog; item IDs and prices may change.

## 11.10 Reliability Checklist for Complete Scripts

Before presenting a full script:
1. State the target Lucifer API version.
2. Confirm every nontrivial API/property against this reference.
3. Declare configuration and validate required values.
4. Check bot, world, inventory, tile, and object values for nil.
5. Use bounded waits/retries and symbolic status enums.
6. Refresh world-dependent objects after transitions.
7. Keep event callbacks short and coordinate thread state safely.
8. Handle API/network errors and distinguish empty data from failed reads.
9. Include a clear stop condition and cleanup path.
10. Never include real webhook URLs, passwords, tokens, or private credentials.
11. Label any unverified behavior honestly; do not claim runtime testing unless performed.

