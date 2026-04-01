import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import SwapRequestModal from './SwapRequestModal';

jest.mock('../utils/loading', () => ({
  MIN_LOADING_MS: 600,
  withMinimumDelay: (taskOrPromise) =>
    typeof taskOrPromise === 'function' ? taskOrPromise() : taskOrPromise,
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

// Mock fetch
global.fetch = jest.fn();

// Mock config
jest.mock('../config', () => 'http://localhost:3001');

describe('SwapRequestModal Component', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();
  const mockUser = {
    _id: 'user-123',
    name: 'John Doe',
    skills: [
      { skillName: 'Guitar', category: 'Music', level: 'Expert' },
      { skillName: 'Spanish', category: 'Language', level: 'Proficient' },
    ],
  };

  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'token') return 'fake-token';
      return null;
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('renders without crashing', () => {
    fetch.mockImplementation(() => new Promise(() => {}));

    const { container } = render(
      <SwapRequestModal 
        user={mockUser} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );
    expect(container).toBeInTheDocument();
  });

  test('displays user name in modal header', () => {
    fetch.mockImplementation(() => new Promise(() => {}));

    const { container } = render(
      <SwapRequestModal 
        user={mockUser} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );
    expect(container.textContent).toContain('John Doe');
  });

  test('has modal overlay structure', () => {
    fetch.mockImplementation(() => new Promise(() => {}));

    const { container } = render(
      <SwapRequestModal 
        user={mockUser} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );
    expect(container.querySelector('.modal-overlay')).toBeInTheDocument();
    expect(container.querySelector('.modal-content')).toBeInTheDocument();
  });

  test('calls onClose when close button is clicked', () => {
    fetch.mockImplementation(() => new Promise(() => {}));

    const { container } = render(
      <SwapRequestModal 
        user={mockUser} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );
    
    const closeButton = container.querySelector('.modal-close');
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('shows loading state while fetching swap details', () => {
    fetch.mockImplementation(() => new Promise(() => {}));

    render(
      <SwapRequestModal 
        user={mockUser} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );
    expect(screen.getByText('Loading swap details...')).toBeInTheDocument();
  });

  test('shows retry when swap details request fails', async () => {
    fetch.mockRejectedValue(new Error('Network down'));

    render(
      <SwapRequestModal 
        user={mockUser} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Network down')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  test('renders form fields after successful details fetch', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        skills: [{ skillName: 'Piano' }],
      }),
    });

    const { container } = render(
      <SwapRequestModal
        user={mockUser}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('.swap-request-form')).toBeInTheDocument();
    });

    const selects = container.querySelectorAll('select');
    expect(selects.length).toBeGreaterThan(0);
  });

  test('disables form and shows sending text while request is in-flight', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ skills: [{ skillName: 'Piano' }] }),
      })
      .mockImplementationOnce(() => new Promise(() => {}));

    const { container } = render(
      <SwapRequestModal
        user={mockUser}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('.swap-request-form')).toBeInTheDocument();
    });

    fireEvent.change(container.querySelector('#skillOffered'), {
      target: { value: 'Piano' },
    });
    fireEvent.change(container.querySelector('#skillWanted'), {
      target: { value: 'Guitar' },
    });
    fireEvent.change(container.querySelector('#scheduledDate'), {
      target: { value: '2030-01-01' },
    });
    fireEvent.change(container.querySelector('#scheduledTime'), {
      target: { value: '10:30' },
    });
    fireEvent.change(container.querySelector('input[placeholder="Milestone 1 goal"]'), {
      target: { value: 'Cover beginner chord transitions' },
    });

    const submitButton = screen.getByRole('button', { name: 'Send Request' });
    fireEvent.click(submitButton);

    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();
    expect(container.querySelector('.swap-request-fieldset')).toBeDisabled();
  });

  test('sends total sessions and milestones in request payload', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ skills: [{ skillName: 'Piano' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ _id: 'swap-1' }),
      });

    const { container } = render(
      <SwapRequestModal
        user={mockUser}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(container.querySelector('.swap-request-form')).toBeInTheDocument();
    });

    fireEvent.change(container.querySelector('#skillOffered'), {
      target: { value: 'Piano' },
    });
    fireEvent.change(container.querySelector('#skillWanted'), {
      target: { value: 'Guitar' },
    });
    fireEvent.change(container.querySelector('#scheduledDate'), {
      target: { value: '2030-01-01' },
    });
    fireEvent.change(container.querySelector('#scheduledTime'), {
      target: { value: '10:30' },
    });
    fireEvent.change(container.querySelector('#totalSessions'), {
      target: { value: '2' },
    });

    const milestoneInputs = container.querySelectorAll('.milestone-list input');
    fireEvent.change(milestoneInputs[0], {
      target: { value: 'Learn basic scales' },
    });
    fireEvent.change(milestoneInputs[1], {
      target: { value: 'Practice one full song' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send Request' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    const secondCallBody = JSON.parse(fetch.mock.calls[1][1].body);
    expect(secondCallBody.totalSessions).toBe(2);
    expect(secondCallBody.milestones).toEqual([
      { title: 'Learn basic scales' },
      { title: 'Practice one full song' },
    ]);
  });

  test('modal closes when overlay is clicked', () => {
    fetch.mockImplementation(() => new Promise(() => {}));

    const { container } = render(
      <SwapRequestModal 
        user={mockUser} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );
    
    const overlay = container.querySelector('.modal-overlay');
    fireEvent.click(overlay);
    expect(mockOnClose).toHaveBeenCalled();
  });
});
