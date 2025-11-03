import os
import json
import ollama
import pandas as pd
import numpy as np
from scipy.spatial.distance import cdist
from sentence_transformers import SentenceTransformer
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

# --- 1. INITIAL SETUP ---

app = Flask(__name__)
CORS(app)  # Allow React Native app to connect

# --- 2. GLOBAL VARIABLES & DATABASE PATHS ---

USER_PROFILE_FILE = "user_profile.json"
MEAL_LOGS_FILE = "meal_logs.json"
FOOD_DB_PATH = "knowledge/food_db.csv"
EXERCISE_DB_PATH = "knowledge/exercise_db.json"

# RAG components
embedding_model = None
food_db = None
food_embeddings = None
food_names = None
exercise_db = None

# --- 3. HELPER FUNCTIONS (File I/O) ---

def load_user_profile():
    """Loads the user's profile from the JSON file."""
    if os.path.exists(USER_PROFILE_FILE):
        with open(USER_PROFILE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"status": "new_user"} # Return status for onboarding

def save_user_profile(data):
    """Saves the user's profile to the JSON file."""
    with open(USER_PROFILE_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def load_meal_logs():
    """Loads all meal logs."""
    if os.path.exists(MEAL_LOGS_FILE):
        with open(MEAL_LOGS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {} # Return empty dict if no logs

def save_meal_logs(logs):
    """Saves all meal logs."""
    with open(MEAL_LOGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(logs, f, ensure_ascii=False, indent=4)

def add_meal_to_log(meal_entry):
    """Adds a single meal entry to today's log."""
    logs = load_meal_logs()
    today = datetime.now().strftime('%Y-%m-%d')
    if today not in logs:
        logs[today] = []
    logs[today].append(meal_entry)
    save_meal_logs(logs)

def get_today_macros():
    """Calculates the sum of macros for today."""
    logs = load_meal_logs()
    today = datetime.now().strftime('%Y-%m-%d')
    today_logs = logs.get(today, [])

    total_macros = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
    for meal in today_logs:
        for key in total_macros:
            total_macros[key] += meal["macros"].get(key, 0)

    # Round to 2 decimal places
    for key in total_macros:
        total_macros[key] = round(total_macros[key], 2)

    return total_macros

# --- 4. RAG SETUP ---

def setup_rag_pipeline():
    """Loads all databases and creates embeddings."""
    global embedding_model, food_db, food_embeddings, food_names, exercise_db

    try:
        # 1. Load Embedding Model
        model_name = 'jhgan/ko-sbert-nli'
        embedding_model = SentenceTransformer(model_name)
        print(f"🤖 Embedding model '{model_name}' loaded.")

        # 2. Load Food DB
        food_db = pd.read_csv(FOOD_DB_PATH)
        # Clean up and get food names
        food_names = food_db['식품명'].str.strip().tolist()
        print("⏳ Generating food DB embeddings... (This may take time)")
        food_embeddings = embedding_model.encode(food_names, convert_to_tensor=False)
        print(f"📄 Food DB loaded: {len(food_names)} items.")

        # 3. Load Exercise DB
        with open(EXERCISE_DB_PATH, 'r', encoding='utf-8') as f:
            exercise_db = json.load(f)
        print(f"🏋️ Exercise DB loaded: {len(exercise_db)} exercises.")

        print("✅ RAG pipeline is ready!")
        return True

    except Exception as e:
        print(f"Error loading RAG: {e}")
        return False

# --- 5. CORE AI FUNCTIONS ---

def find_food_in_db(food_name):
    """Finds the macros for a food item using RAG."""
    query_embedding = embedding_model.encode([food_name])
    distances = cdist(query_embedding, food_embeddings, "cosine")[0]
    best_match_index = np.argmin(distances)

    # Set a similarity threshold
    if distances[best_match_index] < 0.4:
        food_data = food_db.iloc[best_match_index]
        return {
            "name": food_data["식품명"],
            "calories": food_data.get("에너지(kcal)", 0),
            "protein": food_data.get("단백질(g)", 0),
            "fat": food_data.get("지방(g)", 0),
            "carbs": food_data.get("탄수화물(g)", 0)
        }
    return None # Not found

def find_exercise_link(exercise_name):
    """Finds a YouTube link for an exercise."""
    for ex in exercise_db:
        if ex["name"].lower() in exercise_name.lower():
            return ex["youtube_link"]
    return None # Not found

def call_ollama(prompt):
    """Reusable function to call the Ollama LLM."""
    try:
        response = ollama.chat(
            model='llama3',
            messages=[{'role': 'user', 'content': prompt}]
        )
        return response['message']['content']
    except Exception as e:
        print(f"Ollama error: {e}")
        return f"Ollama error: {e}"

def generate_plans_from_profile(profile):
    """Generates diet and workout plans based on the user profile."""
    profile_str = json.dumps(profile, ensure_ascii=False)
    prompt = f"""
    You are an expert fitness coach and nutritionist.
    A user has the following profile:
    {profile_str}

    Based ONLY on this profile, generate a complete, personalized plan.
    Your response MUST be in this exact JSON format:
    {{
      "diet_plan": {{
        "daily_calories_goal": <number>,
        "daily_protein_goal_g": <number>,
        "daily_carbs_goal_g": <number>,
        "daily_fat_goal_g": <number>,
        "notes": "<A 2-3 sentence summary of the diet strategy>"
      }},
      "workout_plan": [
        {{
          "day": "Day 1 - Push",
          "exercises": [
            {{ "name": "Barbell Bench Press", "sets_reps": "3 sets of 8-10 reps" }},
            {{ "name": "Overhead Press", "sets_reps": "3 sets of 10-12 reps" }},
            {{ "name": "Push-up", "sets_reps": "3 sets to failure" }}
          ]
        }},
        {{
          "day": "Day 2 - Pull",
          "exercises": [
            {{ "name": "Deadlift", "sets_reps": "3 sets of 5 reps" }},
            {{ "name": "Pull-up", "sets_reps": "3 sets of 8-10 reps" }},
            {{ "name": "Dumbbell Row", "sets_reps": "3 sets of 10-12 reps" }}
          ]
        }}
      ]
    }}
    """

    response_str = call_ollama(prompt)

    try:
        plan_data = json.loads(response_str)
        # Add YouTube links to the plan
        for day_plan in plan_data.get("workout_plan", []):
            for ex in day_plan.get("exercises", []):
                ex["youtube_link"] = find_exercise_link(ex["name"])

        return plan_data
    except json.JSONDecodeError:
        print(f"Error decoding LLM response: {response_str}")
        return {"error": "Failed to generate plan. AI returned invalid format."}

# --- 6. FLASK API ENDPOINTS ---

@app.route("/check_status", methods=["GET"])
def check_status():
    """Called when the app first loads to check if user is new."""
    profile = load_user_profile()
    return jsonify(profile)

@app.route("/save_profile", methods=["POST"])
def save_profile():
    """Saves the user's initial profile data."""
    data = request.json
    data["status"] = "active_user" # Mark onboarding as complete
    save_user_profile(data)

    # Generate initial plans
    plans = generate_plans_from_profile(data)
    profile = load_user_profile()
    profile["plans"] = plans
    save_user_profile(profile)

    return jsonify(profile)

@app.route("/chat", methods=["POST"])
def chat():
    """Main chat endpoint. Handles meal logging, profile updates, and Q&A."""
    data = request.json
    message = data.get("message", "").lower()
    profile = load_user_profile()

    # --- Intent 1: Profile Update ---
    if "update" in message or "업데이트" in message:
        # Use LLM to understand the update request
        prompt = f"""
        Analyze the user's message and extract the profile key and new value.
        User message: "{message}"
        Your response MUST be in this exact JSON format: {{"key": "<profile_key>", "value": "<new_value>"}}
        Example: {{"key": "weight_kg", "value": "78"}}
        """
        update_data_str = call_ollama(prompt)
        try:
            update_data = json.loads(update_data_str)
            key = update_data.get("key")
            value = update_data.get("value")

            if key and key in profile:
                profile[key] = value
                # Re-generate plans with new data
                new_plans = generate_plans_from_profile(profile)
                profile["plans"] = new_plans
                save_user_profile(profile)
                return jsonify({
                    "response": f"Your profile has been updated ({key}: {value}). I've regenerated your plans. Check the 'Plan' tab!",
                    "profile": profile
                })
            else:
                return jsonify({"response": "I understood you want to update, but I couldn't find the right field. Please try again."})
        except Exception:
            return jsonify({"response": "I had trouble understanding that update. Please be more specific, e.g., 'Update my weight to 78kg'."})

    # --- Intent 2: Meal Logging ---
    # A simple check: if the message contains 'g' or 'gram', assume it's a meal.
    if 'g' in message or '그램' in message:
        # Use LLM to extract food and weight
        prompt = f"""
        Extract the food name and weight in grams from the user's message.
        User message: "{message}"
        Your response MUST be in this exact JSON format: {{"food": "<food_name>", "weight": <number_in_grams>}}
        """
        meal_data_str = call_ollama(prompt)
        try:
            meal_data = json.loads(meal_data_str)
            food_name = meal_data.get("food")
            weight = float(meal_data.get("weight", 0))

            if not food_name or weight == 0:
                return jsonify({"response": "I didn't quite catch the food name or weight. Please try again (e.g., '김치찌개 300g')."})

            # Find food in RAG database
            food_info = find_food_in_db(food_name)

            if food_info:
                # Calculate macros
                macros = {
                    "calories": round((food_info["calories"] / 100) * weight, 2),
                    "protein": round((food_info["protein"] / 100) * weight, 2),
                    "carbs": round((food_info["carbs"] / 100) * weight, 2),
                    "fat": round((food_info["fat"] / 100) * weight, 2),
                }

                # Save the meal
                meal_entry = {
                    "time": datetime.now().strftime('%H:%M'),
                    "name": food_info["name"],
                    "weight": weight,
                    "macros": macros
                }
                add_meal_to_log(meal_entry)

                return jsonify({
                    "response": f"Logged: {weight}g of {food_info['name']} ({macros['calories']} kcal). Great job!",
                    "daily_summary": get_today_macros() # Send back the new total
                })
            else:
                # Food not found - ingredient fallback
                return jsonify({
                    "response": f"I don't have '{food_name}' in my database. Can you tell me the main ingredients?"
                    # In a full app, you'd handle the ingredient response here.
                })

        except Exception:
            return jsonify({"response": "I had trouble logging that. Please use the format 'Food Name, Weight' (e.g., '닭가슴살 200g')."})

    # --- Intent 3: General Q&A ---
    else:
        prompt = f"""
        You are PocketCoach, an expert fitness AI. A user is asking you a general question.
        User's Profile: {json.dumps(profile, ensure_ascii=False)}
        Question: "{message}"
        
        Answer the question in a friendly, concise, and supportive way.
        """
        answer = call_ollama(prompt)
        return jsonify({"response": answer})


@app.route("/get_summary", methods=["GET"])
def get_summary():
    """Called to get the daily macro summary for the table."""
    profile = load_user_profile()
    daily_total = get_today_macros()
    plan_goals = profile.get("plans", {}).get("diet_plan", {})

    summary = {
        "total": daily_total,
        "goal": {
            "calories": plan_goals.get("daily_calories_goal", 0),
            "protein": plan_goals.get("daily_protein_goal_g", 0),
            "carbs": plan_goals.get("daily_carbs_goal_g", 0),
            "fat": plan_goals.get("daily_fat_goal_g", 0),
        }
    }
    return jsonify(summary)


# --- 7. MAIN EXECUTION ---

if __name__ == "__main__":
    if setup_rag_pipeline():
        print("🚀 Starting PocketCoach server at http://0.0.0.0:5000")
        app.run(host="0.0.0.0", port=5000, debug=False)
    else:
        print("Failed to start server. Check for 'knowledge' folder and DB files.")

