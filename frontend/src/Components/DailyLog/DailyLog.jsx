import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth to get token
import './DailyLog.css'; 

const API_BASE_URL = "http://127.0.0.1:8000";

export default function DailyLog() {
    const [logItems, setLogItems] = useState([]);
    const [foodName, setFoodName] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const { token } = useAuth(); 

    const today = new Date().toISOString().split('T')[0];

    // This function fetches the log data and is now "memoized" with useCallback
    const fetchLogData = useCallback(async () => {
        if (!token) {
            setError("You must be logged in to view your log.");
            setIsLoading(false);
            return;
        }
        try {
            setError('');
            const response = await axios.get(`${API_BASE_URL}/api/log/${today}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setLogItems(response.data.items || []);
        } catch (err) {
            console.error("Failed to fetch log data:", err);
            setError("Failed to fetch daily log. The server might be down.");
            // If the error is 404 (Not Found), it just means no logs for today, which is fine.
            if (err.response && err.response.status === 404) {
                setLogItems([]);
                setError('');
            }
        } finally {
            setIsLoading(false);
        }
    }, [today, token]);

    // Fetch data when the component first loads
    useEffect(() => {
        fetchLogData();
    }, [fetchLogData]);

    const handleAddLog = async (e) => {
        e.preventDefault();
        if (!foodName.trim()) {
            setError("Please enter a food name.");
            return;
        }
        if (!token) {
            setError("Authentication error. Please log in again.");
            return;
        }
        try {
            setError('');
            // The backend endpoint for adding a log is a POST request
            await axios.post(`${API_BASE_URL}/api/log?food_name=${encodeURIComponent(foodName)}`, {}, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setFoodName(''); // Clear the input field
            await fetchLogData(); // Refresh the log list
        } catch (err) {
            console.error("Failed to add log item:", err);
            setError(err.response?.data?.detail || "Could not add food item.");
        }
    };

    const handleDeleteLog = async (logId) => {
        if (!token) {
            setError("Authentication error. Please log in again.");
            return;
        }
        if (!window.confirm("Are you sure you want to delete this item?")) {
            return;
        }
        try {
            setError('');
            await axios.delete(`${API_BASE_URL}/api/log/${logId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            await fetchLogData(); // Refresh the log list
        } catch (err) {
            console.error("Failed to delete log item:", err);
            setError(err.response?.data?.detail || "Could not delete food item.");
        }
    };

    const totalCalories = logItems.reduce((sum, item) => sum + item.calories, 0);

    return (
        <div className="page-container">
            <div className="log-container">
                <h2>🗓️ Daily Food Log</h2>
                <p className="log-date">Today: {today}</p>

                <form className="log-input-form" onSubmit={handleAddLog}>
                    <input
                        type="text"
                        value={foodName}
                        onChange={(e) => setFoodName(e.target.value)}
                        placeholder="Enter food (e.g., Rice, Eggs)"
                    />
                    <button type="submit">➕ Add</button>
                </form>

                {error && <p className="log-error">⚠️ {error}</p>}

                <div className="log-items-section">
                    <h3>📄 Logged Items:</h3>
                    {isLoading ? (
                        <p>Loading log...</p>
                    ) : logItems.length > 0 ? (
                        <ul className="log-list">
                            {logItems.map(item => (
                                <li key={item.id} className="log-item">
                                    <div className="log-item-details">
                                        <span>{item.food_name}</span>
                                    </div>
                                    <span className="log-item-calories">{item.calories.toFixed(0)} kcal</span>
                                    <button onClick={() => handleDeleteLog(item.id)} className="delete-btn">
                                        ×
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No items logged yet.</p>
                    )}
                </div>

                <div className="total-calories">
                    <h3>🔥 Total Calories: {totalCalories.toFixed(0)} kcal</h3>
                </div>
            </div>
        </div>
    );
}