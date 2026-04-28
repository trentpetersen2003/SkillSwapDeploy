# SkillSwap RC1

SkillSwap RC1 is the release candidate for a community-driven web app where users can trade skills with each other  
(e.g., “I can teach guitar if you help me learn Spanish”).  

This README reflects the RC1 release scope and local development workflow.

RC1 includes the following implemented functionality:

- User registration and login (JWT auth)
- Password reset flow (forgot password + reset token)
- Profile and settings management (username, password, location visibility, notifications)
- Browse and For You recommendations with skill details
- Swap request creation and calendar management
- Direct messaging with conversation threads
- User blocking (blocked users are hidden from browse/recommendations/chat)

This README is for developers who want to run the project locally.

---

## Requirements

Install:

- Node.js (includes npm): https://nodejs.org/
- Git: https://git-scm.com/
- A MongoDB database (local or MongoDB Atlas): https://www.mongodb.com/

---

## Setup

Clone the repo:

```bash
git clone https://github.com/SCCapstone/VectorForge.git
cd VectorForge
```

Install dependencies:

```bash
cd client
npm install

cd ../server
npm install
```

Note: Folder structure may change as we build more features.

## Running

Run the backend API:
```bash
cd server
npm start
```

Run the frontend application:
```bash
cd client
npm start
```

Open your browser and go to:
```text
http://localhost:3000
```

Environment variables (backend)

In the server folder, create a .env file with at least:

```env
MONGO_URI=your-mongodb-connection-string
JWT_SECRET=some-long-random-secret
PORT=3001
CLIENT_URL=http://localhost:3000
RESET_TOKEN_TTL_MINUTES=30
RESET_RATE_WINDOW_MINUTES=15
FORGOT_PASSWORD_RATE_LIMIT_MAX=5
RESET_PASSWORD_RATE_LIMIT_MAX=10

# Optional SMTP configuration (used in development if provided)
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

# Email delivery mode: auto | smtp | ethereal-test
# auto (default): smtp when SMTP vars exist, otherwise Ethereal test inbox
EMAIL_DELIVERY_MODE=auto

# Sender identity
EMAIL_FROM="SkillSwap <no-reply@skillswap.local>"

# Daily email safety budget (helps stay under Gmail 500/day limit)
EMAIL_ENFORCE_DAILY_LIMIT=true
EMAIL_DAILY_HARD_LIMIT=350
EMAIL_DAILY_SOFT_LIMIT=300

# Profile reminder throttling
EMAIL_PROFILE_REMINDER_COOLDOWN_DAYS=7
EMAIL_PROFILE_REMINDER_BATCH_SIZE=50
```

Tip: You can start from the checked-in templates:

- `server/.env.example`
- `client/.env.example`

Copy each to `.env` in the same folder, then fill in your values.

### Google OAuth setup (Google Login)

1. In Google Cloud Console, open your project.
2. Go to `APIs & Services` -> `OAuth consent screen`.
3. Click `Data Access` (or `Scopes`, depending on UI version).
4. Click `Add or remove scopes`.
5. Add these scopes:
	- `openid`
	- `.../auth/userinfo.email`
	- `.../auth/userinfo.profile`
6. Save changes.

If you do not see userinfo scopes in the picker, enable:
- `Google People API`

Then refresh the OAuth consent screen and add scopes again.

### Finding your Client Secret

1. Go to `APIs & Services` -> `Credentials`.
2. Under `OAuth 2.0 Client IDs`, click your web client name.
3. The details page shows:
	- `Client ID`
	- `Client secret`
4. If the secret is hidden, click `Show client secret`.
5. If there is still no secret, create a new credential:
	- `Create credentials` -> `OAuth client ID` -> `Web application`.

### Google values to paste into env files

`server/.env`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
```

`client/.env`:

```env
REACT_APP_GOOGLE_CLIENT_ID=...
```

Important:
- The frontend may include `REACT_APP_GOOGLE_CLIENT_ID` safely.
- Never commit `GOOGLE_CLIENT_SECRET`.

Password reset email behavior:
- The server uses Nodemailer for password reset emails.
- `EMAIL_DELIVERY_MODE=smtp` forces SMTP delivery.
- `EMAIL_DELIVERY_MODE=ethereal-test` forces Ethereal test delivery.
- `EMAIL_DELIVERY_MODE=auto` (default) uses SMTP if credentials are present; otherwise it uses Ethereal test delivery.
- In production, `EMAIL_FROM` and SMTP credentials are required, and `EMAIL_DELIVERY_MODE=ethereal-test` is blocked at startup.
- `EMAIL_DAILY_HARD_LIMIT` blocks sends once the daily cap is reached.
- `EMAIL_DAILY_SOFT_LIMIT` suppresses lower-priority reminder sends earlier to preserve headroom.
- Run profile reminders manually with `npm run email:profile-reminders` from `server/`.

## Deployment

The application is deployed as follows:

**Frontend:** Deployment is handled outside this repository's Pages pipeline

**Backend:** Deployed on Render (https://skillswapdeploy-eqyo.onrender.com)

### Render SPA routing note (important)

If your frontend uses clean client-side URLs like `/browse`, refreshing that page can show a host-level `Not Found` unless your static hosting service rewrites unknown paths to `index.html`.

Current app behavior:
- Production defaults to hash routing (for example `/#/browse`) to prevent deep-link refresh failures on hosts without rewrite rules.
- You can switch back to clean URLs after configuring rewrites by setting:

```env
REACT_APP_FORCE_BROWSER_ROUTER=true
```

For a Render Static Site, add this rewrite rule in the service settings:
- Source: `/*`
- Destination: `/index.html`
- Action: `Rewrite`

After adding the rewrite and redeploying, direct loads and reloads of routes like `/browse`, `/foryou`, and `/chat` will work correctly.

Note: Passwords and secret keys will never be committed to Git or included in this README.

## Testing

SkillSwap uses automated tests in three places:

- Backend unit tests: `server/tests/unit/**/*.test.js`
- Frontend unit tests: `client/src/**/*.test.js`
- End-to-end tests: `client/cypress/e2e/**/*.cy.js`

### Backend Unit Tests

Backend tests use Jest.

Run them from `server/`:
```bash
cd server
npm run test:unit
```

Watch mode:
```bash
cd server
npm run test:unit:watch
```

Coverage report:
```bash
cd server
npm run test:unit:coverage
```

### Frontend Unit Tests

Frontend tests use Jest and React Testing Library.

Run them from `client/`:
```bash
cd client
npm run test:unit
```

Watch mode:
```bash
cd client
npm run test:unit:watch
```

Coverage report:
```bash
cd client
npm run test:unit:coverage
```

### End-to-End Tests

End-to-end tests use Cypress and live in `client/cypress/e2e/**/*.cy.js`.

Interactive mode:
```bash
cd server
npm start
```

In a second terminal:
```bash
cd client
npm start
```

In a third terminal:
```bash
cd client
npm run test:e2e
```

Headless mode:
```bash
cd client
npm run test:e2e:run
```

### Run All Tests

There is no single root test command in this repo. Run the three suites separately:

```bash
cd server
npm run test:unit
```

```bash
cd client
npm run test:unit
```

```bash
cd client
npm run test:e2e:run
```

## Authors

Trent Petersen: @trentpetersen2003

Ben Wolpers: @bwolpers

Nicolas Rossetti: @NicolasRossetti

Brionna Swinton: @brionnas
