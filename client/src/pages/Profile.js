import React from 'react';
import { useNavigate } from 'react-router-dom';

function Profile({ onLogout }) {
  const navigate = useNavigate();

  function handleLogout() {
    onLogout();
    navigate('/');
  }

  return (
    <div className="page">
      <h1>Profile</h1>
      <p>Profile page.</p>
      <button onClick={handleLogout}>Log out</button>
    </div>
  );
}

export default Profile;
