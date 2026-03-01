import React from 'react';
import { NavLink } from 'react-router-dom';
import './NavBar.css';

function NavBar() {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <NavLink to="/foryou" className="navbar-brand">
          <img
            className="navbar-brand-logo"
            src={`${process.env.PUBLIC_URL}/skillswap-logo.png`}
            alt="SkillSwap logo"
          />
          <span className="navbar-brand-text">SkillSwap</span>
        </NavLink>

        <div className="navbar-links">
        <NavLink 
          to="/foryou" 
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
          to="/chat"
          className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
        >
          Chat
        </NavLink>
        <NavLink 
          to="/profile" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          Profile
        </NavLink>
        <NavLink 
          to="/settings" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          Settings
        </NavLink>
        </div>
      </div>
    </nav>
  );
}

export default NavBar;
