# Aim Garena

Game bắn súng góc nhìn thứ nhất chạy ngay trên trình duyệt, theo phong cách CS:GO. Bạn đấu với bot trên de_dust2, Warehouse hoặc Aim Garena, kiếm lượt mở hòm qua mỗi kill rồi sưu tầm skin, dao và găng.

Dự án dùng React 19, Vite và three.js (qua `@react-three/fiber` và `drei`). Va chạm được tính trên lưới tam giác của chính map bằng `three-mesh-bvh`. Không cần server: mọi thứ chạy trên máy người chơi, kho đồ được lưu trong `localStorage`.

---

## Chạy dự án

```bash
npm install
```

```bash
npm run dev
```

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | Server dev của Vite, có HMR |
| `npm run build` | Build production ra `dist/` |
| `npm run preview` | Chạy thử bản build |
| `npm run lint` | Kiểm tra code bằng oxlint |

Deploy lên Vercel: `vercel.json` chuyển mọi đường dẫn (trừ `assets/`, `models/`, `sounds/`, `textures/`) về `index.html`, nên các URL như `/spin` và `/inventory` mở thẳng được.

---

## Chế độ chơi

### Thi đấu (Competitive)
- Map de_dust2. Hai đội T và CT, mỗi đội tối đa 5 người, bot lấp các chỗ còn trống.
- Có tiền thưởng, chuỗi thua, giờ mua đồ, đặt bom và gỡ bom theo luật CS:GO. Freeze time 10 s, mỗi round 1:55, bom nổ sau 40 s.
- Bot T chơi theo chiến thuật lấy từ playbook Dust II: Rush B, Split A/B, Long A, Mid → Short, Fake A → B. Chúng chia nhóm, chờ nhau rồi vào site cùng lúc. Bot CT giữ góc ở A, B và Mid, rồi xoay sang site đang bị dồn. Hai bên đều báo qua radio.

### Aim (1 vs bot)
- Chọn map **Warehouse** (Arena của Standoff 2) hoặc **Aim Garena** (map đối xứng dựng từ khối hộp, có tháp bắn tỉa).
- Chọn súng chính, súng lục, số bot và số round cần thắng. Mỗi round bạn có giáp đầy đủ và một quả mỗi loại lựu đạn.
- Bot không biết bạn ở đâu. Chúng chỉ đi theo những gì nhìn thấy hoặc nghe được (tiếng súng, tiếng chân chạy, bị trúng đạn). Khi không có manh mối, cả đội bot nhớ khu nào đã kiểm tra và khu nào để lâu nhất, rồi lần lượt đi lùng, ưu tiên nửa sân của bạn. Ngồi (crouch) thì không phát ra tiếng bước chân.

### Độ khó bot

| Mức | Phản xạ | Đặc điểm |
| --- | --- | --- |
| Dễ | ~1.25 s | Aim lệch nhiều, gần như không nhắm đầu, không đồng bộ đội |
| Thường | ~0.9 s | Ghìm tâm kém, ít khi dừng lại để bắn |
| Khó | ~0.45 s | Hay nhắm đầu, ghìm được nửa băng, counter-strafe, báo vị trí cho đồng đội |
| Chuyên gia | ~0.24 s | Flick nhanh, thường nhắm đầu, ghìm gần hết băng, dừng bắn chuẩn, báo vị trí cho đồng đội |

Bot nào cũng có góc nhìn và tầm nhìn giới hạn, bị khói che, bị flash làm mù, cần thời gian phản xạ, xoay người với tốc độ có giới hạn, và có sai số aim giảm dần khi bám theo mục tiêu.

**Trốn trong smoke:** bot không nhìn xuyên được smoke, và tiếng động phát ra từ trong smoke chỉ cho bot biết "đâu đó trong đó". Nếu bạn biến vào smoke, hoặc bot nghe thấy bạn trong smoke, bot sẽ đứng ngoài và xả đạn loạn xạ vào quanh chỗ nó mất dấu bạn trong vài giây, rồi canh smoke chờ bạn bước ra. Mỗi tiếng động mới từ trong smoke lại làm bot xả tiếp. Nếu bạn ở chỗ khác và smoke ở chỗ khác thì bot không bắn vào smoke.

---

## Điều khiển

| Phím | Việc |
| --- | --- |
| `W A S D` | Di chuyển |
| `Shift` / `Ctrl` / `C` | Ngồi (không phát tiếng bước chân) |
| `Space` | Nhảy |
| `Q` / `E` | Nghiêng trái / phải (tự giơ súng ngắm). Có công tắc **Nghiêng người nhắm** ở menu chính và menu tạm dừng, mặc định là tắt: khi tắt, `Q` thành đổi nhanh về vũ khí vừa dùng (như Q trong CS:GO), `E` không làm gì |
| Chuột trái | Bắn |
| Chuột phải | Ngắm / bật scope / đâm nặng bằng dao |
| `R` | Nạp đạn (khi cầm dao: múa dao) |
| `1`–`5`, lăn chuột | Đổi vũ khí |
| `X` | Quay lại vũ khí trước |
| `G` | Vứt súng |
| `F` | Nhặt súng / gỡ bom |
| `V` | Inspect |
| `B` | Mở menu mua đồ |
| `Tab` | Bảng điểm |
| `M` | Bật / tắt âm thanh |
| `Esc` | Tạm dừng (chỉnh độ nhạy chuột, âm thanh) |

