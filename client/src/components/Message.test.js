import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import Message from './Message';

describe('Message Component', () => {
  test('renders Message component without crashing', () => {
    const { container } = render(<Message />);
    expect(container).toBeInTheDocument();
  });

  test('displays example text content', () => {
    const { container } = render(<Message />);
    expect(container.textContent).toContain('This is just an example');
  });

  test('has proper heading structure', () => {
    const { container } = render(<Message />);
    const heading = container.querySelector('h2');
    expect(heading).toBeInTheDocument();
  });

  test('renders paragraph element', () => {
    const { container } = render(<Message />);
    const paragraph = container.querySelector('p');
    expect(paragraph).toBeInTheDocument();
  });

  test('component renders in a div container', () => {
    const { container } = render(<Message />);
    const div = container.querySelector('div');
    expect(div).toBeInTheDocument();
  });

  test('renders without props', () => {
    const { container } = render(<Message />);
    expect(container.firstChild).toBeInTheDocument();
  });

  test('displays all content text', () => {
    const { container } = render(<Message />);
    expect(container.textContent).toContain('example');
    expect(container.textContent).toContain('Change');
  });
});
