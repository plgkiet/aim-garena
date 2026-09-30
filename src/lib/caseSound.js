/**
 * Tiếng động cho vòng quay.
 *
 * Phát bằng Web Audio với buffer giải mã sẵn chứ không dùng thẻ <audio>: tiếng
 * gõ nổ ra liên tục mấy chục lần trong một lượt quay, thẻ <audio> sẽ cắt tiếng
 * cũ mỗi lần gọi lại và trễ nhịp thấy rõ.
 *
 * Trình duyệt chặn phát tiếng khi chưa có thao tác người dùng, nên AudioContext
 * chỉ được tạo trong `unlock()` — phải gọi thẳng từ handler của nút bấm.
 */

const FILES = {
  tick: 'csgo_ui_crate_item_scroll',
  open: 'csgo_ui_crate_open',
  reveal3: 'item_reveal3_rare',
  reveal4: 'item_reveal4_mythical',
  reveal5: 'item_reveal5_legendary',
  reveal6: 'item_reveal6_ancient',
}

// Bậc càng hiếm thì tiếng càng hoành tráng; Covert và dao dùng chung tiếng to nhất.
const REVEAL_BY_TIER = {
  milspec: 'reveal3',
  restricted: 'reveal4',
  classified: 'reveal5',
  covert: 'reveal6',
  gold: 'reveal6',
}

let ctx = null
let master = null
const buffers = new Map()
const pending = new Map()

function ensure() {
  if (ctx) return ctx
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null

  ctx = new Ctor()
  master = ctx.createGain()
  master.gain.value = 0.65
  master.connect(ctx.destination)
  return ctx
}

function load(key) {
  const ac = ctx
  if (!ac || buffers.has(key)) return Promise.resolve()

  let job = pending.get(key)
  if (!job) {
    job = fetch(`/sounds/${FILES[key]}.mp3`)
      .then((r) => {
        if (!r.ok) throw new Error(`Không tải được ${key}`)
        return r.arrayBuffer()
      })
      .then((data) => ac.decodeAudioData(data))
      .then((buf) => {
        buffers.set(key, buf)
      })
      .finally(() => pending.delete(key))
      .catch(() => {}) // thiếu tiếng thì vòng quay vẫn phải chạy
    pending.set(key, job)
  }
  return job
}

/**
 * Gọi thẳng trong sự kiện click, trước mọi await — Safari chỉ mở tiếng cho
 * AudioContext được tạo bên trong một thao tác thật của người dùng.
 */
export function unlock() {
  const ac = ensure()
  if (!ac) return
  if (ac.state === 'suspended') ac.resume()

  // Một xung im lặng để iOS thật sự chuyển kênh âm thanh sang phát nhạc.
  const pulse = ac.createBufferSource()
  pulse.buffer = ac.createBuffer(1, 1, ac.sampleRate)
  pulse.connect(master)
  pulse.start()

  Object.keys(FILES).forEach(load)
}

function play(key, volume = 1) {
  const ac = ctx
  if (!ac) return

  const buf = buffers.get(key)
  if (!buf) {
    // Tiếng gõ mà chưa kịp giải mã thì bỏ luôn, không xếp hàng — vài chục
    // tiếng dồn lại phát một lúc còn tệ hơn là im.
    if (key !== 'tick') load(key).then(() => buffers.has(key) && play(key, volume))
    return
  }

  const src = ac.createBufferSource()
  src.buffer = buf

  const gain = ac.createGain()
  gain.gain.value = volume

  src.connect(gain).connect(master)
  src.onended = () => src.disconnect()
  src.start()
}

/** Tiếng gõ, phát mỗi khi một ô quà chạy qua vạch giữa. */
export const playTick = () => play('tick', 0.9)

/** Tiếng mở hòm, phát ngay lúc bấm nút. */
export const playOpen = () => play('open')

/** Tiếng báo kết quả, chọn theo bậc độ hiếm của phần quà. */
export const playReveal = (tier = 'milspec') =>
  play(REVEAL_BY_TIER[tier] || REVEAL_BY_TIER.milspec)
