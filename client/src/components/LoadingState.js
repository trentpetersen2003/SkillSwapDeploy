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

// Run loading state logic.
function LoadingState({
  message = "Loading...",
  onRetry,
  retryLabel = "Retry",
  onSecondary,
  secondaryLabel = "Back",
  className = "",
  compact = false,
}) {
  return (
    <div className={`vf-loading-state ${compact ? "vf-loading-state--compact" : ""} ${className}`} role="status" aria-live="polite">
      <Spinner />
      <p className="vf-loading-message">{message}</p>
      {(onRetry || onSecondary) && (
        <div className="vf-loading-actions">
          {onRetry && (
            <button type="button" className="vf-loading-retry" onClick={onRetry}>
              {retryLabel}
            </button>
          )}
          {onSecondary && (
            <button type="button" className="vf-loading-secondary" onClick={onSecondary}>
              {secondaryLabel}
            </button>
          )}
        </div>
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
