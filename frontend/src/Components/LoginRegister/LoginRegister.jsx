import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import './LoginRegister.css';
import { FaUser, FaEnvelope, FaLock } from "react-icons/fa";

const API_BASE_URL = "http://127.0.0.1:8000";

export const LoginRegister = () => {
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  // Form states
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const formData = new URLSearchParams();
      formData.append('username', loginUsername);
      formData.append('password', loginPassword);

      const response = await axios.post(`${API_BASE_URL}/api/users/login`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      
      login(response.data.access_token);
      navigate("/"); // Redirect to home page
    } catch (err) {
      setError(err.response?.data?.detail || "Login failed. Please check your credentials.");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // Step 1: Register the user (this part is correct)
      await axios.post(`${API_BASE_URL}/api/users/register`, {
        username: regUsername,
        email: regEmail,
        password: regPassword,
      });

      // Step 2: Automatically log the user in after successful registration
      const formData = new URLSearchParams();
      formData.append('username', regUsername);
      formData.append('password', regPassword);

      // --- THIS IS THE CORRECTED LINE ---
      // We must include the headers, just like in the handleLogin function.
      const response = await axios.post(`${API_BASE_URL}/api/users/login`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      
      // If the login is successful, this code will now run
      login(response.data.access_token);
      navigate("/");

    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed. Please try again.");
    }
  };

  const registerLink = (e) => { e.preventDefault(); setAction('active'); setError(''); };
  const loginLink = (e) => { e.preventDefault(); setAction(''); setError(''); };

  // The rest of your JSX remains exactly the same...
  return (
    <>
      <div className="login-wrapper">
        <div className={`wrapper ${action}`}>
          <div className="form-box login">
            <form onSubmit={handleLogin}>
              <h1>Login</h1>
              {error && action === '' && <p className="error-message">{error}</p>}
              <div className="input-box">
                <input type="text" placeholder="Username" required value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} />
                <FaUser className="icon" />
              </div>
              <div className="input-box">
                <input type="password" placeholder="Password" required value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                <FaLock className="icon" />
              </div>
              <button type="submit">Login</button>
              <div className="register-link">
                <p>Don't have an account? <a href="#" onClick={registerLink}>Register</a></p>
              </div>
            </form>
          </div>
          <div className="form-box register">
            <form onSubmit={handleRegister}>
              <h1>Registration</h1>
              {error && action === 'active' && <p className="error-message">{error}</p>}
              <div className="input-box">
                <input type="text" placeholder="Username" required value={regUsername} onChange={(e) => setRegUsername(e.target.value)} />
                <FaUser className="icon" />
              </div>
              <div className="input-box">
                <input type="email" placeholder="Email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                <FaEnvelope className="icon" />
              </div>
              <div className="input-box">
                <input type="password" placeholder="Password" required value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
                <FaLock className="icon" />
              </div>
              <button type="submit">Register</button>
              <div className="register-link">
                <p>Already have an account? <a href="#" onClick={loginLink}>Login</a></p>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="footer"><h2>NutriScan </h2></div>
    </>
  );
};