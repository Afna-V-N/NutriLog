import os
import sqlite3
import pandas as pd

# --- Configuration ---
DB_NAME = 'my_nutrition.db'
CSV_FILENAME = 'nutrition_data.csv'

# ======================================================
#  Part 1: Initial Setup - Clean Slate & File Check
# ======================================================
print("--- Initializing Database Setup ---")

# Ensure a fresh start by deleting the old database if it exists
if os.path.exists(DB_NAME):
    os.remove(DB_NAME)
    print(f"Removed existing database '{DB_NAME}'.")

# Check if the necessary CSV file is present
if not os.path.exists(CSV_FILENAME):
    print(f"FATAL ERROR: Nutrition data file '{CSV_FILENAME}' not found. Please add it to the backend directory.")
    exit()

# Connect to the database (this will create a new empty file)
conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()
print(f"Created new database '{DB_NAME}'.")

# ======================================================
#  Part 2: Create Database Schema (Tables)
# ======================================================
print("\n--- Creating Table Schemas ---")

# --- Create the 'users' table for authentication and profile data ---
cursor.execute("""
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    age INTEGER,
    weight REAL,
    height REAL,
    sex TEXT,
    activity_level TEXT,
    password_reset_token TEXT,
    password_reset_expires TIMESTAMP
)
""")
print("Table 'users' created successfully.")

# --- Create the 'daily_log' table, linked to a specific user ---
cursor.execute("""
CREATE TABLE IF NOT EXISTS daily_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    log_date TEXT NOT NULL,
    food_name TEXT NOT NULL,
    calories REAL NOT NULL,
    protein REAL NOT NULL,
    carbs REAL NOT NULL,
    fat REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
)
""")
print("Table 'daily_log' created successfully.")

# Note: The 'foods' table will be created automatically by pandas in the next step.

# ======================================================
#  Part 3: Populate 'foods' Table from CSV
# ======================================================
print(f"\n--- Populating 'foods' table from '{CSV_FILENAME}' ---")

try:
    # Read the CSV data
    df = pd.read_csv(CSV_FILENAME)

    # Define the columns we want to use and their new, simpler names
    COLUMNS_TO_USE = {
        'Food_Item': 'name', 'Calories (kcal)': 'calories', 'Protein (g)': 'protein',
        'Carbohydrates (g)': 'carbs', 'Fat (g)': 'fat', 'Sodium (mg)': 'sodium',
        'Cholesterol (mg)': 'cholesterol'
    }
    df_selected = df[list(COLUMNS_TO_USE.keys())].copy()
    df_selected.rename(columns=COLUMNS_TO_USE, inplace=True)

    # Clean the data: convert to numbers, fill missing values with 0
    numeric_cols = ['calories', 'protein', 'carbs', 'fat', 'sodium', 'cholesterol']
    for col in numeric_cols:
        df_selected[col] = pd.to_numeric(df_selected[col], errors='coerce').fillna(0)

    # Clean the data: remove rows with no name and average out duplicates
    df_selected.dropna(subset=['name'], inplace=True)
    final_df = df_selected.groupby('name', as_index=False).mean()

    # Write the final, cleaned DataFrame to the 'foods' table in the database
    final_df.to_sql('foods', conn, if_exists='replace', index=False)
    
    print(f"Table 'foods' created and populated with {len(final_df)} unique items.")

except Exception as e:
    print(f"An error occurred during CSV processing: {e}")
    conn.close()
    exit()

# ======================================================
#  Part 4: Finalize
# ======================================================
conn.commit()
conn.close()
print("\n--- SUCCESS! Database setup is complete. ---")