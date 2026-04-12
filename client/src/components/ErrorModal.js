import React from "react";
import "./ErrorModal.css";

/**
 * ErrorModal Component
 * Displays user-friendly error messages with contextual guidance
 * instead of using browser alert()
 * 
 * Props:
 *   - title: Main error title
 *   - message: Detailed error message
 *   - actionText: Optional text for action button (default: "Dismiss")
 *   - onClose: Callback when modal is dismissed
 *   - onRetry: Optional callback for retry action
 */
function ErrorModal({ title, message, actionText = "Dismiss", onClose, onRetry }) {
  return (
    <div className="error-modal-overlay">
      <div className="error-modal">
        <div className="error-modal__header">
          <h2 className="error-modal__title">{title}</h2>
          <button
            className="error-modal__close-btn"
            onClick={onClose}
            aria-label="Close error modal"
          >
            ✕
          </button>
        </div>

        <div className="error-modal__content">
          <p className="error-modal__message">{message}</p>
        </div>

        <div className="error-modal__footer">
          {onRetry && (
            <button
              className="error-modal__btn error-modal__btn--retry"
              onClick={onRetry}
            >
              Try Again
            </button>
          )}
          <button
            className="error-modal__btn error-modal__btn--dismiss"
            onClick={onClose}
          >
            {actionText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ErrorModal;
