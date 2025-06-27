import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './HomeContent.css'; // This will use the corrected CSS file below
import bg from "../Assets/ketogenic-low-carbs-diet-concept-ingredients-healthy-foods-selection-set-up-white-concrete-background_35641-4032.avif";

const API_BASE_URL = "http://127.0.0.1:8000";

// Helper function to calculate recommendations
const calculateRecommendations = (profile) => {
    if (!profile || !profile.age || !profile.weight || !profile.height) {
        return { tdee: 0, protein: 0, carbs: 0, fats: 0, water: 0 };
    }
    let bmr = (profile.sex === 'male')
        ? (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age) + 5
        : (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age) - 161;
    const activityFactors = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
    const tdee = Math.round(bmr * activityFactors[profile.activity_level]);
    const protein = Math.round((tdee * 0.30) / 4);
    const carbs = Math.round((tdee * 0.40) / 4);
    const fats = Math.round((tdee * 0.30) / 9);
    const water = Math.round(profile.weight * 35);
    return { tdee, protein, carbs, fats, water };
};


export default function HomeContent() {
    const navigate = useNavigate();
    const { user, updateUserProfile } = useAuth();

    // This local state manages the form for a smooth UX, populated by the global user state
    const [localProfile, setLocalProfile] = useState({ age: '', weight: '', height: '', sex: 'male', activity_level: 'light' });
    const [recommendations, setRecommendations] = useState({});
    const [caloriesConsumed, setCaloriesConsumed] = useState(0);
    const [mealsLogged, setMealsLogged] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Effect to populate the form with the user's data when the page loads or user changes
    useEffect(() => {
        if (user) {
            setLocalProfile({
                age: user.age || '',
                weight: user.weight || '',
                height: user.height || '',
                sex: user.sex || 'male',
                activity_level: user.activity_level || 'light',
            });
        }
    }, [user]);
    
    // Effect to save changes to the backend after the user stops typing
    useEffect(() => {
        const handler = setTimeout(async () => {
            if (user && localProfile.age && localProfile.weight && localProfile.height) {
                // Check if there is an actual change to save
                if (localProfile.age !== user.age || localProfile.weight !== user.weight || localProfile.height !== user.height || localProfile.sex !== user.sex || localProfile.activity_level !== user.activity_level) {
                   await updateUserProfile(localProfile);
                }
            }
        }, 1500); // Wait 1.5 seconds after user stops typing before saving
        return () => clearTimeout(handler);
    }, [localProfile, user, updateUserProfile]);

    // Effect to recalculate the recommendations card whenever the form changes
    useEffect(() => {
        const newRecs = calculateRecommendations(localProfile);
        setRecommendations(newRecs);
    }, [localProfile]);
    
    // Effect to fetch the daily log data
    useEffect(() => {
        const fetchLogData = async () => {
            const today = new Date().toISOString().split('T')[0];
            const token = localStorage.getItem('token');
            if (!token) { setIsLoading(false); return; }

            try {
                const response = await fetch(`${API_BASE_URL}/api/log/${today}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setCaloriesConsumed(data.total_calories);
                    setMealsLogged(data.items.length);
                }
            } catch (error) { console.error("Failed to fetch daily log:", error); } 
            finally { setIsLoading(false); }
        };
        fetchLogData();
    }, []);

    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        setLocalProfile(prev => ({ ...prev, [name]: value }));
    };

    const isProfileComplete = localProfile.age && localProfile.weight && localProfile.height;

    return (
        <div className="home-container" style={{ backgroundImage: `url(${bg})` }}>
            <h1>Greetings , {user?.username || 'friend'}!</h1>
            <p>Welcome back to NutriScan. Here’s your current progress:</p>

            <section className="input-section">
                <label>Weight (kg): <input type="number" name="weight" value={localProfile.weight} onChange={handleProfileChange} /></label>
                <label>Height (cm): <input type="number" name="height" value={localProfile.height} onChange={handleProfileChange} /></label>
                <label>Age (years): <input type="number" name="age" value={localProfile.age} onChange={handleProfileChange} /></label>
                <label>Sex:
                    <select name="sex" value={localProfile.sex} onChange={handleProfileChange}>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                    </select>
                </label>
                <label>Activity Level:
                    <select name="activity_level" value={localProfile.activity_level} onChange={handleProfileChange}>
                        <option value="sedentary">Sedentary</option>
                        <option value="light">Light</option>
                        <option value="moderate">Moderate</option>
                        <option value="active">Active</option>
                        <option value="very_active">Very Active</option>
                    </select>
                </label>
            </section>

            <section className="status-cards">
                <div className="status-card" onClick={() => navigate("/summary")}>
                    <h2>🍔 Calories Today</h2>
                    <p className="status-number">{isLoading ? "..." : `${caloriesConsumed.toFixed(0)} kcal`}</p>
                    <progress value={caloriesConsumed} max={recommendations.tdee > 0 ? recommendations.tdee : 1} />
                    <small>{recommendations.tdee > 0 ? `${Math.round((caloriesConsumed / recommendations.tdee) * 100)}% of daily goal` : 'Set profile for goal'}</small>
                </div>
                <div className="status-card" onClick={() => navigate("/daily-log")}>
                    <h2>📋 Meals Logged</h2>
                    <p className="status-number">{isLoading ? "..." : `${mealsLogged} meals`}</p>
                </div>
            </section>

            <section className="recommendation">
                <h3>🔍 Recommended Daily Intake</h3>
                {isProfileComplete ? (
                    <ul>
                        <li><strong>Total Calories🔥:</strong> {recommendations.tdee} kcal</li>
                        <li><strong>Protein💪:</strong> {recommendations.protein} g</li>
                        <li><strong>Carbohydrates🍞:</strong> {recommendations.carbs} g</li>
                        <li><strong>Fats🧈:</strong> {recommendations.fats} g</li>
                        <li><strong>Water💧:</strong> {recommendations.water} mL (~{(recommendations.water / 1000).toFixed(1)} L)</li>
                        <li><strong>Vitamins & Minerals:</strong> Include a variety of fruits & vegetables 🍎🥦</li>
                    </ul>
                ) : (
                    <p>Please enter your details above to see your recommendations.</p>
                )}
            </section>
            
            <nav className="quick-links">
                <h3>Quick Actions</h3>
                <div className="link-buttons">
                    <button onClick={() => navigate("/daily-log")} className="quick-btn">➕ Log Meal</button>
                    <button onClick={() => navigate("/summary")} className="quick-btn">📊 View Summary</button>
                </div>
            </nav>
        </div>
    );
}