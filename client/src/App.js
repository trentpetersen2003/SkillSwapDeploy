// client/src/App.js
import React, { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [users, setUsers] = useState([]);
  const [nameInput, setNameInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();
        setUsers(data);
      } catch (err) {
        console.error("Failed to load users:", err);
      }
    }
    fetchUsers();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!nameInput.trim() || !emailInput.trim() || !passwordInput.trim()) return;

    const newUser = {
      name: nameInput.trim(),
      email: emailInput.trim(),
      password: passwordInput.trim(),
    };

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      const savedUser = await res.json();
      if (res.ok) {
        setUsers((prev) => [...prev, savedUser]);
        setNameInput("");
        setEmailInput("");
        setPasswordInput("");
      } else {
        console.error("Failed to save user:", savedUser);
      }
    } catch (err) {
      console.error("Failed to save user:", err);
    }
  }

  return (
    <div className="App">
      <h1>SkillSwap</h1>

      <form onSubmit={handleSubmit} className="form">
        <input
          placeholder="Name"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
        />
        <input
          placeholder="Email"
          type="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
        />
        <input
          placeholder="Password"
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
        />
        <button type="submit">Add</button>
      </form>

      <h2>Users from backend</h2>
      {users.length === 0 ? (
        <p>No users yet. Add one above.</p>
      ) : (
        <ul className="users">
          {users.map((user) => (
            <li key={user._id || user.id}>
              {user.name} — {user.email}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;