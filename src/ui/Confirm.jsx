import { useEffect, useRef } from "react";

/* A confirmation dialog in the game's own look, in place of the browser's
   confirm(): a dimmed, blurred backdrop, a card with a warning mark, and
   Huỷ / confirm. Esc or a click outside cancels; Enter confirms. */
export function Confirm({
  title,
  message,
  confirmLabel = "Xác nhận",
  cancelLabel = "Huỷ",
  danger = false,
  onConfirm,
  onCancel,
}) {
  const ok = useRef(null);
  useEffect(() => {
    ok.current?.focus();
    const key = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onCancel]);

  return (
    <div className="confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={onCancel}>
      <div className={`confirm__card${danger ? " is-danger" : ""}`} onClick={(e) => e.stopPropagation()}>
        <span className="confirm__mark" aria-hidden="true">!</span>
        <h2 id="confirm-title">{title}</h2>
        {message && <p>{message}</p>}
        <div className="confirm__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={ok}
            type="button"
            className={`btn ${danger ? "btn--danger" : "btn--primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
