import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import NavBar from './NavBar';

jest.mock(
  'react-router-dom',
  () => ({
    NavLink: ({ to, children }) => <a href={to}>{children}</a>,
  }),
  { virtual: true }
);

describe('NavBar Component', () => {
  test('renders NavBar without crashing', () => {
    const { container } = render(<NavBar />);
    expect(container.querySelector('nav')).toBeInTheDocument();
  });

  test('NavBar has navbar CSS class', () => {
    const { container } = render(<NavBar />);
    const nav = container.querySelector('nav');
    expect(nav).toHaveClass('navbar');
  });

  test('contains navigation links for main pages', () => {
    const { container } = render(<NavBar />);
    const links = container.querySelectorAll('a');
    expect(links.length).toBeGreaterThan(0);
  });

  test('renders navbar container div', () => {
    const { container } = render(<NavBar />);
    const navContainer = container.querySelector('.navbar-container');
    expect(navContainer).toBeInTheDocument();
  });

  test('NavBar is properly structured', () => {
    const { container } = render(<NavBar />);
    const nav = container.querySelector('nav.navbar');
    expect(nav).toBeInTheDocument();
    expect(nav.querySelector('.navbar-container')).toBeInTheDocument();
  });
});
