# ======================================================================
#  FINAL, COMPLETE & SECURE main.py
#  (Integrates User Authentication with All Application Features)
# ======================================================================

# --- Standard Library Imports ---
import os
import sqlite3
import random
import uuid
import pandas as pd
import numpy as np
import httpx
import tensorflow as tf
from PIL import Image
from io import BytesIO
from datetime import datetime, timedelta
import calendar
from typing import List, Annotated
from enum import Enum

# --- FastAPI & Pydantic Imports ---
from fastapi import Depends, FastAPI, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv

# --- Security & Authentication Imports ---
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

# ======================================================
#  1. CONFIGURATION & INITIALIZATION
# ======================================================

load_dotenv()

# --- Security Configuration ---
SECRET_KEY = os.getenv("SECRET_KEY", "a_very_strong_secret_key_for_jwt_in_development")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # Token expires in 1 day
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/users/login")

# --- AI Model Loading ---
print("Loading Keras AI model...")
model = None
class_labels = []
try:
    model = tf.keras.models.load_model('keras_model.h5', compile=False)
    with open('labels.txt', 'r') as f:
        class_labels = [line.strip().split(' ', 1)[1] for line in f]
    print("AI Model and labels loaded successfully.")
except IOError:
    print("\nERROR: Could not find 'keras_model.h5' or 'labels.txt'. Image recognition will fail.\n")

# --- Pexels API Configuration ---
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")

# ======================================================
#  2. HELPER FUNCTIONS (Security & Core Logic)
# ======================================================

def verify_password(plain_password, hashed_password): return pwd_context.verify(plain_password, hashed_password)
def get_password_hash(password): return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_db():
    db = sqlite3.connect('my_nutrition.db', check_same_thread=False); db.row_factory = sqlite3.Row
    try: yield db
    finally: db.close()

def calculate_daily_calorie_goal(profile: dict) -> float:
    if not all(k in profile and profile[k] is not None for k in ['age', 'weight', 'height', 'sex', 'activity_level']):
        return 0
    if profile['sex'] == 'male':
        bmr = (10 * profile['weight']) + (6.25 * profile['height']) - (5 * profile['age']) + 5
    else:
        bmr = (10 * profile['weight']) + (6.25 * profile['height']) - (5 * profile['age']) - 161
    activity_factors = {'sedentary': 1.2, 'light': 1.375, 'moderate': 1.55, 'active': 1.725, 'very_active': 1.9}
    return round(bmr * activity_factors.get(profile['activity_level'], 1.2))

async def get_food_image_url(food_name: str):
    if not PEXELS_API_KEY: return None
    headers = {"Authorization": PEXELS_API_KEY}
    params = {"query": food_name, "per_page": 1, "size": "medium"}
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get("https://api.pexels.com/v1/search", headers=headers, params=params)
            r.raise_for_status()
            if r.json()['photos']: return r.json()['photos'][0]['src']['medium']
        except Exception as e: print(f"Pexels API error: {e}")
    return None


# ======================================================
#  3. PYDANTIC MODELS (Complete Set)
# ======================================================

class UserBase(BaseModel): username: str; email: EmailStr
class UserCreate(UserBase): password: str
class UserUpdate(BaseModel): age: int | None = None; weight: float | None = None; height: float | None = None; sex: str | None = None; activity_level: str | None = None
class UserInDB(UserBase, UserUpdate):
    id: int
    class Config: from_attributes = True
class Token(BaseModel): access_token: str; token_type: str
class TokenData(BaseModel): username: str | None = None

class FoodResponse(BaseModel): name: str; calories: float; protein: float; carbs: float; fat: float; sodium: float; cholesterol: float; image_url: str | None = None
class LoggedItem(BaseModel): id: int; log_date: str; food_name: str; calories: float; protein: float; carbs: float; fat: float
class DailyLogResponse(BaseModel): items: List[LoggedItem]; total_calories: float
class TipsResponse(BaseModel): tips: list[str]

class WeeklySummaryRequest(BaseModel): date_str: str
class MonthlySummaryRequest(BaseModel): year: int; month: int
class CalorieAnalysisData(BaseModel): date: str; total_calories: float; excess_calories: float; calorie_goal: float
class WeeklySummaryResponse(BaseModel): data: List[CalorieAnalysisData]
class MonthlySummaryResponse(BaseModel): data: List[CalorieAnalysisData]

# ======================================================
#  4. AUTHENTICATION & USER DEPENDENCIES
# ======================================================

