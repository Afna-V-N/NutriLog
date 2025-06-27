import React, { useEffect, useState } from "react";
import "./Tips.css";
import yourImage from "../Assets/ketogenic-low-carbs-diet-concept-ingredients-healthy-foods-selection-set-up-white-concrete-background_35641-4032.avif";

const Tips = () => {
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Correct backend API URL (FastAPI on port 8000)
    fetch("http://127.0.0.1:8000/api/tips/daily")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setTips(data.tips);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching tips:", error);
        setTips(["⚠️ Failed to load tips. Please check if the backend is running."]);
        setLoading(false);
      });
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundImage: `url(${yourImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "40px 20px",
      }}
    >
      <div className="tips-container">
        <h2>🌱 Daily Nutrition Tips</h2>
        {loading ? (
          <p className="loading">Loading tips...</p>
        ) : (
          <ul className="tips-list">
            {tips.map((tip, index) => (
              <li key={index} className="tip-item">
                <span className="tip-number">{index + 1}.</span> {tip}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Tips;
