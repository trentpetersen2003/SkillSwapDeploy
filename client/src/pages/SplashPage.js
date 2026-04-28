import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BlockingLoader } from "../components/LoadingState";
import { withMinimumDelay } from "../utils/loading";
import "./SplashPage.css";

const demoVideoUrl = "https://www.youtube.com/watch?v=6Gk4vqo1kPU";

function getYouTubeEmbedUrl(url) {
  if (!url) {
    return "";
  }

  try {
    const parsedUrl = new URL(url);
    const videoIdFromPath = parsedUrl.pathname.match(/(?:embed\/|shorts\/|watch\/|v\/)?([\w-]{11})/);
    const videoIdFromQuery = parsedUrl.searchParams.get("v");
    const videoId = videoIdFromQuery || videoIdFromPath?.[1];

    if (videoId) {
      return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
    }

    return url;
  } catch (error) {
    return url;
  }
}

const valueProps = [
  {
    title: "Match faster",
    description:
      "Browse people by what they can teach, what they want to learn, and how they prefer to meet.",
  },
  {
    title: "Trade skills both ways",
    description:
      "Set up real two-way exchanges instead of one-sided tutoring requests or scattered DMs.",
  },
  {
    title: "Stay organized",
    description:
      "Keep your conversations, requests, and planned swaps in one place so follow-through is easier.",
  },
];

const steps = [
  {
    title: "Create a profile",
    description: "Share what you can offer, what you want to learn, and when you are available.",
  },
  {
    title: "Find a match",
    description: "Browse people with compatible goals and availability instead of searching blindly.",
  },
  {
    title: "Request a swap",
    description: "Send a request, agree on a format, and turn interest into an actual session.",
  },
];

const screenshotShowcase = [
  {
    title: "Browse and match",
    description: "Search by skill, location, and compatibility to find promising swap partners.",
    image: `${process.env.PUBLIC_URL}/splash-browse.png`,
    alt: "Browse page showing search filters and user cards",
  },
  {
    title: "Chat and coordinate",
    description: "Keep conversations in one place while you plan and confirm upcoming skill swaps.",
    image: `${process.env.PUBLIC_URL}/splash-chat.png`,
    alt: "Chat page showing direct messages between SkillSwap users",
  },
  {
    title: "Track your swaps",
    description: "Use the calendar view to manage sessions, review details, and stay on schedule.",
    image: `${process.env.PUBLIC_URL}/splash-calendar.png`,
    alt: "Calendar page showing scheduled swaps and session details",
  },
];

const teamMembers = [
  { name: "Ben Wolpers" },
  { name: "Brionna Swinton" },
  { name: "Nicolas Rossetti" },
  { name: "Trent Petersen" },
];

