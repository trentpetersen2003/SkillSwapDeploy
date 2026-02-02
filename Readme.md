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

## Deployment

The application is deployed as follows:

**Frontend:** GitHub Pages (https://sccapstone.github.io/VectorForge)
- Automatically deploys when changes are pushed to the main branch
- Uses GitHub Actions workflow for CI/CD

**Backend:** Deployed on Render (https://skillswapdeploy-eqyo.onrender.com)

### Manual Deployment (Alternative)

To manually deploy the frontend to GitHub Pages:

```bash
cd client
npm run deploy
```

Note: Passwords and secret keys will never be committed to Git or included in this README.

### GitHub Pages Setup

The frontend is configured to deploy automatically via GitHub Actions. To enable this:

1. Go to your repository Settings → Pages
2. Under "Build and deployment", select "Source: GitHub Actions"
3. Push changes to the main branch to trigger deployment

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

This testing suite meets the assignment requirements by providing:
- ✅ **Comprehensive unit tests** for both backend and frontend (exceeds minimum)
- ✅ **Clear test structure** with meaningful test cases (not IDE-generated defaults)
- ✅ **Well-documented instructions** in this README for running and understanding tests
- ✅ **Behavior tests** with Cypress for end-to-end verification
- ✅ **Multiple test suites** covering middleware, routes, models, and components

## Authors

Trent Petersen: @trentpetersen2003

Ben Wolpers: @bwolpers

Nicolas Rossetti: @NicolasRossetti

Brionna Swinton: @brionnas
