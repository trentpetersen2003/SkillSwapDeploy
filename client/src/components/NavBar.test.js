import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import NavBar from './NavBar';

jest.mock(
  'react-router-dom',
  () => ({
    NavLink: ({ to, children }) => <a href={to}>{children}</a>,
    useLocation: () => ({ pathname: '/browse' }),
    useNavigate: () => jest.fn(),
  }),
  { virtual: true }
);

jest.mock('../utils/api', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const fetchWithAuth = require('../utils/api').default;

const currentUser = {
  id: 'current-user',
  name: 'Current User',
  username: 'currentuser',
  timeZone: 'EST',
};

const notificationSwap = {
  _id: 'swap-1',
  status: 'pending',
  scheduledDate: '2030-01-10T18:00:00.000Z',
  requester: {
    _id: 'other-user',
    name: 'Taylor',
  },
  recipient: {
    _id: 'current-user',
    name: 'Current User',
  },
};

describe('NavBar Component', () => {
  beforeAll(() => {
    jest.spyOn(window, 'setInterval').mockImplementation(() => 1);
    jest.spyOn(window, 'clearInterval').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.setItem('token', 'fake-token');
    window.localStorage.setItem('user', JSON.stringify(currentUser));

    fetchWithAuth.mockResolvedValue({
      ok: true,
      json: async () => [notificationSwap],
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  afterAll(() => {
    window.setInterval.mockRestore();
    window.clearInterval.mockRestore();
  });

  async function renderNavBar(props = {}) {
    let renderResult;

    await act(async () => {
      renderResult = render(<NavBar {...props} />);
      await Promise.resolve();
    });

    return renderResult;
  }

  test('renders NavBar without crashing', async () => {
    const { container } = await renderNavBar();
    expect(container.querySelector('nav')).toBeInTheDocument();
  });

  test('NavBar has navbar CSS class', async () => {
    const { container } = await renderNavBar();
    const nav = container.querySelector('nav');
    expect(nav).toHaveClass('navbar');
  });

  test('contains navigation links for main pages', async () => {
    const { container } = await renderNavBar();
    const links = container.querySelectorAll('a');
    expect(links.length).toBeGreaterThan(0);
  });

  test('renders navbar container div', async () => {
    const { container } = await renderNavBar();
    const navContainer = container.querySelector('.navbar-container');
    expect(navContainer).toBeInTheDocument();
  });

  test('NavBar is properly structured', async () => {
    const { container } = await renderNavBar();
    const nav = container.querySelector('nav.navbar');
    expect(nav).toBeInTheDocument();
    expect(nav.querySelector('.navbar-container')).toBeInTheDocument();
  });

  test('shows pending swap notifications in the selected timezone', async () => {
    await renderNavBar({ isProfileComplete: true });

    await waitFor(() => {
      expect(fetchWithAuth).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByLabelText('Open notifications'));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Taylor requested a swap on Jan 10, 2030, 1:00 PM (Eastern Time).',
          { selector: 'p.navbar-notification-item__message' }
        )
      ).toBeInTheDocument();
    });
  });
});
