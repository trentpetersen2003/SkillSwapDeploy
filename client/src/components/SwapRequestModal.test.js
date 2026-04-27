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
  const allDayAvailability = [
    { day: 'Sunday', timeRange: '12:00 AM - 11:59 PM' },
    { day: 'Monday', timeRange: '12:00 AM - 11:59 PM' },
    { day: 'Tuesday', timeRange: '12:00 AM - 11:59 PM' },
    { day: 'Wednesday', timeRange: '12:00 AM - 11:59 PM' },
    { day: 'Thursday', timeRange: '12:00 AM - 11:59 PM' },
    { day: 'Friday', timeRange: '12:00 AM - 11:59 PM' },
    { day: 'Saturday', timeRange: '12:00 AM - 11:59 PM' },
  ];
  const mockUser = {
    _id: 'user-123',
    name: 'John Doe',
    timeZone: 'UTC-08:00',
    availability: allDayAvailability,
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
        timeZone: 'UTC-05:00',
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
        json: async () => ({
          skills: [{ skillName: 'Piano' }],
          timeZone: 'UTC-05:00',
          availability: allDayAvailability,
        }),
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
    fireEvent.change(container.querySelector('#meetingLink'), {
      target: { value: 'https://zoom.us/j/123456789' },
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
        json: async () => ({
          skills: [{ skillName: 'Piano' }],
          timeZone: 'UTC-05:00',
          availability: allDayAvailability,
        }),
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
    fireEvent.change(container.querySelector('#meetingLink'), {
      target: { value: 'https://zoom.us/j/987654321' },
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

  test('loads suggested slots and applies one to date/time fields', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ skills: [{ skillName: 'Piano' }], timeZone: 'UTC-05:00', availability: allDayAvailability }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          suggestions: [
            {
              scheduledDate: '2030-01-10T15:30:00.000Z',
              requesterLocal: 'Friday 10:30 AM - 11:30 AM (UTC-05:00)',
              recipientLocal: 'Friday 7:30 AM - 8:30 AM (UTC-08:00)',
              reason: 'Both users evening-friendly',
            },
          ],
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

    fireEvent.click(screen.getByRole('button', { name: 'Suggest Times' }));

    await waitFor(() => {
      expect(screen.getByText('Thursday 10:30 AM - 11:30 AM (Central Time)')).toBeInTheDocument();
    });
    expect(screen.getByText('Why: Both users evening-friendly')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Thursday 10:30 AM - 11:30 AM/i }));

    expect(container.querySelector('#scheduledDate')).toHaveValue('2030-01-10');
    expect(container.querySelector('#scheduledTime')).toHaveValue('10:30');
  });

  test('renders suggested slots in selected timezone when profile timezone is EST', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ skills: [{ skillName: 'Piano' }], timeZone: 'EST', availability: allDayAvailability }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          suggestions: [
            {
              scheduledDate: '2030-01-10T15:30:00.000Z',
              requesterLocal: 'Thursday 3:30 PM - 4:30 PM (UTC)',
              recipientLocal: 'Thursday 3:30 PM - 4:30 PM (UTC)',
            },
          ],
        }),
      });

    render(
      <SwapRequestModal
        user={{ ...mockUser, timeZone: 'UTC-08:00' }}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Suggest Times' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Suggest Times' }));

    await waitFor(() => {
      expect(screen.getByText('Thursday 10:30 AM - 11:30 AM (Eastern Time)')).toBeInTheDocument();
    });
    expect(screen.getByText('John Doe: Thursday 7:30 AM - 8:30 AM (Alaska)')).toBeInTheDocument();
  });
});
