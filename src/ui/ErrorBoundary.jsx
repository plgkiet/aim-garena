import { Component } from "react";

/* A crash anywhere below shows this instead of a blank white page: what went
   wrong (also logged to the console) and a button to reload. In the 3D scene
   `fallback={null}` keeps the HUD alive while the part that failed drops out. */
export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[${this.props.name || "app"}] crashed:`, error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return (
      <div className="crash">
        <div className="crash__box">
          <h2>Game gặp lỗi</h2>
          <p>{String(this.state.error?.message || this.state.error)}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Tải lại trang
          </button>
        </div>
      </div>
    );
  }
}
