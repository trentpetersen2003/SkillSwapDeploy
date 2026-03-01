import React from "react";
import "./LoadingState.css";

export function Spinner({ size = "md" }) {
  return <span className={`vf-spinner vf-spinner--${size}`} aria-hidden="true" />;
}

export function InlineLoading({ message = "Loading..." }) {
  return (
    <div className="vf-inline-loading" role="status" aria-live="polite">
      <Spinner size="sm" />
      <span>{message}</span>
    </div>
  );
}

function LoadingState({
  message = "Loading...",
  onRetry,
  retryLabel = "Retry",
  className = "",
  compact = false,
}) {
  return (
    <div className={`vf-loading-state ${compact ? "vf-loading-state--compact" : ""} ${className}`} role="status" aria-live="polite">
      <Spinner />
      <p className="vf-loading-message">{message}</p>
      {onRetry && (
        <button type="button" className="vf-loading-retry" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function BlockingLoader({ message = "Working..." }) {
  return (
    <div className="vf-loading-overlay" role="status" aria-live="assertive" aria-busy="true">
      <div className="vf-loading-overlay-card">
        <Spinner />
        <p className="vf-loading-message">{message}</p>
      </div>
    </div>
  );
}

export default LoadingState;
