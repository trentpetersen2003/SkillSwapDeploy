# SkillSwap

SkillSwap is a community-driven web app where users can trade skills with each other  
(e.g., “I can teach guitar if you help me learn Spanish”).  

For this proof-of-concept (v0.1), the app supports:

- User registration and login (JWT auth)
- Profile with city, time zone, bio, availability, and skills
- “For You” page that shows other users with their skills
- Browse and Calendar pages as initial UI stubs

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

git clone https://github.com/SCCapstone/VectorForge.git
cd VectorForge


Install frontend dependencies:
cd client
npm install

Install backend dependencies:
cd ../server
npm install

Note: Folder structure may change as we build more features.

## Running

Run the backend API:
cd server
npm start

Run the frontend application:
cd client
npm start

Open your browser and go to:
http://localhost:3000

Environment variables (backend)

In the server folder, create a .env file with at least:

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

# Sender identity
EMAIL_FROM="SkillSwap <no-reply@skillswap.local>"

# Production email provider (Resend)
RESEND_API_KEY=

Password reset email behavior:
- In production with `RESEND_API_KEY`, email is sent through Resend.
- In non-production (or if Resend key is missing), the server uses Nodemailer.
- If no SMTP credentials are configured in non-production, Nodemailer falls back to a free Ethereal test inbox and logs a preview URL to the server console.

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
- `User.model.test.js` - Tests for User model schema (field validation, arrays, defaults, timestamps)

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

### Running All Tests

To run all tests (backend unit + frontend unit):
```bash
# Backend
cd server
npm run test:unit

# Frontend
cd client
npm test -- --watchAll=false
```

### Test Requirements Met

SkillSwap uses automated unit tests and will add additional tests throughout development.

### Backend Unit Tests

From the server directory:
```bash
npm run test:unit
```

Tests are located in:
```bash
server/tests/unit/
```

### Planned Additions

Frontend unit tests using Jest + React Testing Library
Behavior (end-to-end) tests using Cypress

Testing commands and additional test locations will be added as more tests are implemented.

## Authors

Trent Petersen: @trentpetersen2003

Ben Wolpers: @bwolpers

Nicolas Rossetti: @NicolasRossetti

Brionna Swinton: @brionnas
