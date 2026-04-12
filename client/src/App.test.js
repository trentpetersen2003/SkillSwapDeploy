import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

// Mock config to avoid API calls
jest.mock('./config', () => 'http://localhost:3001');

// Mock page modules to avoid heavy dependencies in unit tests
jest.mock('./pages/Calendar', () => () => <div data-testid="calendar-page" />);
jest.mock('./pages/ForYou', () => () => <div data-testid="foryou-page" />);
jest.mock('./pages/Browse', () => () => <div data-testid="browse-page" />);
jest.mock('./pages/Profile', () => () => <div data-testid="profile-page" />);

// Mock react-router-dom to avoid dependency on router setup
jest.mock(
  'react-router-dom',
  () => ({
    BrowserRouter: ({ children }) => <div>{children}</div>,
    HashRouter: ({ children }) => <div>{children}</div>,
    Routes: ({ children }) => <div>{children}</div>,
    Route: () => null,
    Navigate: () => null,
    useNavigate: () => jest.fn(),
    useParams: () => ({ token: "mock-token" }),
    useLocation: () => ({ search: "" }),
  }),
  { virtual: true }
);

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
);

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
global.localStorage = localStorageMock;

describe('App Component Smoke Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  test('App component structure loads', () => {
    // Just verify imports work and component is defined
    expect(() => {
      require('./App');
    }).not.toThrow();
  });

  test('App exports a React component', () => {
    const App = require('./App').default;
    expect(App).toBeDefined();
    expect(typeof App).toBe('function');
  });

  test('renders without crashing when no session is stored', () => {
    const { container } = render(<App />);
    expect(container).toBeInTheDocument();
  });
});
