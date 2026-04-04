# SkillSwap

SkillSwap is a community-driven web app where users can trade skills with each other  
(e.g., “I can teach guitar if you help me learn Spanish”).  

Current implemented functionality includes:

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

Note: Passwords and secret keys will never be committed to Git or included in this README.

## Testing

SkillSwap uses comprehensive automated testing with unit tests (backend and frontend) and behavior (end-to-end) tests.

### Backend Unit Tests

Backend tests use **Jest** and are located in `server/tests/unit/`.

**To run backend unit tests:**
```bash
cd server
npm run test:unit
```

**Backend test coverage:**
- `auth.middleware.test.js` - Tests for JWT authentication middleware (token validation, error handling, user extraction)
- `auth.routes.test.js` - Tests for authentication routes (register, login, validation, error cases)
- `users.routes.test.js` - Tests settings/profile privacy endpoints (notifications, password, blocked users)
- `messages.routes.test.js` - Tests message route blocking behavior and conversation filtering
- `email.service.test.js` - Tests email delivery mode/config behavior
- `User.model.test.js` - Tests User model schema (field validation, arrays, defaults, timestamps)

**Run with watch mode (auto-rerun on changes):**
```bash
cd server
npm run test:unit:watch
```

**Run with coverage report:**
```bash
cd server
npm run test:unit:coverage
```

### Frontend Unit Tests

Frontend tests use **Jest** and **React Testing Library**. Tests are located in `client/src/` with `.test.js` extensions.

**To run frontend unit tests:**
```bash
cd client
npm run test:unit
```

**Frontend test coverage:**
- `App.test.js` - Tests for main App component structure and rendering
- `components/NavBar.test.js` - Tests for navigation bar rendering and links
- `components/SwapRequestModal.test.js` - Tests for swap request modal functionality
- `components/Message.test.js` - Tests for message component display and handling
- `components/LoadingState.test.js` - Tests loading and retry UI states
- `pages/Settings.test.js` - Tests settings workflows and protected API calls
- `pages/Chat.test.js` - Tests chat auth headers and blocked-chat behavior
- `utils/loading.test.js` - Tests minimum-loading-delay helper behavior

**Run tests in watch mode (recommended during development):**
```bash
cd client
npm run test:unit:watch
```

**Run tests once and generate coverage:**
```bash
cd client
npm run test:unit:coverage
```

### Behavior (E2E) Tests

Behavior tests use **Cypress** and are located in `client/cypress/e2e/`.

**To run E2E tests interactively (recommended for development):**

First, ensure the backend is running:
```bash
cd server
npm start
```

In another terminal, run the frontend:
```bash
cd client
npm start
```

In a third terminal, open Cypress:
```bash
cd client
npm run test:e2e
```

**To run E2E tests in headless mode (CI/CD):**
```bash
cd client
npm run test:e2e:run
```

**E2E test coverage:**
- `app_loads.cy.js` - Tests that the application loads successfully and main components are present
- `behavior.cy.js` - Tests core app behavior flows

### Running All Tests

To run all tests (backend unit + frontend unit):
```bash
# Backend
cd server
npm run test:unit

# Frontend
cd client
npm run test:unit
```

## Authors

Trent Petersen: @trentpetersen2003

Ben Wolpers: @bwolpers

Nicolas Rossetti: @NicolasRossetti

Brionna Swinton: @brionnas
