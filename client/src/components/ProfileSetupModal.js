import React from "react";
import "./ProfileSetupModal.css";

function ProfileSetupModal({
  open,
  title,
  description,
  hint = "",
  primaryLabel,
  secondaryLabel = "",
  onPrimary,
  onSecondary,
  primaryVariant = "primary",
  secondaryVariant = "secondary",
  closeLabel = "Close",
  onClose,
  children = null,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="profile-setup-modal__overlay" role="presentation">
      <div
        className="profile-setup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-setup-modal-title"
        aria-describedby="profile-setup-modal-description"
      >
        {onClose && (
          <button
            type="button"
            className="profile-setup-modal__close"
            onClick={onClose}
            aria-label={closeLabel}
          >
            x
          </button>
        )}

        <div className="profile-setup-modal__eyebrow">SkillSwap</div>
        <h2 id="profile-setup-modal-title" className="profile-setup-modal__title">
          {title}
        </h2>
        <p
          id="profile-setup-modal-description"
          className="profile-setup-modal__description"
        >
          {description}
        </p>

        {hint ? <p className="profile-setup-modal__hint">{hint}</p> : null}
        {children ? <div className="profile-setup-modal__body">{children}</div> : null}

        <div className="profile-setup-modal__actions">
          {secondaryLabel ? (
            <button
              type="button"
              className={`profile-setup-modal__button profile-setup-modal__button--${secondaryVariant}`}
              onClick={onSecondary}
            >
              {secondaryLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={`profile-setup-modal__button profile-setup-modal__button--${primaryVariant}`}
            onClick={onPrimary}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfileSetupModal;
