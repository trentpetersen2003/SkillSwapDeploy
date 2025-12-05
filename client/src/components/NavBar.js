import React from 'react';
import { NavLink } from 'react-router-dom';
import './NavBar.css';

function NavBar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <NavLink 
          to="/for-you" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          For You
        </NavLink>
        <NavLink 
          to="/browse" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          Browse
        </NavLink>
        <NavLink 
          to="/calendar" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          Calendar
        </NavLink>
        <NavLink 
          to="/profile" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          Profile
        </NavLink>
      </div>
    </nav>
  );
}

export default NavBar;