Một cú click nhanh (kể cả tap trên trackpad) vẫn được tính là một phát bắn, dù chuột nhả ra trước khi frame kế tiếp kịp chạy. Click hơi sớm khi súng chưa sẵn sàng (nhịp bắn của súng lục, kéo khoá AWP) được giữ lại khoảng 0.18 s và bắn ngay khi được.

---

## Vũ khí và cơ chế bắn

- **Súng lục:** Glock-18, USP-S, P250, Desert Eagle
- **SMG:** MAC-10, MP9, UMP-45, P90
- **Rifle:** Galil AR, FAMAS, AK-47, M4A4, M4A1-S
- **Bắn tỉa:** SSG 08, AWP, G3SG1, SCAR-20
- **Lựu đạn:** HE, Flashbang, Smoke, Molotov, Incendiary
- **Khác:** dao, C4, giáp, giáp + mũ, bộ gỡ bom

Chuyển động theo đúng tham số của Source engine: ma sát, gia tốc, air-strafe, tốc độ theo từng súng, đi bộ và ngồi chậm lại, leo bậc thang theo cách StepMove của Source.

Độ giật dùng spray pattern của CS:GO (được tăng mạnh hơn bản gốc). Độ chính xác giảm khi di chuyển hoặc nhảy, và hồi lại sau mỗi lần bắn.

**Bắn xuyên vật thể:** mỗi súng có một lượng xuyên. Gỗ mỏng ít cản, tường và đá cản nhiều, kim loại gần như chặn hẳn, mặt đất chặn hoàn toàn. Sát thương giảm sau mỗi lớp xuyên qua.

**Killfeed** ghi lại vũ khí cùng các icon kiểu CS:GO:
- bắn xuyên tường (bức tường gạch có viên đạn xuyên qua)
- bắn xuyên khói (đám khói có vệt đạn cắt ngang)
- headshot

**Lựu đạn:** bay theo quỹ đạo, nảy, có thời gian kích nổ và bán kính như CS:GO.
- HE nổ ra cầu lửa, tia lửa, khói đen và vòng bụi, làm rung màn hình khi ở gần.
- Flash làm mù tuỳ hướng nhìn và khoảng cách.
- Smoke nở thành khối khói che tầm nhìn của cả người lẫn bot.
- Molotov/Incendiary tạo vùng lửa gây sát thương, và bị smoke dập tắt.

---

## Hòm, kho đồ và skin

- **Lượt quay:** mỗi kill trong trận (ở mọi chế độ) được 1 lượt mở hòm.
- **Mở hòm** (`/spin`): reel quay rồi dừng, kèm âm thanh CS:GO. Có hai nút:
  - **Mở hòm:** quay từng hòm một.
  - **Quay 10 lần liền:** trừ 10 lượt (hoặc số lượt còn lại, nếu ít hơn 10) và quay nhanh liên tiếp. Món nào rơi ra sẽ hiện vào ô của nó. Kết thúc là bảng tổng kết toàn bộ đồ nhận được, món xịn nhất đứng đầu. Nút **Bỏ qua** mở hết các hòm còn lại ngay lập tức.
- **Độ hiếm:**

  | Bậc | Tỉ lệ |
  | --- | --- |
  | Mil-Spec | 37.26% |
  | Restricted | 32% |
  | Classified | 23.74% |
  | Covert | 5% |
  | ↳ trong đó: Howl, Fire Serpent, Dragon Lore, Gungnir, Wild Lotus, Gold Arabesque | 0.03% (cả nhóm) |
  | ★ Rare Special (dao / găng) | 2% |
  | ↳ trong đó: dao Ruby, Sapphire, Emerald, Black Pearl (mọi loại dao, kể cả Doppler Ruby/Sapphire; Gamma Doppler không thuộc nhóm này), Bearbrick Cương Thi, toàn bộ găng tay | 0.03% (cả nhóm) |

  Tổng tỉ lệ của mỗi bậc không đổi: nhóm cực hiếm chỉ chiếm 0.03% bên trong bậc đó, phần còn lại chia cho các món khác. Trade Up lên bậc Covert hoặc ★ cũng dùng đúng tỉ lệ này. Contraband không bao giờ rơi từ hòm.