def get_user(db: sqlite3.Connection, username: str):
    return db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Annotated[sqlite3.Connection, Depends(get_db)]):
    credentials_exception = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None: raise credentials_exception
    except JWTError: raise credentials_exception
    user = get_user(db, username=username)
    if user is None: raise credentials_exception
    return user

# ======================================================
#  5. FASTAPI APP & ENDPOINTS
# ======================================================

app = FastAPI(title="NutriScan API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- User Management & Authentication ---
@app.post("/api/users/register", response_model=UserInDB, tags=["Authentication"])
def register_user(user: UserCreate, db: Annotated[sqlite3.Connection, Depends(get_db)]):
    if get_user(db, user.username): raise HTTPException(status_code=400, detail="Username already registered")
    if db.execute("SELECT id FROM users WHERE email = ?", (user.email,)).fetchone(): raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = get_password_hash(user.password)
    cursor = db.cursor()
    cursor.execute("INSERT INTO users (username, email, hashed_password) VALUES (?, ?, ?)", (user.username, user.email, hashed_password))
    db.commit()
    new_user = get_user(db, user.username)
    return dict(new_user)

@app.post("/api/users/login", response_model=Token, tags=["Authentication"])
async def login_for_access_token(form_data: Annotated[OAuth2PasswordRequestForm, Depends()], db: Annotated[sqlite3.Connection, Depends(get_db)]):
    user = get_user(db, form_data.username)
    if not user or not verify_password(form_data.password, user['hashed_password']):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    return {"access_token": create_access_token(data={"sub": user['username']}), "token_type": "bearer"}

@app.get("/api/users/me", response_model=UserInDB, tags=["User Profile"])
async def read_users_me(current_user: Annotated[dict, Depends(get_current_user)]):
    return dict(current_user)

@app.put("/api/users/me", response_model=UserInDB, tags=["User Profile"])
async def update_user_profile(profile_data: UserUpdate, current_user: Annotated[dict, Depends(get_current_user)], db: Annotated[sqlite3.Connection, Depends(get_db)]):
    update_data = profile_data.model_dump(exclude_unset=True)
    if not update_data: raise HTTPException(status_code=400, detail="No update data provided")
    set_clause = ", ".join([f"{key} = ?" for key in update_data.keys()])
    values = list(update_data.values()) + [current_user['id']]
    db.execute(f"UPDATE users SET {set_clause} WHERE id = ?", tuple(values))
    db.commit()
    updated_user = get_user(db, current_user['username'])
    return dict(updated_user)

# --- Public Endpoints (No login required) ---
@app.get("/api/food/search", response_model=FoodResponse, tags=["Food Data"])
async def search_food_by_text(q: str, db: Annotated[sqlite3.Connection, Depends(get_db)]):
    food_data = db.execute("SELECT * FROM foods WHERE name LIKE ? LIMIT 1", (f"%{q}%",)).fetchone()
    if not food_data: raise HTTPException(status_code=404, detail=f"Sorry, '{q}' was not found.")
    image_url = await get_food_image_url(food_data['name'])
    return dict(food_data, image_url=image_url)

@app.post("/api/food/identify", response_model=FoodResponse, tags=["Food Data"])
async def identify_food_by_image(db: Annotated[sqlite3.Connection, Depends(get_db)], file: UploadFile = File(...)):
    if model is None: raise HTTPException(status_code=500, detail="AI Model is not loaded.")
    image_bytes = await file.read()
    img = Image.open(BytesIO(image_bytes)).convert('RGB').resize((224, 224))
    img_array = (np.array(img, dtype=np.float32) / 127.5) - 1
    predictions = model.predict(np.expand_dims(img_array, axis=0))
    identified_food_name = class_labels[np.argmax(predictions[0])]
    food_data = db.execute("SELECT * FROM foods WHERE name LIKE ? LIMIT 1", (f"%{identified_food_name}%",)).fetchone()
    if not food_data: raise HTTPException(status_code=404, detail=f"AI identified '{identified_food_name}', but it's not in our database.")
    image_url = await get_food_image_url(food_data['name'])
    return dict(food_data, image_url=image_url)

@app.get("/api/tips/daily", response_model=TipsResponse, tags=["General"])
def get_daily_tips():
    NUTRITION_TIPS = [
        "Stay hydrated! Drink at least 8 glasses of water a day to keep your body functioning optimally.",
        "Eat a rainbow of fruits and vegetables. Different colors signify different nutrients and antioxidants.",
        "Incorporate lean proteins like chicken, fish, beans, and lentils into your diet to support muscle repair and growth.",
        "Don't skip breakfast. A balanced breakfast can kickstart your metabolism and provide energy for the day.",
        "Choose whole grains like oats, quinoa, and brown rice over refined grains for more fiber and nutrients.",
        "Limit processed foods. They are often high in sodium, unhealthy fats, and added sugars.",
        "Read nutrition labels to make informed choices about what you're eating.",
        "Practice mindful eating. Pay attention to your body's hunger and fullness cues.",
        "Include healthy fats from sources like avocados, nuts, seeds, and olive oil.",
        "Control your portion sizes to avoid overeating, even with healthy foods.",
        "Reduce your sugar intake. Be wary of sugary drinks, which are a major source of empty calories.",
        "Plan your meals for the week to ensure you have healthy options readily available.",
        "Use herbs and spices like turmeric, ginger, and garlic to flavor food instead of relying on excess salt.",
        "Bake, steam, or grill your food instead of deep-frying to reduce unhealthy fats and calories.",
        "Cook in larger batches (meal prep) to have healthy, homemade meals ready for busy days.",
        "Wash all fruits and vegetables thoroughly to remove pesticides and bacteria.",
        "Use a smaller plate. This simple psychological trick can help you naturally manage portion sizes.",
        "Make your own salad dressings using olive oil, vinegar, and herbs to avoid the hidden sugars in store-bought versions.",
        "Boost iron absorption from plant sources like spinach by pairing them with Vitamin C (e.g., a squeeze of lemon juice).",
        "Get your potassium from foods like bananas, sweet potatoes, and beans to help regulate blood pressure.",
        "Ensure adequate Vitamin D for calcium absorption by getting safe sun exposure or eating fortified foods.",
        "Magnesium is crucial for muscle and nerve function. Find it in dark leafy greens, nuts, and dark chocolate.",
        "Don't wait until you're thirsty to drink water; thirst is an early sign of dehydration.",
        "Eat your water! Incorporate hydrating foods like cucumber, watermelon, and celery into your diet.",
        "Start your day with a glass of water to rehydrate your body after a long night's sleep.",
        "Chew your food slowly and thoroughly. This aids digestion and gives your brain time to register fullness.",
        "Shop the perimeter of the grocery store first. This is where fresh, whole foods are typically located.",
        "Never go grocery shopping on an empty stomach to avoid impulse buys of unhealthy items.",
        "Practice the 80/20 rule: eat nutritious foods 80% of the time, and allow for less healthy treats 20% of the time.",
        "Get enough sleep. Lack of sleep can disrupt hunger hormones, making you crave high-calorie foods.",
        "Incorporate fermented foods like yogurt, kefir, or kimchi to support a healthy gut with beneficial probiotics.",
        "Eat fatty fish like salmon or mackerel at least twice a week for heart-healthy omega-3 fatty acids.",
        "A small square of dark chocolate (70% cocoa or higher) can provide antioxidants and improve heart health.",
        "Add a tablespoon of chia seeds or flaxseeds to your smoothie or oatmeal for a boost of fiber and omega-3s.",
        "Berries are low in sugar and high in antioxidants and fiber, making them an excellent fruit choice.",
        "Swap sugary breakfast cereals for oatmeal topped with fresh fruit and nuts.",
        "Replace sugary sodas and juices with sparkling water or unsweetened iced tea.",
        "Choose plain yogurt over flavored varieties and add your own fresh fruit to control the sugar content.",
        "A balanced plate should ideally be half vegetables/fruits, a quarter lean protein, and a quarter whole grains."
    ]

    random.shuffle(NUTRITION_TIPS)
    return {"tips": NUTRITION_TIPS[:6]}

# --- Secured Endpoints (Login required) ---
@app.post("/api/log", response_model=LoggedItem, tags=["Data Logging"])
def add_food_to_log(food_name: str, current_user: Annotated[dict, Depends(get_current_user)], db: Annotated[sqlite3.Connection, Depends(get_db)]):
    # --- THIS IS THE CORRECTED LINE ---
    # Use LIKE for a more flexible search
    food_data = db.execute("SELECT * FROM foods WHERE name LIKE ? LIMIT 1", (f"%{food_name}%",)).fetchone()
    
    if not food_data:
        raise HTTPException(status_code=404, detail=f"Could not find '{food_name}' to log it.")
    
    log_date = datetime.now().strftime('%Y-%m-%d')
    cursor = db.cursor()
    cursor.execute("INSERT INTO daily_log (user_id, log_date, food_name, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?, ?, ?)",
                   (current_user['id'], log_date, food_data['name'], food_data['calories'], food_data['protein'], food_data['carbs'], food_data['fat']))
    new_id = cursor.lastrowid
    db.commit()
    
    # Return a dictionary that matches the LoggedItem model
    return {
        "id": new_id, 
        "log_date": log_date, 
        "food_name": food_data['name'],
        "calories": food_data['calories'], 
        "protein": food_data['protein'],
        "carbs": food_data['carbs'], 
        "fat": food_data['fat']
    }

@app.get("/api/log/{log_date_str}", response_model=DailyLogResponse, tags=["Data Logging"])
def get_log_for_date(log_date_str: str, current_user: Annotated[dict, Depends(get_current_user)], db: Annotated[sqlite3.Connection, Depends(get_db)]):
    rows = db.execute("SELECT * FROM daily_log WHERE log_date = ? AND user_id = ?", (log_date_str, current_user['id'])).fetchall()
    items = [dict(row) for row in rows]
    return DailyLogResponse(items=items, total_calories=sum(item['calories'] for item in items))

@app.delete("/api/log/{log_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Data Logging"])
def delete_log_item(log_id: int, current_user: Annotated[dict, Depends(get_current_user)], db: Annotated[sqlite3.Connection, Depends(get_db)]):
    result = db.execute("DELETE FROM daily_log WHERE id = ? AND user_id = ?", (log_id, current_user['id']))
    db.commit()
    if result.rowcount == 0: raise HTTPException(status_code=404, detail="Log item not found or you do not have permission.")
    return

