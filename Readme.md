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

**Backend:** Planned deployment using Render or Railway (details TBD)

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

Automated testing will be added later in CSCE 492.

Future structure will likely include:
/frontend/tests
/backend/tests

### Testing Technology (planned)

Jest + React Testing Library (frontend)

Jest or Mocha/Chai (backend)

### Running Tests

Testing commands will be documented once implemented.

## Authors

Trent Petersen: @trentpetersen2003

Ben Wolpers: @bwolpers

Nicolas Rossetti: @NicolasRossetti

Brionna Swinton: @brionnas
