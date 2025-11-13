import os
import json
import ollama
import pandas as pd
import numpy as np
import faiss
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import re
import math
import glob
import pypdf  # --- NEW: Using pypdf instead of fitz
from sentence_transformers import SentenceTransformer

# --- 1. INITIAL SETUP ---
app = Flask(__name__)
CORS(app)

# --- 2. GLOBAL VARIABLES & DATABASE PATHS ---
USER_PROFILE_FILE = "user_profile.json"
MEAL_LOGS_FILE = "meal_logs.json"
KNOWLEDGE_DIR = "knowledge"
FOOD_DB_PATH = os.path.join(KNOWLEDGE_DIR, "master_food_db.csv")
EXERCISE_DB_PATH = os.path.join(KNOWLEDGE_DIR, "exercise.json")

# RAG components
embedding_model = None

# Brain 1: For structured data (food/exercises)
food_exercise_index = None
food_exercise_data = []

# Brain 2: For unstructured knowledge (PDFs)
pdf_index = None
pdf_data = []


# --- 3. HELPER FUNCTIONS (File I/O & Calculations) ---
# (All these functions are unchanged)
def load_user_profile():
    if os.path.exists(USER_PROFILE_FILE):
        with open(USER_PROFILE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"status": "new_user"}

def save_user_profile(data):
    with open(USER_PROFILE_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

def load_meal_logs():
    if os.path.exists(MEAL_LOGS_FILE):
        with open(MEAL_LOGS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_meal_logs(logs):
    with open(MEAL_LOGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(logs, f, ensure_ascii=False, indent=4)

def add_meal_to_log(meal_entry, date_str):
    logs = load_meal_logs()
    if date_str not in logs:
        logs[date_str] = []
    logs[date_str].append(meal_entry)
    save_meal_logs(logs)

def get_macros_for_date(date_str):
    logs = load_meal_logs()
    date_logs = logs.get(date_str, [])
    total_macros = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
    for meal in date_logs:
        for key in total_macros:
            total_macros[key] += meal["macros"].get(key, 0)
    for key in total_macros:
        total_macros[key] = round(total_macros[key], 2)
    return total_macros

def calculate_bmi(weight_kg, height_cm):
    try:
        w = float(weight_kg)
        h = float(height_cm) / 100
        if w > 0 and h > 0:
            bmi = w / (h * h)
            return round(bmi, 1)
    except Exception: return 0
    return 0

def calculate_bfp_us_navy(gender, height_cm, waist_cm, neck_cm):
    try:
        h = float(height_cm)
        w = float(waist_cm)
        n = float(neck_cm)
        if gender.lower() == 'male':
            bfp = 495 / (1.0324 - 0.19077 * math.log10(w - n) + 0.15456 * math.log10(h)) - 450
        else: # female
            bfp = 495 / (1.0324 - 0.19077 * math.log10(w - n) + 0.15456 * math.log10(h)) - 450
        return round(bfp, 1)
    except Exception: return 0
    return 0

def calculate_tdee(profile):
    """Calculates TDEE using Mifflin-St Jeor BMR and activity level."""
    try:
        weight_kg = float(profile.get("weight_kg", 0))
        height_cm = float(profile.get("height_cm", 0))
        age = int(profile.get("age", 0))
        gender = profile.get("gender", "male").lower()
        activity_level = profile.get("activity_level", "low").lower()

        if weight_kg == 0 or height_cm == 0 or age == 0:
            print("⚠️ Warning: Incomplete profile data, defaulting TDEE to 2000.")
            return 2000 # Return a safe default

        # 1. Calculate BMR (Mifflin-St Jeor)
        if gender == 'male':
            bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
        else: # 'female'
            bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161

        # 2. Get Activity Multiplier
        if activity_level == 'high':
            multiplier = 1.9
        elif activity_level == 'moderate':
            multiplier = 1.55
        else: # 'low'
            multiplier = 1.2

        # 3. Calculate TDEE (Maintenance Calories)
        tdee = bmr * multiplier
        return int(round(tdee, 0))
    except Exception as e:
        print(f"❌ Error in calculate_TDEE: {e}")
        return 2000 # Safe default


# --- 4. RAG SETUP (UPDATED) ---

def setup_rag_pipeline():
    global embedding_model, food_exercise_index, food_exercise_data, pdf_index, pdf_data

    try:
        model_name = 'jhgan/ko-sbert-nli'
        embedding_model = SentenceTransformer(model_name)
        print(f"🤖 Embedding model '{model_name}' loaded.")
        embedding_dimension = embedding_model.get_sentence_embedding_dimension()

        # --- Brain 1: Load Food & Exercise Data ---
        food_exercise_texts = []

        # Load Food DB
        food_db_df = pd.read_csv(FOOD_DB_PATH, encoding='cp949')
        for index, row in food_db_df.iterrows():
            text = row['식품명'].strip()
            food_exercise_texts.append(text)
            food_exercise_data.append({"type": "food", "data": row.to_dict()})
        print(f"📄 Food DB loaded: {len(food_db_df)} items.")

        # Load Exercise DB
        with open(EXERCISE_DB_PATH, 'r', encoding='utf-8') as f:
            exercise_list = json.load(f)
        for ex in exercise_list:
            text = f"{ex['name']} (Targets: {ex.get('target-muscle', 'N/A')})"
            food_exercise_texts.append(text)
            food_exercise_data.append({"type": "exercise", "data": ex})
        print(f"🏋️ Exercise DB loaded: {len(exercise_list)} exercises.")

        # Build FAISS index for Brain 1
        print("⏳ Generating food/exercise embeddings...")
        food_exercise_embeddings = embedding_model.encode(food_exercise_texts,
                                                          convert_to_tensor=False,
                                                          show_progress_bar=True).astype('float32')
        food_exercise_index = faiss.IndexFlatL2(embedding_dimension)
        food_exercise_index.add(food_exercise_embeddings)
        print("✅ Food/Exercise RAG (Brain 1) is ready.")

        # --- Brain 2: Load PDF Knowledge (USING pypdf) ---
        pdf_texts = []
        pdf_files = glob.glob(os.path.join(KNOWLEDGE_DIR, "*.pdf"))
        print(f"📚 Found {len(pdf_files)} PDF files to process...")

        for pdf_path in pdf_files:
            try:
                # --- NEW PYPDF CODE ---
                reader = pypdf.PdfReader(pdf_path)
                for page_num, page in enumerate(reader.pages):
                    text = page.extract_text()
                    if not text:
                        print(f"⚠️ Warning: Could not extract text from {os.path.basename(pdf_path)} page {page_num + 1}")
                        continue

                    chunks = re.split(r'\n\s*\n', text)
                    for chunk in chunks:
                        chunk_cleaned = chunk.strip().replace('\n', ' ')
                        if len(chunk_cleaned) > 150:
                            pdf_texts.append(chunk_cleaned)
                            pdf_data.append({"text": chunk_cleaned, "source": f"{os.path.basename(pdf_path)}"})
                # --- END OF NEW PYPDF CODE ---
                print(f"🧠 Successfully processed PDF: {os.path.basename(pdf_path)}")
            except Exception as e:
                print(f"❌ Error processing PDF {pdf_path}: {e}")

        if pdf_texts:
            # Build FAISS index for Brain 2
            print("⏳ Generating PDF knowledge embeddings...")
            pdf_embeddings = embedding_model.encode(pdf_texts,
                                                    convert_to_tensor=False,
                                                    show_progress_bar=True).astype('float32')
            pdf_index = faiss.IndexFlatL2(embedding_dimension)
            pdf_index.add(pdf_embeddings)
            print("✅ PDF Knowledge RAG (Brain 2) is ready.")
        else:
            print("⚠️ No PDFs found. Knowledge brain (Brain 2) is empty.")

        return True

    except Exception as e:
        print(f"❌ Error during RAG setup: {e}")
        return False

# --- 5. CORE AI FUNCTIONS (UPDATED) ---

def find_food_data(food_name_query):
    """Finds food data using RAG Brain 1 (FAISS)."""
    query_embedding = embedding_model.encode([food_name_query]).astype('float32')
    D, I = food_exercise_index.search(query_embedding, k=1)
    best_match_index = I[0][0]
    best_match_score = D[0][0]
    best_match = food_exercise_data[best_match_index]

    if best_match["type"] == "food" and best_match_score < 1.0:
        food_data = best_match["data"]
        return {
            "name": food_data["식품명"],
            "calories": float(food_data.get("에너지(kcal)", 0) or 0),
            "protein": float(food_data.get("단백질(g)", 0) or 0),
            "fat": float(food_data.get("지방(g)", 0) or 0),
            "carbs": float(food_data.get("탄수화물(g)", 0) or 0),
            "quantity": float(food_data.get("영양성분함량기준량", 100) or 100)
        }
    return None

def find_exercise_data(exercise_name_query):
    """Finds exercise data using RAG Brain 1 (FAISS)."""
    query_embedding = embedding_model.encode([exercise_name_query]).astype('float32')
    D, I = food_exercise_index.search(query_embedding, k=1)
    best_match_index = I[0][0]
    best_match_score = D[0][0]
    best_match = food_exercise_data[best_match_index]

    if best_match["type"] == "exercise" and best_match_score < 1.0:
        return best_match["data"]
    return None

def find_knowledge_from_pdfs(question):
    """Finds knowledge chunks from PDF RAG Brain 2."""
    if not pdf_index or pdf_index.ntotal == 0:
        return "I'm sorry, my knowledge base isn't loaded. I can only help with logging."

    query_embedding = embedding_model.encode([question]).astype('float32')
    D, I = pdf_index.search(query_embedding, k=3)

    context = ""
    for idx, i in enumerate(I[0]):
        # Only add if the chunk is relevant (lower score is better)
        if D[0][idx] < 1.2:
            context += pdf_data[i]["text"] + f"\n(Source: {pdf_data[i]['source']})\n---\n"

    if not context:
        return "I found some information, but I'm not confident it's relevant to your question."

    return context

def call_ollama(prompt):
    try:
        response = ollama.chat(
            model='exaone3.5:2.4b',
            messages=[{'role': 'user', 'content': prompt}]
        )
        return response['message']['content']
    except Exception as e:
        print(f"Ollama error: {e}")
        return f"Ollama error: {e}"

def generate_plans_from_profile(profile):
    goal = profile.get('goal')

    # --- START: NEW TDEE AND GOAL CALCULATION ---
    maintenance_calories = calculate_tdee(profile)
    target_calories = 0
    strategy = ""
    knowledge_query = ""

    if goal == 'weight_loss':
        target_calories = maintenance_calories - 500
        strategy = f"The user's primary goal is 'Weight Loss'. Their maintenance calories are {maintenance_calories} kcal. We are setting a target of {target_calories} kcal (a 500 kcal deficit) to promote fat loss while maintaining muscle."
        knowledge_query = "Principles of workout routines for weight loss and fat burning, including cardio and resistance training."
    elif goal == 'muscle_gain':
        target_calories = maintenance_calories + 300
        strategy = f"The user's primary goal is 'Muscle Gain'. Their maintenance calories are {maintenance_calories} kcal. We are setting a target of {target_calories} kcal (a 300 kcal surplus) to maximize muscle growth."
        knowledge_query = "Principles of muscle hypertrophy, progressive overload, and workout splits for muscle gain."
    elif goal == 'recomposition':
        target_calories = maintenance_calories
        strategy = f"The user's primary goal is 'Body Recomposition'. Their maintenance calories are {maintenance_calories} kcal. We are setting a target of {target_calories} kcal (maintenance) to build muscle and lose fat simultaneously."
        knowledge_query = "Principles of body recomposition, combining muscle gain and fat loss, and nutrient timing."
    else:
        # Default to weight loss if goal is not recognized
        target_calories = maintenance_calories - 500
        strategy = f"The user's goal ('{goal}') is not recognized, defaulting to 'Weight Loss'. Their maintenance calories are {maintenance_calories} kcal. Setting a target of {target_calories} kcal."
        knowledge_query = "General workout principles."

    print(f"🧠 Calculated TDEE: {maintenance_calories} kcal, Target: {target_calories} kcal for goal: {goal}")
    # --- END: NEW TDEE AND GOAL CALCULATION ---

    profile_for_prompt = profile.copy()
    bfp = profile_for_prompt.get("body_fat_percentage")

    # If BFP is "0", None, or an empty string, set it to "Unknown"
    # so the AI doesn't misinterpret "0" as 0%.
    try:
        if not bfp or float(bfp) == 0:
            profile_for_prompt["body_fat_percentage"] = "Unknown"
    except ValueError:
        profile_for_prompt["body_fat_percentage"] = "Unknown" # Handle any other invalid strings

    # Pass the modified profile to the AI
    profile_str = json.dumps(profile_for_prompt, ensure_ascii=False)

    profile_str = json.dumps(profile, ensure_ascii=False)

    # --- RAG Logic (Unchanged) ---
    print(f"🧠 Querying Brain 2 for: {knowledge_query}")
    pdf_knowledge = find_knowledge_from_pdfs(knowledge_query)
    available_exercises_data = [item['data'] for item in food_exercise_data if item['type'] == 'exercise']
    exercise_info_list = []
    for ex in available_exercises_data:
        exercise_info_list.append(f"Name: {ex['name']}, Target Muscles: {ex.get('target-muscle', 'N/A')}")
    exercises_list_str = "\n".join(exercise_info_list)
    print(f"🏋️ Found {len(available_exercises_data)} exercises for the LLM to use.")

    # --- START: REVISED PROMPT ---
    prompt = f"""
    You are an expert fitness coach. A user has this profile:
    {profile_str}

    Here is the diet and workout strategy:
    {strategy}

    Based on this, the user's "daily_calories_goal" MUST be exactly {target_calories}.
    You must also generate goals for protein, carbs, and fat that add up to this calorie goal.

    First, use the following fitness principles from the knowledge base as your guide for creating the workout plan:
    ---[FITNESS PRINCIPLES]---
    {pdf_knowledge}
    ---[END PRINCIPLES]---

    You MUST create an optimal 7-day workout plan based on the user's goal and the fitness principles.
    You must decide the best workout split and when to place rest days.
    
    For each workout day you create, you MUST select appropriate exercises from the following list.
    ---[AVAILABLE EXERCISES]---
    {exercises_list_str}
    ---[END EXERCISES]---

    For each selected exercise, generate a "sets_reps" (e.g., "3 sets of 8-10 reps").

    Your response MUST be in this exact JSON format, with exactly 7 items in the "workout_plan" array.
    For "Rest Day", the "exercises" array MUST be empty [].
    DO NOT include comments or any text outside the JSON block.
    
    {{
      "diet_plan": {{
        "daily_calories_goal": {target_calories},
        "daily_protein_goal_g": <number (e.g., 1.8-2.2g/kg based on strategy)>,
        "daily_carbs_goal_g": <number (balance remaining calories)>,
        "daily_fat_goal_g": <number (balance remaining calories)>,
        "notes": "<A 2-3 sentence summary of the diet strategy in Korean>"
      }},
      "workout_plan": [
        {{ "day": "Monday - <Your Chosen Workout Type or Rest>", "exercises": [{{ "name": "<Selected Exercise Name>", "sets_reps": "<Generated sets/reps>" }}] }},
        {{ "day": "Tuesday - <Your Chosen Workout Type or Rest>", "exercises": [{{ "name": "<Selected Exercise Name>", "sets_reps": "<Generated sets/reps>" }}] }},
        {{ "day": "Wednesday - <Your Chosen Workout Type or Rest>", "exercises": [{{ "name": "<Selected Exercise Name>", "sets_reps": "<Generated sets/reps>" }}] }},
        {{ "day": "Thursday - <Your Chosen Workout Type or Rest>", "exercises": [{{ "name": "<Selected Exercise Name>", "sets_reps": "<Generated sets/reps>" }}] }},
        {{ "day": "Friday - <Your Chosen Workout Type or Rest>", "exercises": [{{ "name": "<Selected Exercise Name>", "sets_reps": "<Generated sets/reps>" }}] }},
        {{ "day": "Saturday - <Your Chosen Workout Type or Rest>", "exercises": [{{ "name": "<Selected Exercise Name>", "sets_reps": "<Generated sets/reps>" }}] }},
        {{ "day": "Sunday - <Your Chosen Workout Type or Rest>", "exercises": [{{ "name": "<Selected Exercise Name>", "sets_reps": "<Generated sets/reps>" }}] }}
      ]
    }}
    """

    response_str = call_ollama(prompt)

    try:
        # --- (Your JSON cleaning logic is unchanged and still necessary) ---
        json_match = re.search(r'\{.*\}', response_str, re.DOTALL)

        if not json_match:
            print(f"Error: No JSON object found in LLM response: {response_str}")
            return {"error": "Failed to generate plan. AI returned no JSON."}

        json_string_with_comments = json_match.group(0)
        json_string_no_comments = re.sub(r'//.*', '', json_string_with_comments)
        # --- (End of JSON cleaning logic) ---

        plan_data = json.loads(json_string_no_comments)

        # This part is still crucial. The LLM only returns the exercise *name*.
        # This code finds the full exercise data (like the youtube_link)
        # and adds it to the plan.
        if "workout_plan" in plan_data:
            for day_plan in plan_data.get("workout_plan", []):
                for ex in day_plan.get("exercises", []):
                    full_ex_data = find_exercise_data(ex["name"])
                    if full_ex_data:
                        ex["youtube_link"] = full_ex_data.get("youtube_link")
                        ex["target-muscle"] = full_ex_data.get("target-muscle")
        return plan_data
    except json.JSONDecodeError:
        print(f"Error decoding LLM response. Raw: {response_str} | Extracted: {json_string_with_comments} | Cleaned: {json_string_no_comments}")
        return {"error": "Failed to generate plan. AI returned invalid format."}

# --- 6. FLASK API ENDPOINTS (UPDATED) ---

@app.route("/check_status", methods=["GET"])
def check_status():
    profile = load_user_profile()
    return jsonify(profile)

@app.route("/save_profile", methods=["POST"])
def save_profile():
    data = request.json
    profile = {
        "status": "active_user",
        "name": data.get("name"),
        "email": data.get("email"),
        "goal": data.get("goal"),
        "weight_kg": data.get("weight_kg"),
        "start_weight_kg": data.get("weight_kg"),
        "goal_weight_kg": data.get("goal_weight_kg"),
        "height_cm": data.get("height_cm"),
        "age": data.get("age"),
        "gender": data.get("gender"),
        "body_fat_percentage": data.get("body_fat_percentage", "0"),
        "activity_level": data.get("activity_level"),
        "allergies": data.get("allergies"),
        "bmi": str(calculate_bmi(data.get("weight_kg"), data.get("height_cm")))
    }
    plans = generate_plans_from_profile(profile)
    profile["plans"] = plans
    save_user_profile(profile)
    return jsonify(profile)

@app.route("/chat", methods=["POST"])
def chat():
    data = request.json
    message = data.get("message", "")
    profile = load_user_profile()

    # Intent Router
    update_match = re.search(r"update|업데이트|변경", message, re.IGNORECASE)
    bfp_match = re.search(r"neck|waist|목|허리", message, re.IGNORECASE)
    log_match = re.search(r"(\d+)\s*g|그램", message, re.IGNORECASE)

    # --- Intent 1: Profile Update ---
    if update_match:
        print("Intent: Profile Update")
        weight_match = re.search(r"weight to (\d+\.?\d*)\s*kg", message)
        goal_weight_match = re.search(r"goal weight to (\d+\.?\d*)\s*kg", message)

        updated = False
        if weight_match:
            profile["weight_kg"] = weight_match.group(1)
            profile["bmi"] = str(calculate_bmi(profile["weight_kg"], profile["height_cm"]))
            updated = True
        if goal_weight_match:
            profile["goal_weight_kg"] = goal_weight_match.group(1)
            updated = True

        if updated:
            new_plans = generate_plans_from_profile(profile)
            profile["plans"] = new_plans
            save_user_profile(profile)
            return jsonify({
                "response": "Got it. I've updated your profile and regenerated your plans. Check the 'Plan' tab!",
                "profile": profile
            })
        else:
            return jsonify({"response": "I understood you want to update, but I couldn't find the right field. Please try again (e.g., 'update my weight to 78kg')."})

    # --- Intent 2: Body Fat Percentage Calculation ---
    elif bfp_match:
        print("Intent: BFP Calculation")
        neck_waist_match = re.search(r"neck is (\d+\.?\d*)\s*cm and waist is (\d+\.?\d*)\s*cm", message)
        if neck_waist_match:
            neck_cm = neck_waist_match.group(1)
            waist_cm = neck_waist_match.group(2)
            bfp = calculate_bfp_us_navy(profile["gender"], profile["height_cm"], waist_cm, neck_cm)
            if bfp > 0:
                profile["body_fat_percentage"] = str(bfp)
                save_user_profile(profile)
                return jsonify({
                    "response": f"Thanks! Your estimated body fat is {bfp}%. I've saved this to your profile.",
                    "profile": profile
                })
            else:
                return jsonify({"response": "I couldn't calculate that. Please check the numbers and try again."})
        else:
            return jsonify({"response": "I can help with that! Please provide your measurements in this format: 'My neck is [number]cm and my waist is [number]cm'"})

    # --- Intent 3: Meal Logging ---
    elif log_match:
        print("Intent: Meal Logging")
        try:
            prompt = f"""
            Extract the food name and weight in grams from the user's message.
            User message: "{message}"
            Your response MUST be in this exact JSON format: {{"food": "<food_name>", "weight": <number_in_grams>}}
            """
            meal_data_str = call_ollama(prompt)
            meal_data = json.loads(meal_data_str)
            food_name = meal_data.get("food")
            weight = float(meal_data.get("weight", 0))

            if not food_name or weight == 0:
                raise ValueError("LLM could not parse food/weight")

            food_info = find_food_data(food_name)

            if food_info:
                quantity = food_info["quantity"]
                factor = weight / quantity
                macros = {
                    "calories": round(food_info["calories"] * factor, 2),
                    "protein": round(food_info["protein"] * factor, 2),
                    "carbs": round(food_info["carbs"] * factor, 2),
                    "fat": round(food_info["fat"] * factor, 2),
                }

                meal_entry = {
                    "time": datetime.now().strftime('%H:%M'),
                    "name": food_info["name"],
                    "weight": weight,
                    "macros": macros
                }
                add_meal_to_log(meal_entry, datetime.now().strftime('%Y-%m-%d'))

                return jsonify({
                    "response": f"Logged: {weight}g of {food_info['name']} ({macros['calories']} kcal). Great job!",
                    "daily_summary": get_macros_for_date(datetime.now().strftime('%Y-%m-%d'))
                })
            else:
                return jsonify({
                    "response": f"I don't have '{food_name}' in my database. Can you tell me the main ingredients?"
                })
        except Exception as e:
            print(f"Meal log error: {e}")
            return jsonify({"response": "I had trouble logging that. Please use the format '[Food Name] [Weight]g' (e.g., '닭가슴살 200g')."})

    # --- Intent 4: General Q&A (Uses PDF Brain) ---
    else:
        print("Intent: General Q&A (using PDF Brain 2)")
        context = find_knowledge_from_pdfs(message)

        prompt = f"""
        You are PocketCoach, an expert fitness AI. Answer the user's question based ONLY on the provided context.
        If the context is not relevant or doesn't answer the question, just say 'I'm not sure about that, but I can help with logging your meals or updating your plan!'.
        Answer in friendly, concise Korean.

        Context:
        {context}
        
        User Question:
        "{message}"
        
        Answer:
        """
        answer = call_ollama(prompt)
        return jsonify({"response": answer})

@app.route("/get_summary", methods=["GET"])
def get_summary():
    date_str = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
    profile = load_user_profile()
    daily_total = get_macros_for_date(date_str)
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
        print("❌ Failed to start server. Exiting.")