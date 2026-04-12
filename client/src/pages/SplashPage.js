import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BlockingLoader } from "../components/LoadingState";
import { withMinimumDelay } from "../utils/loading";
import "./SplashPage.css";

const featureCards = [
  {
    title: "Skill swaps, not tutoring gigs",
    description:
      "Trade what you know for what you want to learn with classmates and peers.",
  },
  {
    title: "Smart matching",
    description:
      "Find people by category, availability, and reliability without endless searching.",
  },
  {
    title: "Built-in trust signals",
    description:
      "Profiles, ratings, and swap history help you choose the right partner faster.",
  },
];

function SplashPage() {
  const navigate = useNavigate();
  const [loadingRoute, setLoadingRoute] = useState("");

  const handleNavigate = useCallback(async (path) => {
    if (loadingRoute) {
      return;
    }

    setLoadingRoute(path);
    try {
      await withMinimumDelay(Promise.resolve(), 420);
      navigate(path);
    } finally {
      setLoadingRoute("");
    }
  }, [loadingRoute, navigate]);

  return (
    <main className="splash-page">
      {loadingRoute && <BlockingLoader message="Opening page..." />}
      <section className="splash-hero">
        <div className="splash-hero__glow splash-hero__glow--one" aria-hidden="true" />
        <div className="splash-hero__glow splash-hero__glow--two" aria-hidden="true" />

        <div className="splash-hero__content">
          <img
            className="splash-hero__logo"
            src={`${process.env.PUBLIC_URL}/skillswap-logo.png`}
            alt="SkillSwap logo"
          />
          <p className="splash-hero__kicker">SkillSwap</p>
          <h1>Trade skills. Build confidence. Grow together.</h1>
          <p className="splash-hero__subtitle">
            A focused community where students and creators exchange real skills through structured,
            two-way learning swaps.
          </p>

          <div className="splash-hero__actions">
            <button
              type="button"
              className="splash-btn splash-btn--primary"
              onClick={() => handleNavigate("/login")}
              disabled={Boolean(loadingRoute)}
            >
              Log in
            </button>
            <button
              type="button"
              className="splash-btn splash-btn--secondary"
              onClick={() => handleNavigate("/login?mode=register")}
              disabled={Boolean(loadingRoute)}
            >
              Sign up
            </button>
            <button
              type="button"
              className="splash-btn splash-btn--ghost"
              onClick={() => handleNavigate("/browse-preview")}
              disabled={Boolean(loadingRoute)}
            >
              Browse as guest
            </button>
          </div>
        </div>
      </section>

      <section className="splash-features" aria-label="SkillSwap benefits">
        {featureCards.map((card) => (
          <article key={card.title} className="splash-feature-card">
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

export default SplashPage;
