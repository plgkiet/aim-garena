/**
 * Quản lý giao diện sáng/tối.
 *
 * Bảng màu nằm trong global.css dưới dạng CSS variable, không đặt trong JS:
 * đổi theme chỉ là gắn thuộc tính data-theme lên <html>, trình duyệt tự tính lại
 * toàn bộ. Cách này tránh phải ghi mấy chục inline style mỗi lần đổi, và giữ
 * màu ở cùng một chỗ với phần còn lại của stylesheet.
 */
export const THEMES = { DARK: 'dark', LIGHT: 'light' }

export const STORAGE_KEY = 'aimgarena.theme'

export const normalizeTheme = (value) =>
  value === THEMES.LIGHT ? THEMES.LIGHT : THEMES.DARK

/**
 * Đọc lựa chọn đã lưu; chưa chọn lần nào thì mặc định nền tối.
 *
 * Cố ý không theo cài đặt hệ điều hành: bản tối là giao diện chính của shop,
 * ảnh nền hero và mấy vòng sáng quanh model đều dựng theo nó.
 */
export function readStoredTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return normalizeTheme(saved)
  } catch { /* trình duyệt chặn localStorage */ }

  return THEMES.DARK
}

export function applyTheme(theme) {
  const value = normalizeTheme(theme)
  const root = document.documentElement
  root.setAttribute('data-theme', value)
  root.style.colorScheme = value
  return value
}