- **Kho đồ** (`/inventory`): xem, trang bị và gỡ skin cho từng súng, dao và găng. Trang chi tiết món đồ có pattern, Case Hardened, đá quý, v.v.
- **Trade Up** (`/tradeup`): đổi 5 món cùng bậc lấy 1 món ngẫu nhiên ở bậc kế tiếp. 5 món Covert đổi được 1 con dao. Đồ đang trang bị không bị đưa vào hợp đồng.
- **Gallery:** phòng trưng bày 3D, đi bằng WASD để ngắm bộ sưu tập.

Dao ★ chỉ có được qua hòm hoặc Trade Up. Vào trận, ai cũng cầm dao mặc định trừ khi đã trang bị dao khác.

---

## Cấu trúc thư mục

```
src/
  App.jsx            Canvas three.js, HUD, test harness khi chạy dev
  game/
    GameLoop.jsx     Vòng mô phỏng mỗi frame: input → bot → di chuyển → vũ khí → luật; đặt camera (giật, rung khi gần vụ nổ)
    state.js         Trạng thái game dùng chung và event bus (on / emit)
    input.js         Chuột và bàn phím, độ nhạy theo kiểu CS:GO
    movement.js      Di chuyển theo Source: ma sát, gia tốc, nhảy, leo bậc, thoát kẹt
    weaponLogic.js   Bắn, nạp đạn, ngắm, scope, dao, ném lựu đạn
    combat.js        Đường đạn, xuyên vật thể, hitbox, sát thương, killfeed
    grenades.js      Quỹ đạo lựu đạn, nổ, smoke, lửa, flash
    bots.js          AI bot: nhận biết, aim, chiến đấu, chiến thuật, đi lùng
    nav.js           Lưới điều hướng bake từ map, A*, vùng liên thông
    rules.js         Round, kinh tế, mua đồ, bom
    weapons.js       Thông số vũ khí
    constants.js     Hằng số Source (đổi sang mét), luật round
  world/
    level.js         Nạp map (glb hoặc dựng bằng code) và dựng BVH
    collision.js     Truy vấn va chạm: hull, mặt đất, trần, raycast
    mapData.js       Site, spawn, vị trí chiến thuật của từng map
    maps/aimArena.js Map Aim Garena dựng từ khối hộp
  view/              Nhân vật, viewmodel, hiệu ứng (tracer, khói, lửa, vụ nổ), vết đạn
  ui/                HUD, menu, mua đồ, bảng điểm, radar, hòm, kho đồ, trade up, gallery
  skins/             Danh mục skin, kho đồ, pattern, dao, găng, ảnh thumbnail
  lib/               Âm thanh, texture, animation dao, router
public/
  models/            de_dust2, Warehouse, nhân vật, dao (.glb)
  sounds/            Âm thanh mở hòm
  textures/          Ảnh skin, ảnh map
```

### Ghi chú kỹ thuật

- **Toạ độ:** de_dust2 giữ nguyên toạ độ Hammer. Mọi vị trí trong `mapData.js` là toạ độ thật của map, được đổi sang mét bằng `src()`.
- **Nav mesh:** được bake từ chính các tam giác của map lúc nạp. Mỗi ô lưới chứa tối đa 3 tầng sàn. Sau khi bake, các ô được gán nhãn vùng liên thông, để bot không chọn điểm đến mà không có đường đi tới (nóc thùng, phòng kín). Đường đi được string-pull lại và kiểm tra bằng hull thật, để bot không cạ vào góc tường.
- **Cầu thang kim loại** (Warehouse): bậc mỏng và có khe hở giữa các bậc. Vì vậy mặt đất được dò bằng nhiều điểm (dày hơn khi các điểm dò cho kết quả khác nhau). Khi bước lên bậc, game kiểm tra cả thân người ở độ cao mới, nên đầu không bị đẩy vào mép bục phía trên.
- **Bot bị kẹt:** bot đánh dấu chỗ bị kẹt, lùi lại (ngồi xuống nếu cần) rồi tìm đường vòng. Nếu vẫn không tới được thì bỏ mục tiêu đó và chọn chỗ khác.

### Test harness (chỉ khi chạy dev)

Khi chạy `npm run dev`, cửa sổ trình duyệt có sẵn các biến sau để thử nghiệm:
- `window.__game`: trạng thái game
- `window.__step(n)`: chạy thủ công `n` frame
- `window.__dev`:
  - `start(opts)`: bắt đầu trận với pointer lock giả lập
  - `gun(id)`: cầm một vũ khí
  - `freeze()`: dừng mô phỏng
  - các module `collision`, `level`, `nav`, `movement`, `loadLevel`

---

## Ghi công

- Âm thanh mở hòm: Valve / [SourceSounds](https://github.com/sourcesounds/csgo)
- Bánh xe mở hòm dựa trên plgk gift wheel. Respect to [Truanayangi](https://github.com/truanayangi-com)
- de_dust2 và cơ chế game thuộc về Valve (CS:GO). Map Warehouse lấy từ Standoff 2. Đây là dự án cá nhân, phi thương mại.
