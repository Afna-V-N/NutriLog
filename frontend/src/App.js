import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from './contexts/AuthContext';

// --- Import all your page components ---
import { LoginRegister } from "./Components/LoginRegister/LoginRegister";
import Sidebar from "./Components/Sidebar/Sidebar";
import HomeContent from "./Components/HomeContent/HomeContent";
import FoodInput from "./Components/FoodInput/FoodInput";
import DailyLog from "./Components/DailyLog/DailyLog";
import Summary from "./Components/Summary/Summary";
import Tips from "./Components/Tips/Tips";

// --- Import the global stylesheet ---
// This line connects the CSS rules to your application.
import './App.css';

// --- This component protects routes that require a user to be logged in ---
const ProtectedRoute = ({ children }) => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        // You can add a more sophisticated loading spinner here later
        return <div>Loading Application...</div>;
    }

    return user ? children : <Navigate to="/login" />;
};

// --- This is the main layout of your app when logged in ---
// It now uses CSS classes instead of inline styles.
const AppLayout = () => {
    return (
        <div className="app-layout"> {/* <-- This class styles the flex container */}
            <Sidebar />
            <main className="main-content"> {/* <-- This class controls the background and content area */}
                <Routes>
                    <Route path="/" element={<HomeContent />} />
                    <Route path="/summary" element={<Summary />} />
                    <Route path="/food-input" element={<FoodInput />} />
                    <Route path="/daily-log" element={<DailyLog />} />
                    <Route path="/tips" element={<Tips />} />
                    
                    {/* A fallback route to redirect any unknown URL to the home page */}
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </main>
        </div>
    );
};

// --- The Main App Component ---
function App() {
  return (
    <Router>
        <Routes>
          {/* Public Route: Anyone can access the login page */}
          <Route path="/login" element={<LoginRegister />} />
          
          {/* Protected Routes: Wraps the entire main application layout */}
          <Route path="/*" element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          } />
        </Routes>
    </Router>
  );
}

export default App;