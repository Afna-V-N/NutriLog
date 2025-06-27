import { useState } from "react";
import "./FoodInput.css";

export default function FoodInput() {
  const [query, setQuery] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const API_BASE_URL = "http://127.0.0.1:8000";

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setPreviewImage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/food/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error((await response.json()).detail);
      setResult(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setQuery("");
    setPreviewImage(URL.createObjectURL(file));
    setLoading(true);
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch(`${API_BASE_URL}/api/food/identify`, { method: "POST", body: formData });
      if (!response.ok) throw new Error((await response.json()).detail);
      setResult(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleKeyPress = (event) => event.key === 'Enter' && handleSearch();

  return (
    <div className="page-background">
      <div className="food-input-container">
        <h2>🍽️ Search Food</h2>
        <div className="input-group">
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyPress={handleKeyPress} placeholder="Search food by name" disabled={loading} />
          <button onClick={handleSearch} disabled={loading}>🔍 Search</button>
        </div>
        <p className="or-divider">or</p>
        <label htmlFor="file-upload" className={`file-upload-label ${loading ? 'disabled' : ''}`}>📷 Choose Image</label>
        <input id="file-upload" type="file" accept="image/*" onChange={handleImageUpload} disabled={loading} style={{ display: 'none' }}/>
        
        <div className="status-display">
          {loading && <p className="loading-text">Analyzing...</p>}
          {error && <p className="error-text">⚠️ {error}</p>}
          
          {result && (
            <div className="result-card">
              <img 
                src={result.image_url || previewImage || 'https://via.placeholder.com/400x250.png?text=No+Image+Available'} 
                alt={result.name} 
                className="result-image" 
              />
              <h3>{result.name}</h3>
              <div className="nutrients-grid">
                <p><strong>Calories:</strong> {result.calories.toFixed(0)} kcal</p>
                <p><strong>Protein:</strong> {result.protein.toFixed(1)} g</p>
                <p><strong>Fat:</strong> {result.fat.toFixed(1)} g</p>
                <p><strong>Carbs:</strong> {result.carbs.toFixed(1)} g</p>
                <p><strong>Sodium:</strong> {result.sodium.toFixed(0)} mg</p>
                <p><strong>Cholesterol:</strong> {result.cholesterol.toFixed(0)} mg</p>
              </div>
            </div>
          )}

          {!loading && !result && !error && (
            <p className="placeholder-text">Search or upload an image.</p>
          )}
        </div>
      </div>
    </div>
  );
}
