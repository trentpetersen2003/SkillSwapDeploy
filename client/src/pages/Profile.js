import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const TIMEZONES = [
  { value: 'UTC-12:00', label: '(GMT-12:00) International Date Line West' },
  { value: 'UTC-11:00', label: '(GMT-11:00) Midway Island, Samoa' },
  { value: 'UTC-10:00', label: '(GMT-10:00) Hawaii' },
  { value: 'UTC-09:00', label: '(GMT-09:00) Alaska' },
  { value: 'UTC-08:00', label: '(GMT-08:00) Pacific Time (US & Canada)' },
  { value: 'UTC-07:00', label: '(GMT-07:00) Mountain Time (US & Canada)' },
  { value: 'UTC-06:00', label: '(GMT-06:00) Central Time (US & Canada)' },
  { value: 'UTC-05:00', label: '(GMT-05:00) Eastern Time (US & Canada)' },
  { value: 'UTC-04:00', label: '(GMT-04:00) Atlantic Time (Canada)' },
  { value: 'UTC-03:30', label: '(GMT-03:30) Newfoundland' },
  { value: 'UTC-03:00', label: '(GMT-03:00) Buenos Aires, Georgetown' },
  { value: 'UTC-02:00', label: '(GMT-02:00) Mid-Atlantic' },
  { value: 'UTC-01:00', label: '(GMT-01:00) Azores, Cape Verde Islands' },
  { value: 'UTC+00:00', label: '(GMT+00:00) London, Dublin, Lisbon' },
  { value: 'UTC+01:00', label: '(GMT+01:00) Paris, Berlin, Rome' },
  { value: 'UTC+02:00', label: '(GMT+02:00) Athens, Cairo, Jerusalem' },
  { value: 'UTC+03:00', label: '(GMT+03:00) Moscow, Baghdad, Riyadh' },
  { value: 'UTC+03:30', label: '(GMT+03:30) Tehran' },
  { value: 'UTC+04:00', label: '(GMT+04:00) Abu Dhabi, Muscat, Baku' },
  { value: 'UTC+04:30', label: '(GMT+04:30) Kabul' },
  { value: 'UTC+05:00', label: '(GMT+05:00) Islamabad, Karachi, Tashkent' },
  { value: 'UTC+05:30', label: '(GMT+05:30) Mumbai, Kolkata, New Delhi' },
  { value: 'UTC+05:45', label: '(GMT+05:45) Kathmandu' },
  { value: 'UTC+06:00', label: '(GMT+06:00) Almaty, Dhaka, Colombo' },
  { value: 'UTC+06:30', label: '(GMT+06:30) Yangon, Rangoon' },
  { value: 'UTC+07:00', label: '(GMT+07:00) Bangkok, Hanoi, Jakarta' },
  { value: 'UTC+08:00', label: '(GMT+08:00) Beijing, Hong Kong, Singapore' },
  { value: 'UTC+09:00', label: '(GMT+09:00) Tokyo, Seoul, Osaka' },
  { value: 'UTC+09:30', label: '(GMT+09:30) Adelaide, Darwin' },
  { value: 'UTC+10:00', label: '(GMT+10:00) Sydney, Melbourne, Brisbane' },
  { value: 'UTC+11:00', label: '(GMT+11:00) Solomon Islands, New Caledonia' },
  { value: 'UTC+12:00', label: '(GMT+12:00) Auckland, Wellington, Fiji' },
  { value: 'UTC+13:00', label: '(GMT+13:00) Nuku\'alofa' }
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const HOURS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const MINUTES = ['00', '15', '30', '45'];

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

const SKILL_LEVELS = ['Novice', 'Proficient', 'Expert'];

function Profile({ onLogout }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: '',
    username: '',
    email: '',
    city: '',
    phoneNumber: '',
    timeZone: '',
    bio: '',
    availability: [],
    skills: [],
    skillsWanted: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [availabilityError, setAvailabilityError] = useState('');
  const [skillError, setSkillError] = useState('');
  const [newAvailability, setNewAvailability] = useState({
    selectedDays: [],
    startHour: '9',
    startMinute: '00',
    startPeriod: 'AM',
    endHour: '5',
    endMinute: '00',
    endPeriod: 'PM'
  });
  const [newSkill, setNewSkill] = useState({
    skillName: '',
    category: '',
    level: 'Novice'
  });
  const [newSkillWanted, setNewSkillWanted] = useState({
    skillName: '',
    category: '',
    level: 'Novice'
  });

  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/');
      return;
    }

    try {
      const res = await fetch('/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch profile');
      }

      const data = await res.json();
      setProfile({
        name: data.name || '',
        username: data.username || '',
        email: data.email || '',
        city: data.city || '',
        phoneNumber: data.phoneNumber || '',
        timeZone: data.timeZone || '',
        bio: data.bio || '',
        availability: (data.availability || []).map(slot => {
          const match = slot.timeRange.match(/(\d+):(\d+)\s*(AM|PM)/);
          if (match) {
            return {
              ...slot,
              startMin: timeToMinutes(match[1], match[2], match[3])
            };
          }
          return slot;
        }),
        skills: data.skills || [],
        skillsWanted: data.skillsWanted || []
      });
    } catch (err) {
      console.error(err);
      setMessage('Error loading profile');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  function handleChange(e) {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  }

  function handleAvailabilityChange(e) {
    const { name, value } = e.target;
    setNewAvailability(prev => ({ ...prev, [name]: value }));
  }

  function handleDayToggle(day) {
    setNewAvailability(prev => {
      const selectedDays = prev.selectedDays.includes(day)
        ? prev.selectedDays.filter(d => d !== day)
        : [...prev.selectedDays, day];
      return { ...prev, selectedDays };
    });
  }

  function handleSkillChange(e) {
    const { name, value } = e.target;
    setNewSkill(prev => ({ ...prev, [name]: value }));
  }

  function handleSkillWantedChange(e) {
    const { name, value } = e.target;
    setNewSkillWanted(prev => ({ ...prev, [name]: value }));
  }

  function timeToMinutes(hour, minute, period) {
    let hours = parseInt(hour);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + parseInt(minute);
  }

  function hasTimeConflict(day, startMin, endMin) {
    return profile.availability.some(slot => {
      if (slot.day !== day) return false;
      
      const match = slot.timeRange.match(/(\d+):(\d+)\s*(AM|PM)\s*-\s*(\d+):(\d+)\s*(AM|PM)/);
      if (!match) return false;
      
      const slotStart = timeToMinutes(match[1], match[2], match[3]);
      const slotEnd = timeToMinutes(match[4], match[5], match[6]);
      
      return (startMin < slotEnd && endMin > slotStart);
    });
  }

  function addAvailability() {
    setAvailabilityError('');
    
    if (newAvailability.selectedDays.length === 0) {
      setAvailabilityError('Please select at least one day');
      return;
    }

    const startMin = timeToMinutes(newAvailability.startHour, newAvailability.startMinute, newAvailability.startPeriod);
    const endMin = timeToMinutes(newAvailability.endHour, newAvailability.endMinute, newAvailability.endPeriod);

    if (startMin >= endMin) {
      setAvailabilityError('Invalid time format - End time must be after start time (e.g., 3:00 PM to 1:00 PM is invalid)');
      return;
    }

    for (const day of newAvailability.selectedDays) {
      if (hasTimeConflict(day, startMin, endMin)) {
        setAvailabilityError(`Time conflict detected for ${day} - This time overlaps with an existing time slot`);
        return;
      }
    }

    const timeRange = `${newAvailability.startHour}:${newAvailability.startMinute} ${newAvailability.startPeriod} - ${newAvailability.endHour}:${newAvailability.endMinute} ${newAvailability.endPeriod}`;
    
    const newSlots = newAvailability.selectedDays.map(day => ({
      day,
      timeRange,
      startMin
    }));

    setProfile(prev => ({
      ...prev,
      availability: [...prev.availability, ...newSlots].sort((a, b) => {
        const dayCompare = DAYS_OF_WEEK.indexOf(a.day) - DAYS_OF_WEEK.indexOf(b.day);
        if (dayCompare !== 0) return dayCompare;
        
        const aStart = a.startMin !== undefined ? a.startMin : timeToMinutes(
          ...a.timeRange.match(/(\d+):(\d+)\s*(AM|PM)/).slice(1)
        );
        const bStart = b.startMin !== undefined ? b.startMin : timeToMinutes(
          ...b.timeRange.match(/(\d+):(\d+)\s*(AM|PM)/).slice(1)
        );
        return aStart - bStart;
      })
    }));
    
    setNewAvailability({
      selectedDays: [],
      startHour: '9',
      startMinute: '00',
      startPeriod: 'AM',
      endHour: '5',
      endMinute: '00',
      endPeriod: 'PM'
    });
  }

  function addSkill() {
    setSkillError('');
    
    if (!newSkill.skillName.trim() || !newSkill.category) {
      setSkillError('Please enter skill name and select a category');
      return;
    }

    setProfile(prev => ({
      ...prev,
      skills: [...prev.skills, { ...newSkill }]
    }));
    
    setNewSkill({
      skillName: '',
      category: '',
      level: 'Novice'
    });
  }

  function removeSkill(index) {
    setProfile(prev => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index)
    }));
  }

  function addSkillWanted() {
    setSkillError('');
    
    if (!newSkillWanted.skillName.trim() || !newSkillWanted.category) {
      setSkillError('Please enter skill name and select a category');
      return;
    }

    setProfile(prev => ({
      ...prev,
      skillsWanted: [...prev.skillsWanted, { ...newSkillWanted }]
    }));
    
    setNewSkillWanted({
      skillName: '',
      category: '',
      level: 'Novice'
    });
  }

  function removeSkillWanted(index) {
    setProfile(prev => ({
      ...prev,
      skillsWanted: prev.skillsWanted.filter((_, i) => i !== index)
    }));
  }

  function removeAvailability(index) {
    setProfile(prev => ({
      ...prev,
      availability: prev.availability.filter((_, i) => i !== index)
    }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setMessage('');

    if (!profile.name || !profile.username || !profile.email || !profile.city || !profile.timeZone) {
      setMessage('Name, username, email, location, and time zone are required');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('token');

    try {
      const cleanedAvailability = profile.availability.map(({ day, timeRange }) => ({
        day,
        timeRange
      }));

      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...profile, availability: cleanedAvailability })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to update profile');
      }

      const data = await res.json();
      const sortedAvailability = (data.availability || []).map(slot => {
        const match = slot.timeRange.match(/(\d+):(\d+)\s*(AM|PM)/);
        if (match) {
          return {
            ...slot,
            startMin: timeToMinutes(match[1], match[2], match[3])
          };
        }
        return slot;
      }).sort((a, b) => {
        const dayCompare = DAYS_OF_WEEK.indexOf(a.day) - DAYS_OF_WEEK.indexOf(b.day);
        if (dayCompare !== 0) return dayCompare;
        return (a.startMin || 0) - (b.startMin || 0);
      });

      setProfile({
        name: data.name || '',
        username: data.username || '',
        email: data.email || '',
        city: data.city || '',
        phoneNumber: data.phoneNumber || '',
        timeZone: data.timeZone || '',
        bio: data.bio || '',
        availability: sortedAvailability,
        skills: data.skills || [],
        skillsWanted: data.skillsWanted || []
      });
      setMessage('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      setMessage((err.message || 'Error updating profile'));
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    onLogout();
    navigate('/');
  }

  if (loading) {
  return (
    <div className="profile-page">
      <h1 className="profile-title">Profile</h1>
      <p>Loading...</p>
    </div>
  );
}

return (
  <div className="profile-page">
    <h1 className="profile-title">Profile</h1>
   

    <form onSubmit={handleSave} className="profile-form">
        <input
          name="name"
          placeholder="Name *"
          value={profile.name}
          onChange={handleChange}
          required
        />
        <input
          name="username"
          placeholder="Username *"
          value={profile.username}
          onChange={handleChange}
          required
        />
        <input
          name="email"
          type="email"
          placeholder="Email *"
          value={profile.email}
          onChange={handleChange}
          required
        />
        <input
          name="city"
          placeholder="Location *"
          value={profile.city}
          onChange={handleChange}
          required
        />
        <input
          name="phoneNumber"
          placeholder="Phone Number (optional)"
          value={profile.phoneNumber}
          onChange={handleChange}
        />
        <select
          name="timeZone"
          value={profile.timeZone}
          onChange={handleChange}
          required
          style={{ padding: '8px', fontSize: '14px' }}
        >
          <option value="">Select Time Zone *</option>
          {TIMEZONES.map(tz => (
            <option key={tz.value} value={tz.value}>{tz.label}</option>
          ))}
        </select>
        <textarea
          name="bio"
          placeholder="Short Bio (optional)"
          value={profile.bio}
          onChange={handleChange}
          rows="4"
        />

        <h3>Availability</h3>
        {profile.availability.length > 0 && (
          <div className="availability-list">
            {DAYS_OF_WEEK.map(day => {
              const daySlots = profile.availability.filter(slot => slot.day === day);
              if (daySlots.length === 0) return null;
              return (
                <div key={day} className="availability-item">
                  <span><strong>{day}:</strong> {daySlots.map(slot => slot.timeRange).join(', ')}</span>
                  {daySlots.map((slot, idx) => {
                    const actualIndex = profile.availability.findIndex(s => s === slot);
                    return (
                      <button 
                        key={idx} 
                        type="button" 
                        onClick={() => removeAvailability(actualIndex)}
                        style={{ marginLeft: '5px' }}
                      >
                        Remove {idx + 1}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        <div className="availability-input">
          <div style={{ marginBottom: '10px' }}>
            <strong>Select Days:</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px' }}>
              {DAYS_OF_WEEK.map(day => (
                <label key={day} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newAvailability.selectedDays.includes(day)}
                    onChange={() => handleDayToggle(day)}
                    style={{ marginRight: '5px' }}
                  />
                  {day}
                </label>
              ))}
            </div>
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <strong>Start Time:</strong>
            <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
              <select
                name="startHour"
                value={newAvailability.startHour}
                onChange={handleAvailabilityChange}
                style={{ padding: '8px' }}
              >
                {HOURS.map(hour => (
                  <option key={hour} value={hour}>{hour}</option>
                ))}
              </select>
              <span style={{ display: 'flex', alignItems: 'center' }}>:</span>
              <select
                name="startMinute"
                value={newAvailability.startMinute}
                onChange={handleAvailabilityChange}
                style={{ padding: '8px' }}
              >
                {MINUTES.map(minute => (
                  <option key={minute} value={minute}>{minute}</option>
                ))}
              </select>
              <select
                name="startPeriod"
                value={newAvailability.startPeriod}
                onChange={handleAvailabilityChange}
                style={{ padding: '8px' }}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <strong>End Time:</strong>
            <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
              <select
                name="endHour"
                value={newAvailability.endHour}
                onChange={handleAvailabilityChange}
                style={{ padding: '8px' }}
              >
                {HOURS.map(hour => (
                  <option key={hour} value={hour}>{hour}</option>
                ))}
              </select>
              <span style={{ display: 'flex', alignItems: 'center' }}>:</span>
              <select
                name="endMinute"
                value={newAvailability.endMinute}
                onChange={handleAvailabilityChange}
                style={{ padding: '8px' }}
              >
                {MINUTES.map(minute => (
                  <option key={minute} value={minute}>{minute}</option>
                ))}
              </select>
              <select
                name="endPeriod"
                value={newAvailability.endPeriod}
                onChange={handleAvailabilityChange}
                style={{ padding: '8px' }}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          
          <button type="button" onClick={addAvailability}>Add Availability</button>
        </div>

        {availabilityError && (
          <div style={{ 
            backgroundColor: '#fee', 
            border: '2px solid #c00', 
            color: '#c00', 
            padding: '12px', 
            borderRadius: '5px', 
            marginTop: '10px',
            marginBottom: '15px',
            fontWeight: 'bold'
          }}>
            ⚠️ {availabilityError}
          </div>
        )}

        <h3>Skills</h3>
        {profile.skills.length > 0 && (
          <div className="skills-list" style={{ marginBottom: '15px' }}>
            {profile.skills.map((skill, index) => (
              <div key={index} className="availability-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span><strong>{skill.skillName}</strong> - {skill.category} ({skill.level})</span>
                <button type="button" onClick={() => removeSkill(index)}>Remove</button>
              </div>
            ))}
          </div>
        )}

        <div className="skill-input" style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '10px' }}>
            <input
              name="skillName"
              placeholder="Skill Name (e.g., Python Programming)"
              value={newSkill.skillName}
              onChange={handleSkillChange}
              style={{ width: '100%', padding: '8px', fontSize: '14px' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <select
              name="category"
              value={newSkill.category}
              onChange={handleSkillChange}
              style={{ flex: 1, padding: '8px', fontSize: '14px' }}
            >
              <option value="">Select Category *</option>
              {SKILL_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            <select
              name="level"
              value={newSkill.level}
              onChange={handleSkillChange}
              style={{ flex: 1, padding: '8px', fontSize: '14px' }}
            >
              {SKILL_LEVELS.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
          
          <button type="button" onClick={addSkill}>Add Skill</button>
        </div>

        <h3>Skills You Want</h3>
        {profile.skillsWanted.length > 0 && (
          <div className="skills-list" style={{ marginBottom: '15px' }}>
            {profile.skillsWanted.map((skill, index) => (
              <div key={index} className="availability-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span><strong>{skill.skillName}</strong> - {skill.category} ({skill.level})</span>
                <button type="button" onClick={() => removeSkillWanted(index)}>Remove</button>
              </div>
            ))}
          </div>
        )}

        <div className="skill-input" style={{ marginBottom: '20px' }}>
          <div style={{ marginBottom: '10px' }}>
            <input
              name="skillName"
              placeholder="Skill Name (e.g., Guitar Playing)"
              value={newSkillWanted.skillName}
              onChange={handleSkillWantedChange}
              style={{ width: '100%', padding: '8px', fontSize: '14px' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <select
              name="category"
              value={newSkillWanted.category}
              onChange={handleSkillWantedChange}
              style={{ flex: 1, padding: '8px', fontSize: '14px' }}
            >
              <option value="">Select Category *</option>
              {SKILL_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            <select
              name="level"
              value={newSkillWanted.level}
              onChange={handleSkillWantedChange}
              style={{ flex: 1, padding: '8px', fontSize: '14px' }}
            >
              {SKILL_LEVELS.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
          
          <button type="button" onClick={addSkillWanted}>Add Skill Wanted</button>
        </div>

        {skillError && (
          <div style={{ 
            backgroundColor: '#fee', 
            border: '2px solid #c00', 
            color: '#c00', 
            padding: '12px', 
            borderRadius: '5px', 
            marginTop: '10px',
            marginBottom: '15px',
            fontWeight: 'bold'
          }}>
            ⚠️ {skillError}
          </div>
        )}

        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      {message && (
        <div style={{ 
          backgroundColor: message.includes('success') ? '#dfd' : '#fee', 
          border: message.includes('success') ? '2px solid #0a0' : '2px solid #c00', 
          color: message.includes('success') ? '#0a0' : '#c00', 
          padding: '12px', 
          borderRadius: '5px', 
          marginTop: '15px',
          fontWeight: 'bold'
        }}>
          {message.includes('success') ? '✓' : '⚠️'} {message}
        </div>
      )}

      <button type="button" onClick={handleLogout} style={{ marginTop: '20px' }}>
        Log out
      </button>
    </div>
  );
}

export default Profile;