@app.post("/api/summary/weekly", response_model=WeeklySummaryResponse, tags=["Data Analysis"])
def get_weekly_summary(request: WeeklySummaryRequest, current_user: Annotated[dict, Depends(get_current_user)], db: Annotated[sqlite3.Connection, Depends(get_db)]):
    calorie_goal = calculate_daily_calorie_goal(dict(current_user))
    if calorie_goal == 0: return WeeklySummaryResponse(data=[])
    try: end_date = datetime.strptime(request.date_str, '%Y-%m-%d').date()
    except (ValueError, TypeError): raise HTTPException(status_code=400, detail="Invalid date format.")
    start_date = end_date - timedelta(days=6)
    date_range = [start_date + timedelta(days=x) for x in range(7)]
    results_dict = {day.strftime('%Y-%m-%d'): 0.0 for day in date_range}
    rows = db.execute("SELECT log_date, SUM(calories) as total FROM daily_log WHERE user_id = ? AND log_date BETWEEN ? AND ? GROUP BY log_date",
                      (current_user['id'], start_date, end_date)).fetchall()
    for row in rows: results_dict[row['log_date']] = row['total']
    final_data = [CalorieAnalysisData(date=dt, total_calories=tc, excess_calories=max(0, tc - calorie_goal), calorie_goal=calorie_goal) for dt, tc in results_dict.items()]
    return WeeklySummaryResponse(data=final_data)

