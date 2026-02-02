import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SwapRequestModal from './SwapRequestModal';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
};
global.localStorage = localStorageMock;

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

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  test('renders without crashing', () => {
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

  test('renders form fields', () => {
    const { container } = render(
      <SwapRequestModal 
        user={mockUser} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );
    expect(container.querySelector('.swap-request-form')).toBeInTheDocument();
  });

  test('has select dropdowns for skills', () => {
    const { container } = render(
      <SwapRequestModal 
        user={mockUser} 
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );
    const selects = container.querySelectorAll('select');
    expect(selects.length).toBeGreaterThan(0);
  });

  test('modal closes when overlay is clicked', () => {
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
