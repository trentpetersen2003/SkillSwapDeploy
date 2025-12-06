import React, { useState, useEffect } from 'react';

const SKILL_CATEGORIES = [
  'Academic & Tutoring',
  'Tech & Programming',
  'Languages',
  'Creative & Arts',
  'Career & Professional',
  'Life Skills',
  'Fitness & Wellness',
  'Hobbies & Misc'
];

function Browse() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers(search = '', category = '') {
    setLoading(true);
    setMessage('');
    
    try {
      let url = '/api/users';
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (category) params.append('category', category);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error(err);
      setMessage('Error loading users');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    fetchUsers(searchTerm, selectedCategory);
  }

  function handleCategoryChange(e) {
    const category = e.target.value;
    setSelectedCategory(category);
    fetchUsers(searchTerm, category);
  }

  function clearFilters() {
    setSearchTerm('');
    setSelectedCategory('');
    fetchUsers('', '');
  }

  if (loading) {
    return (
      <div className="for-you">
        <h1 className="for-you__title">Browse Users</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="for-you">
      <h1 className="for-you__title">Browse Users</h1>
      <p className="for-you__subtitle">
        Search and filter to find users with specific skills.
      </p>

      <div style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Search by name, username, or skill..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              flex: 1, 
              padding: '10px 12px', 
              border: '1px solid #d3d7de',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
          <button 
            type="submit"
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              background: '#2563eb',
              color: '#fff',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Search
          </button>
        </form>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={selectedCategory}
            onChange={handleCategoryChange}
            style={{ 
              flex: 1, 
              padding: '10px 12px',
              border: '1px solid #d3d7de',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          >
            <option value="">All Categories</option>
            {SKILL_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {(searchTerm || selectedCategory) && (
            <button 
              type="button" 
              onClick={clearFilters}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '8px',
                background: '#e5e7eb',
                color: '#0f172a',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {message && <p className="for-you__message">{message}</p>}

      {users.length === 0 ? (
        <p className="for-you__empty">No users found.</p>
      ) : (
        <div className="for-you__list">
          {users.map(user => {
            const offeredSkills = user.skills && user.skills.length
              ? user.skills.map(s => s.skillName).join(', ')
              : 'None';
            
            const wantedSkills = user.skillsWanted && user.skillsWanted.length
              ? user.skillsWanted.map(s => s.skillName).join(', ')
              : 'None';

            return (
              <div key={user._id} className="for-you__card">
                <div>
                  <div className="for-you__name">{user.name}</div>
                  <div className="for-you__email">@{user.username}</div>
                  <div className="for-you__city">
                    {user.city || 'Location not set'}
                  </div>
                  {user.bio && (
                    <div style={{ fontSize: '0.85rem', color: '#777', marginTop: '0.25rem' }}>
                      {user.bio}
                    </div>
                  )}
                  <div className="for-you__skills">
                    <strong>Offering:</strong> {offeredSkills}
                  </div>
                  <div className="for-you__skills">
                    <strong>Looking for:</strong> {wantedSkills}
                  </div>
                </div>
                <button
                  type="button"
                  className="for-you__swap-btn"
                  onClick={() => console.log("Swap clicked for", user.name)}
                >
                  Swap
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Browse;
