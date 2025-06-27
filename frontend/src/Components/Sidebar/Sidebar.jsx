import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Sidebar.css'; 
// Import your icons if you have them
// import { FaHome, FaPlus, FaBook, FaChartBar, FaLightbulb, FaSignOutAlt } from 'react-icons/fa';

const Sidebar = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login'); // Redirect to login page after logout
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h3>NutriScan</h3>
            </div>
            <nav className="sidebar-nav">
                <NavLink to="/" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                    {/* <FaHome /> */}
                    <span>Home</span>
                </NavLink>
                <NavLink to="/food-input" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                    {/* <FaPlus /> */}
                    <span>Food Input</span>
                </NavLink>
                <NavLink to="/daily-log" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                    {/* <FaBook /> */}
                    <span>Daily Log</span>
                </NavLink>
                <NavLink to="/summary" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                    {/* <FaChartBar /> */}
                    <span>Summary</span>
                </NavLink>
                <NavLink to="/tips" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                    {/* <FaLightbulb /> */}
                    <span>Tips</span>
                </NavLink>
            </nav>
            <div className="sidebar-footer">
                <button onClick={handleLogout} className="logout-button">
                    {/* <FaSignOutAlt /> */}
                    <span>Logout</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;