function SplashPage() {
  const navigate = useNavigate();
  const [loadingRoute, setLoadingRoute] = useState("");
  const demoVideoEmbedUrl = getYouTubeEmbedUrl(demoVideoUrl);

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

      <section className="splash-band splash-hero" id="top">
        <header className="splash-topbar">
          <a className="splash-brand" href="#top">
            <img
              className="splash-brand__logo"
              src={`${process.env.PUBLIC_URL}/skillswap-logo.png`}
              alt="SkillSwap logo"
            />
            <span>SkillSwap</span>
          </a>

          <nav className="splash-topbar__nav" aria-label="Splash page sections">
            <a href="#how-it-works">How it works</a>
            <a href="#screenshots">Screenshots</a>
            <a href="#about">About</a>
            <a href="#github">GitHub</a>
          </nav>

          <div className="splash-topbar__actions">
            <button
              type="button"
              className="splash-btn splash-btn--ghost"
              onClick={() => handleNavigate("/login")}
              disabled={Boolean(loadingRoute)}
            >
              Log in
            </button>
            <button
              type="button"
              className="splash-btn splash-btn--primary"
              onClick={() => handleNavigate("/login?mode=register")}
              disabled={Boolean(loadingRoute)}
            >
              Sign up
            </button>
          </div>
        </header>

        <div className="splash-hero__layout">
          <div className="splash-hero__copy">
            <p className="splash-eyebrow">SkillSwap</p>
            <h1>Trade practical skills with people who want to learn what you know.</h1>
            <p className="splash-hero__subtitle">
              SkillSwap helps people connect for structured, two-way
              learning. Instead of paying for another platform or chasing cold messages, users can
              exchange knowledge directly and build confidence through real collaboration.
            </p>

            <div className="splash-hero__actions">
              <button
                type="button"
                className="splash-btn splash-btn--primary"
                onClick={() => handleNavigate("/login?mode=register")}
                disabled={Boolean(loadingRoute)}
              >
                Get started
              </button>
              <button
                type="button"
                className="splash-btn splash-btn--secondary"
                onClick={() => handleNavigate("/browse-preview")}
                disabled={Boolean(loadingRoute)}
              >
                Browse preview
              </button>
            </div>
          </div>

          <div className="splash-video" aria-label="Demo video">
            <div className="splash-video__frame">
              {demoVideoEmbedUrl ? (
                <iframe
                  className="splash-video__embed"
                  src={demoVideoEmbedUrl}
                  title="SkillSwap demo video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="splash-video__placeholder">Add a YouTube link to embed the demo video</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="splash-band splash-band--light" id="why-skillSwap">
        <div className="splash-section-heading">
          <p className="splash-eyebrow">Why use it</p>
          <h2>A focused app for finding better learning partners</h2>
          <p>
            This app is meant for people who want more than a static profile or a generic tutoring
            marketplace. SkillSwap is built around reciprocity: users teach something valuable and
            learn something valuable in return.
          </p>
        </div>

        <div className="splash-value-grid" aria-label="Why SkillSwap">
          {valueProps.map((item) => (
            <article key={item.title} className="splash-value-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="splash-band splash-band--dark" id="how-it-works">
        <div className="splash-section-heading splash-section-heading--dark">
          <p className="splash-eyebrow">How it works</p>
          <h2>From profile to completed swap</h2>
          <p>
            The core flow is simple: show your strengths, discover people with complementary goals,
            and move into an organized exchange without losing track of the conversation.
          </p>
        </div>

        <div className="splash-steps" aria-label="SkillSwap process">
          {steps.map((step, index) => (
            <article key={step.title} className="splash-step">
              <div className="splash-step__number">0{index + 1}</div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="splash-band splash-band--light" id="screenshots">
        <div className="splash-section-heading">
          <p className="splash-eyebrow">Screenshots</p>
          <h2>What the app looks like in use</h2>
          <p>
            These screenshots show the main workflows users care about most: discovering people,
            coordinating through chat, and keeping swaps organized over time.
          </p>
        </div>

        <div className="splash-shots" aria-label="App screenshots">
          {screenshotShowcase.map((shot) => (
            <figure key={shot.title} className="splash-shot-card">
              <img className="splash-shot" src={shot.image} alt={shot.alt} />
              <figcaption>
                <strong>{shot.title}</strong>
                <span>{shot.description}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="splash-band splash-band--subtle" id="about">
        <div className="splash-section-heading">
          <p className="splash-eyebrow">About</p>
          <h2>The team behind SkillSwap</h2>
          <p>
            SkillSwap was built by a four-person capstone team focused on making peer-to-peer skill
            exchange easier to discover, organize, and follow through on.
          </p>
        </div>

        <div className="splash-team" aria-label="Team members">
          {teamMembers.map((member) => (
            <article key={member.name} className="splash-team-card">
              <div className="splash-team-card__avatar" aria-hidden="true">
                {member.name.charAt(0)}
              </div>
              <div className="splash-team-card__body">
                <h3>{member.name}</h3>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="splash-band splash-band--accent" id="github">
        <div className="splash-repo">
          <div>
            <p className="splash-eyebrow">Repository</p>
            <h2>Explore the project on GitHub</h2>
            <p>
              The repository includes the codebase for the SkillSwap app and the ongoing capstone
              work behind it.
            </p>
          </div>
          <a
            className="splash-btn splash-btn--dark"
            href="https://github.com/SCCapstone/VectorForge"
            target="_blank"
            rel="noreferrer"
          >
            Open GitHub repo
          </a>
        </div>
      </section>
    </main>
  );
}

export default SplashPage;
