# SkillSwap

SkillSwap is a community-driven web application where users can trade skills with one another (e.g., “I can teach guitar if you help me learn Spanish”). The app will match users based on skills offered and requested, allow them to chat in real-time, and provide an easy way to schedule sessions through Google Calendar. More detailed information can be found in our project wiki.

This README provides instructions for developers joining the project so they can install, run, and contribute to the application.

## External Requirements

You will need the following installed on your computer:

Node.js (includes npm): https://nodejs.org/en/

Git: https://git-scm.com/

MongoDB: https://www.mongodb.com/try/download/community

Example installation commands (macOS/Homebrew):
brew install node
brew install git
brew tap mongodb/brew
brew install mongodb-community

Windows users can download installers from the links above.

## Setup

After cloning the repository:

git clone https://github.com/SCCapstone/VectorForge.git

cd VectorForge

Install frontend dependencies:
cd frontend
npm install

Install backend dependencies:
cd ../backend
npm install

Note: Folder structure may change as we build more features.

## Running

Run the backend API:
cd backend
npm start

Run the frontend application:
cd frontend
npm start

Open your browser and go to:
http://localhost:3000

The frontend should automatically reload as you make changes.

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