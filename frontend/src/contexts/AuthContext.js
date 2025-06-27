import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API_BASE_URL = "http://127.0.0.1:8000";

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            if (token) {
                try {
                    const response = await axios.get(`${API_BASE_URL}/api/users/me`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    setUser(response.data);
                } catch (error) {
                    console.error("Session expired or token is invalid.", error);
                    logout(); // Clear invalid token if it exists
                }
            }
            setIsLoading(false);
        };
        fetchUser();
    }, [token]);

    const login = (newToken) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };
    
    const updateUserProfile = async (profileData) => {
        try {
            // Ensure only fields that can be updated are sent
            const dataToUpdate = {
                age: profileData.age,
                weight: profileData.weight,
                height: profileData.height,
                sex: profileData.sex,
                activity_level: profileData.activity_level,
            };
            const response = await axios.put(`${API_BASE_URL}/api/users/me`, dataToUpdate, {
                 headers: { 'Authorization': `Bearer ${token}` }
            });
            setUser(response.data); // Update user state with the new profile from backend
            return response.data;
        } catch(error) {
            console.error("Failed to update profile", error);
            throw error;
        }
    };

    const value = { user, token, isLoading, login, logout, updateUserProfile };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};