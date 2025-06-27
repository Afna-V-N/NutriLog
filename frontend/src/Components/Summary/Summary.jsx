import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import DatePicker from 'react-datepicker';
import { useAuth } from '../../contexts/AuthContext';
import "react-datepicker/dist/react-datepicker.css";
import './Summary.css';

const API_BASE_URL = 'http://127.0.0.1:8000';
const formatDate = (date) => date.toISOString().split('T')[0];

export default function Summary() {
    const { user, token } = useAuth();
    
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [dailyData, setDailyData] = useState([]);
    const [weeklyData, setWeeklyData] = useState([]);
    const [monthlyData, setMonthlyData] = useState([]);
    const [calorieGoal, setCalorieGoal] = useState(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const isProfileComplete = user && user.age && user.weight && user.height;

    const fetchChartData = useCallback(async () => {
        if (!isProfileComplete || !token) { setIsLoading(false); return; }
        setIsLoading(true);
        setError('');
        const dateStr = formatDate(selectedDate);
        const authHeaders = { headers: { 'Authorization': `Bearer ${token}` } };
        
        try {
            const [dailyRes, weeklyRes, monthlyRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/log/${dateStr}`, authHeaders),
                axios.post(`${API_BASE_URL}/api/summary/weekly`, { date_str: dateStr }, authHeaders),
                axios.post(`${API_BASE_URL}/api/summary/monthly`, { year: selectedDate.getFullYear(), month: selectedDate.getMonth() + 1 }, authHeaders)
            ]);
            setDailyData(dailyRes.data.items || []);
            const processData = (data) => data.map(item => ({ ...item, base_calories: item.total_calories - item.excess_calories }));
            setWeeklyData(processData(weeklyRes.data.data || []));
            setMonthlyData(processData(monthlyRes.data.data || []));
            if (weeklyRes.data.data && weeklyRes.data.data.length > 0) {
                setCalorieGoal(weeklyRes.data.data[0].calorie_goal);
            }
        } catch (err) {
            if (!err.response || err.response.status !== 404) {
                 setError('Failed to load summary data.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate, isProfileComplete, token]);

    useEffect(() => {
        fetchChartData();
    }, [fetchChartData]);

    if (!isProfileComplete) {
        return (
            <div className="page-container">
                <div className="summary-prompt-container">
                    <h2>Complete Your Profile</h2>
                    <p>Please go to the Home page and enter your details to view your graphical analysis.</p>
                </div>
            </div>
        );
    }

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#8884d8'];

    return (
        <div className="page-container">
            {/* The main card now has a fixed height and an internal scroll */}
            <div className="summary-container">

                {/* --- This is the Non-Scrolling Header --- */}
                <div className="summary-header">
                    <h2 className="summary-title">📊 Graphical Analysis</h2>
                    <div className="controls-container">
                        <div className="date-picker-container">
                            <label>Select Date:</label>
                            <DatePicker selected={selectedDate} onChange={(date) => setSelectedDate(date)} />
                        </div>
                        {calorieGoal && (
                            <div className="goal-display">
                                Recommended Goal: {calorieGoal} kcal / day
                            </div>
                        )}
                    </div>
                </div>

                {/* --- This is the new Scrollable Area for all charts --- */}
                <div className="charts-area">
                     {error && <p className="error-message">{error}</p>}
                     {isLoading ? <p className="loading-message">Loading charts...</p> : (
                        <>
                            <div className="chart-container">
                                <h3>Daily Breakdown ({formatDate(selectedDate)})</h3>
                                {dailyData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={350}>
                                        <PieChart>
                                            <Pie data={dailyData} dataKey="calories" nameKey="food_name" cx="50%" cy="50%" outerRadius={120} labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                                {dailyData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(value) => `${Math.round(value)} kcal`} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : <p className="no-data-message">No food logged for this day.</p>}
                            </div>

                            <div className="chart-container">
                                <h3>Weekly Analysis</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={weeklyData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tickFormatter={(tick) => tick.substring(5)} />
                                        <YAxis />
                                        <Tooltip formatter={(value) => `${Math.round(value)} kcal`} />
                                        <Legend />
                                        <ReferenceLine y={calorieGoal} label="Goal" stroke="#1abc9c" strokeDasharray="3 3" />
                                        <Bar dataKey="base_calories" stackId="a" fill="#3498db" name="Calories (Goal)" />
                                        <Bar dataKey="excess_calories" stackId="a" fill="#e74c3c" name="Excess Calories" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            
                            <div className="chart-container">
                                <h3>Monthly Analysis</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={monthlyData}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="date" tickFormatter={(tick) => tick.substring(8)} interval={1}/>
                                        <YAxis />
                                        <Tooltip formatter={(value) => `${Math.round(value)} kcal`}/>
                                        <Legend />
                                        <ReferenceLine y={calorieGoal} label="Goal" stroke="#1abc9c" strokeDasharray="3 3" />
                                        <Bar dataKey="base_calories" stackId="a" fill="#2ecc71" name="Calories (Goal)" />
                                        <Bar dataKey="excess_calories" stackId="a" fill="#e74c3c" name="Excess Calories" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};