@app.post("/api/summary/monthly", response_model=MonthlySummaryResponse, tags=["Data Analysis"])
def get_monthly_summary(request: MonthlySummaryRequest, current_user: Annotated[dict, Depends(get_current_user)], db: Annotated[sqlite3.Connection, Depends(get_db)]):
    calorie_goal = calculate_daily_calorie_goal(dict(current_user))
    if calorie_goal == 0: return MonthlySummaryResponse(data=[])
    try:
        _, num_days = calendar.monthrange(request.year, request.month)
        start_date = datetime(request.year, request.month, 1).date()
        end_date = datetime(request.year, request.month, num_days).date()
    except (ValueError, TypeError): raise HTTPException(status_code=400, detail="Invalid year or month.")
    
    date_range = [start_date + timedelta(days=x) for x in range(num_days)]
    results_dict = {day.strftime('%Y-%m-%d'): 0.0 for day in date_range}
    rows = db.execute("SELECT log_date, SUM(calories) as total FROM daily_log WHERE user_id = ? AND log_date BETWEEN ? AND ? GROUP BY log_date",
                      (current_user['id'], start_date, end_date)).fetchall()
    for row in rows: results_dict[row['log_date']] = row['total']
    final_data = [CalorieAnalysisData(date=dt, total_calories=tc, excess_calories=max(0, tc - calorie_goal), calorie_goal=calorie_goal) for dt, tc in results_dict.items()]
    return MonthlySummaryResponse(data=final_data)