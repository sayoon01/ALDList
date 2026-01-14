import "./ToastBanner.css";

export type ToastType = "info" | "error";

export default function ToastBanner({
  message,
  type = "info",
  onClose,
}: {
  message: string | null;
  type?: ToastType;
  onClose: () => void;
}) {
  if (!message) return null;

  return (
    <div className={`toast-banner ${type}`} role="status" aria-live="polite">
      <div className="toast-banner__dot" />
      <div className="toast-banner__msg">{message}</div>
      <button className="toast-banner__btn" onClick={onClose} aria-label="닫기">
        닫기
      </button>
    </div>
  );
}
