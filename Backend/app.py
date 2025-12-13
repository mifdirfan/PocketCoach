import os
import json
import ollama
import pandas as pd
import numpy as np
import faiss  # Make sure you have 'pip install faiss-cpu'
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import re
import math
import glob
import pypdf  # Using pypdf
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
CUSTOM_FOOD_DB_PATH = os.path.join(KNOWLEDGE_DIR, "user_custom_foods.csv")

# RAG components
embedding_model = None
embedding_dimension = 0

# Brain 1: For structured data (food/exercises)
food_exercise_index = None
food_exercise_data = [] # Will store {"type": "food", "data": {...}} or {"type": "exercise", "data": {...}}

# Brain 2: For unstructured knowledge (PDFs)
pdf_index = None
pdf_data = [] # Will store {"text": "...", "source": "..."}


# --- 3. HELPER FUNCTIONS (File I/O & Calculations) ---
# (These functions are all correct)
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

def add_meal_to_log(meal_entry, date_str, time_str): # <-- NEW
    logs = load_meal_logs()
    if date_str not in logs:
        logs[date_str] = []

    # --- ADD THIS LINE ---
    meal_entry["time"] = time_str # Use the time from the app
    # --- END ADD ---

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
    try:
        weight_kg = float(profile.get("weight_kg", 0))
        height_cm = float(profile.get("height_cm", 0))
        age = int(profile.get("age", 0))
        gender = profile.get("gender", "male").lower()
        activity_level = profile.get("activity_level", "low").lower()

        if weight_kg == 0 or height_cm == 0 or age == 0:
            return 2000 # Return a safe default

        if gender == 'male':
            bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
        else:
            bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161

        if activity_level == 'high':
            multiplier = 1.9
        elif activity_level == 'moderate':
            multiplier = 1.55
        else: # 'low'
            multiplier = 1.2

        tdee = bmr * multiplier
        return int(round(tdee, 0))
    except Exception as e:
        print(f"❌ Error in calculate_TDEE: {e}")
        return 2000


# --- 4. RAG SETUP (FIXED) ---

def setup_rag_pipeline():
    global embedding_model, embedding_dimension, food_exercise_index, food_exercise_data, pdf_index, pdf_data

    try:
        model_name = 'jhgan/ko-sbert-nli'
        embedding_model = SentenceTransformer(model_name)
        print(f"🤖 Embedding model '{model_name}' loaded.")
        embedding_dimension = embedding_model.get_sentence_embedding_dimension()

        # --- Brain 1: Load Food & Exercise Data ---
        food_exercise_texts = []

        # Load Food DB
        food_db_df = pd.read_csv(FOOD_DB_PATH, encoding='cp949') # Use cp949 for government data
        for index, row in food_db_df.iterrows():
            text = row['식품명'].strip()
            food_exercise_texts.append(text)
            food_exercise_data.append({"type": "food", "data": row.to_dict()})
        print(f"📄 Food DB loaded: {len(food_db_df)} items.")

        # --- FIX: Load Custom Food DB with utf-8 ---
        if os.path.exists(CUSTOM_FOOD_DB_PATH):
            try:
                # Custom file is written in utf-8, so read it as utf-8
                custom_food_df = pd.read_csv(CUSTOM_FOOD_DB_PATH, encoding='utf-8')
                for index, row in custom_food_df.iterrows():
                    text = row['식품명'].strip()
                    food_exercise_texts.append(text)
                    food_exercise_data.append({"type": "food", "data": row.to_dict()})
                print(f"🧑‍🍳 Custom Food DB loaded: {len(custom_food_df)} items.")
            except Exception as e:
                print(f"⚠️ Warning: Could not load Custom Food DB: {e}")
        else:
            print("ℹ️ No Custom Food DB found. One will be created if a user adds a new food.")

        # Load Exercise DB
        with open(EXERCISE_DB_PATH, 'r', encoding='utf-8') as f:
            exercise_list = json.load(f)
        for ex in exercise_list:
            text = f"{ex['name']} (Targets: {ex.get('target-muscle', 'N/A')})"
            food_exercise_texts.append(text)
            food_exercise_data.append({"type": "exercise", "data": ex})
        print(f"🏋️ Exercise DB loaded: {len(exercise_list)} exercises.")

        # --- FIX: Build FAISS index for Brain 1 ---
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
                print(f"🧠 Successfully processed PDF: {os.path.basename(pdf_path)}")
            except Exception as e:
                print(f"❌ Error processing PDF {pdf_path}: {e}")

        if pdf_texts:
            # --- FIX: Build FAISS index for Brain 2 ---
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

# --- 5. CORE AI FUNCTIONS (FIXED) ---

def find_food_data(food_name_query):
    """Finds food data using RAG Brain 1 (FAISS)."""
    query_embedding = embedding_model.encode([food_name_query]).astype('float32')
    D, I = food_exercise_index.search(query_embedding, k=1)
    best_match_index = I[0][0]
    best_match_score = D[0][0]
    best_match = food_exercise_data[best_match_index]

    if best_match["type"] == "food" and best_match_score < 1.0:
        food_data = best_match["data"]

        # --- START: FIX FOR 'g' and 'ml' ---
        # Get the quantity string (e.g., "100g", "100ml", or "100")
        quantity_str = str(food_data.get("영양성분함량기준량", 100) or 100)

        # Use regex to find the first sequence of digits (and decimal)
        quantity_match = re.search(r'[\d\.]+', quantity_str)

        # Convert the extracted number, defaulting to 100 if it fails
        quantity = float(quantity_match.group(0)) if quantity_match else 100
        # --- END: FIX ---

        return {
            "name": food_data["식품명"],
            "calories": float(food_data.get("에너지(kcal)", 0) or 0),
            "protein": float(food_data.get("단백질(g)", 0) or 0),
            "fat": float(food_data.get("지방(g)", 0) or 0),
            "carbs": float(food_data.get("탄수화물(g)", 0) or 0),
            "quantity": quantity # Use the cleaned quantity
        }
    return None

def find_exercise_data(exercise_name_query):
    """Finds exercise data using RAG Brain 1 (FAISS)."""
    query_embedding = embedding_model.encode([exercise_name_query]).astype('float32')
    D, I = food_exercise_index.search(query_embedding, k=1)
    best_match_index = I[0][0]
    best_match_score = D[0][0]
    best_match = food_exercise_data[best_match_index]

    if best_match["type"] == "exercise" and best_match_score < 1.8:
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
    maintenance_calories = calculate_tdee(profile)
    target_calories = 0
    strategy = ""
    knowledge_query = ""

    if goal == 'weight_loss':
        target_calories = maintenance_calories - 500
        strategy = f"The user's goal is 'Weight Loss'. Their maintenance is {maintenance_calories} kcal. We are setting a {target_calories} kcal target (a 500 kcal deficit)."
        knowledge_query = "Principles of workout routines for weight loss and fat burning."
    elif goal == 'muscle_gain':
        target_calories = maintenance_calories + 300
        strategy = f"The user's goal is 'Muscle Gain'. Their maintenance is {maintenance_calories} kcal. We are setting a {target_calories} kcal target (a 300 kcal surplus)."
        knowledge_query = "Principles of muscle hypertrophy and progressive overload."
    elif goal == 'recomposition':
        target_calories = maintenance_calories
        strategy = f"The user's goal is 'Body Recomposition'. Their maintenance is {maintenance_calories} kcal. We are setting a {target_calories} kcal target (maintenance)."
        knowledge_query = "Principles of body recomposition."
    else:
        target_calories = maintenance_calories - 500
        strategy = f"Defaulting to 'Weight Loss'. Maintenance is {maintenance_calories} kcal. Setting a {target_calories} kcal target."
        knowledge_query = "General workout principles."

    print(f"🧠 Calculated TDEE: {maintenance_calories} kcal, Target: {target_calories} kcal for goal: {goal}")

    profile_for_prompt = profile.copy()
    try:
        if not profile_for_prompt.get("body_fat_percentage") or float(profile_for_prompt.get("body_fat_percentage", "0")) == 0:
            profile_for_prompt["body_fat_percentage"] = "Unknown"
    except ValueError:
        profile_for_prompt["body_fat_percentage"] = "Unknown"

    profile_str = json.dumps(profile_for_prompt, ensure_ascii=False)

    print(f"🧠 Querying Brain 2 for: {knowledge_query}")
    pdf_knowledge = find_knowledge_from_pdfs(knowledge_query)
    available_exercises_data = [item['data'] for item in food_exercise_data if item['type'] == 'exercise']
    exercise_info_list = []
    for ex in available_exercises_data:
        exercise_info_list.append(f"Name: {ex['name']}, Target Muscles: {ex.get('target-muscle', 'N/A')}")
    exercises_list_str = "\n".join(exercise_info_list)
    print(f"🏋️ Found {len(available_exercises_data)} exercises for the LLM to use.")

    prompt = f"""
    You are an expert fitness coach. A user has this profile:
    {profile_str}

    Here is the diet and workout strategy:
    {strategy}

    Your "daily_calories_goal" MUST be exactly {target_calories}.
    Generate protein, carbs, and fat goals that add up to this calorie goal.

    Use the following fitness principles from the knowledge base as your guide:
    ---[FITNESS PRINCIPLES]---
    {pdf_knowledge}
    ---[END PRINCIPLES]---

    You MUST create an optimal 7-day workout plan based on the user's goal.
    You MUST decide the best workout split and rest days.
    
    For each workout day, you MUST select exercises from the following list:
    ---[AVAILABLE EXERCISES]---
    {exercises_list_str}
    ---[END EXERCISES]---

    For each selected exercise, generate "sets_reps".
    For "Rest Day", the "exercises" array MUST be empty [].
    DO NOT include text outside the JSON block.
    
    {{
      "diet_plan": {{
        "daily_calories_goal": {target_calories},
        "daily_protein_goal_g": <number>,
        "daily_carbs_goal_g": <number>,
        "daily_fat_goal_g": <number>,
        "notes": "<A 2-3 sentence summary of the diet strategy in Korean>"
      }},
      "workout_plan": [
        {{ "day": "Monday - <Workout Type>", "exercises": [{{ "name": "<Exercise Name>", "sets_reps": "<sets/reps>" }}] }},
        {{ "day": "Tuesday - <Workout Type or Rest>", "exercises": [] }},
        {{ "day": "Wednesday - <Workout Type>", "exercises": [{{ "name": "<Exercise Name>", "sets_reps": "<sets/reps>" }}] }},
        {{ "day": "Thursday - <Workout Type or Rest>", "exercises": [] }},
        {{ "day": "Friday - <Workout Type>", "exercises": [{{ "name": "<Exercise Name>", "sets_reps": "<sets/reps>" }}] }},
        {{ "day": "Saturday - <Workout Type or Rest>", "exercises": [] }},
        {{ "day": "Sunday - <Workout Type or Rest>", "exercises": [] }}
      ]
    }}
    """

    response_str = call_ollama(prompt)

    try:
        # --- START: FIX ---
        json_match = re.search(r'\{.*\}', response_str, re.DOTALL)
        if not json_match:
            print(f"Error: No JSON object found in LLM response: {response_str}")
            return {"error": "Failed to generate plan. AI returned no JSON."}

        # 1. 주석이 포함된 JSON 문자열 추출
        json_string_with_comments = json_match.group(0)

        # 2. '//'로 시작하는 모든 주석을 제거
        json_string_no_comments = re.sub(r'//.*', '', json_string_with_comments)

        # 3. 깨끗해진 JSON 문자열을 파싱
        plan_data = json.loads(json_string_no_comments)
        # --- END: FIX ---

        if "workout_plan" in plan_data:
            for day_plan in plan_data.get("workout_plan", []):
                for ex in day_plan.get("exercises", []):
                    if "name" in ex: # "Rest Day"의 빈 배열 오류 방지
                        full_ex_data = find_exercise_data(ex["name"])
                        if full_ex_data:
                            ex["youtube_link"] = full_ex_data.get("youtube_link")
                            ex["target-muscle"] = full_ex_data.get("target-muscle")
        return plan_data
    except json.JSONDecodeError:
        # 디버깅을 위해 모든 단계의 문자열을 출력합니다.
        print(f"Error decoding LLM response. Raw: {response_str} | Extracted: {json_string_with_comments} | Cleaned: {json_string_no_comments}")
        return {"error": "Failed to generate plan. AI returned invalid format."}

# --- 6. FLASK API ENDPOINTS (FIXED) ---

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
    pending_food_name = data.get("pending_food_name")

    date_str = data.get("date", datetime.now().strftime('%Y-%m-%d'))
    # --- ADD THIS LINE ---
    time_str = data.get("time", datetime.now().strftime('%H:%M'))
    # --- END ADD ---


    profile = load_user_profile()


    # --- Intent 3: Add New Food (MUST BE CHECKED FIRST) ---
    if pending_food_name:
        print("Intent: Add New Food")
        try:
            prompt_parse = f"""
            Parse the user's ingredient list into a JSON list.
            User message: "{message}"
            Example response: [{{"food": "pork", "weight": 100}}, {{"food": "tofu", "weight": 50}}]
            Your response MUST be ONLY the JSON list.
            """
            ingredients_str = call_ollama(prompt_parse)
            # LLM 응답에서 JSON 리스트만 추출
            json_match = re.search(r'\[.*\]', ingredients_str, re.DOTALL)
            if not json_match:
                print(f"Add new food error: LLM did not return JSON list. Raw: {ingredients_str}")
                raise ValueError("LLM did not return JSON list")
            ingredients = json.loads(json_match.group(0))

            total_macros = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
            total_weight = 0

            for item in ingredients:
                food_data = find_food_data(item['food'])
                if food_data:
                    weight = float(item['weight'])
                    quantity = float(food_data["quantity"])
                    factor = weight / quantity
                    total_macros["calories"] += food_data["calories"] * factor
                    total_macros["protein"] += food_data["protein"] * factor
                    total_macros["carbs"] += food_data["carbs"] * factor
                    total_macros["fat"] += food_data["fat"] * factor
                    total_weight += weight

            if total_weight > 0:
                factor_100g = 100 / total_weight
                new_food_data = {
                    "식품명": pending_food_name,
                    "영양성분함량기준량": 100,
                    "에너지(kcal)": round(total_macros["calories"] * factor_100g, 2),
                    "단백질(g)": round(total_macros["protein"] * factor_100g, 2),
                    "지방(g)": round(total_macros["fat"] * factor_100g, 2),
                    "탄수화물(g)": round(total_macros["carbs"] * factor_100g, 2),
                }

                new_food_df = pd.DataFrame([new_food_data])
                new_food_df.to_csv(
                    CUSTOM_FOOD_DB_PATH,
                    mode='a',
                    header=not os.path.exists(CUSTOM_FOOD_DB_PATH),
                    index=False,
                    encoding='utf-8' # Use utf-8
                )

                return jsonify({"response": f"성공! '{pending_food_name}'을(를) 사용자 맞춤 음식 DB에 저장했습니다. 새 음식을 사용하려면 서버를 재시작해주세요."})
            else:
                return jsonify({"response": "입력한 재료를 DB에서 찾을 수 없습니다. 다시 시도해 주세요."})
        except Exception as e:
            print(f"Error adding new food: {e}")
            return jsonify({"response": "재료를 분석하는 데 실패했습니다. '돼지고기 100g, 두부 50g' 처럼 간단한 목록으로 입력해 주세요."})

    # --- Standard Intent Router (FIXED ORDER AND REGEX) ---
    # BFP match is now MORE specific to avoid conflict with "목표" (goal)
    bfp_match = re.search(r"(목|neck)\s*둘레|(허리|waist)\s*둘레", message, re.IGNORECASE)
    update_match = re.search(r"update|업데이트|변경|설정", message, re.IGNORECASE)
    log_match = re.search(r"(\d+)\s*g|그램", message, re.IGNORECASE)

    # --- Intent 2: BFP Calculation (CHECKED FIRST) ---
    if bfp_match:
        print("Intent: BFP Calculation")
        try:
            prompt = f"""
            Extract neck and waist measurements in cm from: "{message}"
            Respond ONLY with JSON: {{"neck_cm": <number_or_null>, "waist_cm": <number_or_null>}}
            Example for '내 목 둘레는 38cm이고 허리 둘레는 82cm야': {{"neck_cm": 38, "waist_cm": 82}}
            """
            measure_str = call_ollama(prompt)
            json_match = re.search(r'\{.*\}', measure_str, re.DOTALL)

            if not json_match:
                print(f"BFP error: LLM did not return JSON. Raw: {measure_str}")
                raise ValueError("LLM did not return JSON")

            measure_data = json.loads(json_match.group(0))
            neck_cm = measure_data.get("neck_cm")
            waist_cm = measure_data.get("waist_cm")

            if neck_cm and waist_cm:
                bfp = calculate_bfp_us_navy(profile["gender"], profile["height_cm"], waist_cm, neck_cm)
                if bfp > 0:
                    profile["body_fat_percentage"] = str(bfp); save_user_profile(profile)
                    return jsonify({"response": f"감사합니다! 예상 체지방률은 {bfp}%입니다. 프로필에 저장했어요.", "profile": profile})
                else:
                    return jsonify({"response": "수치를 계산할 수 없습니다. 숫자를 다시 확인해주세요."})
            else:
                # This is the prompt the user was seeing incorrectly
                return jsonify({"response": "도와드릴게요! '내 목 둘레는 [숫자]cm이고 허리 둘레는 [숫자]cm입니다' 형식으로 알려주세요."})
        except Exception as e:
            print(f"BFP error: {e}")
            return jsonify({"response": "측정값을 이해하는 데 실패했습니다. '내 목 둘레는 [숫자]cm이고 허리 둘레는 [숫자]cm입니다' 형식으로 알려주세요."})

    # --- Intent 1: Profile Update (CHECKED SECOND) ---
    elif update_match:
        print("Intent: Profile Update")
        try:
            prompt = f"""
            Extract the fields to update from: "{message}"
            Valid fields are 'weight' and 'goal weight'.
            Respond ONLY with JSON: {{"weight_kg": <number_or_null>, "goal_weight_kg": <number_or_null>}}
            Example for '내 목표 체중을 68kg으로 변경해줘': {{"weight_kg": null, "goal_weight_kg": 68}}
            Example for '내 체중 75kg': {{"weight_kg": 75, "goal_weight_kg": null}}
            """
            update_str = call_ollama(prompt)
            json_match = re.search(r'\{.*\}', update_str, re.DOTALL)

            updated = False
            if not json_match:
                print(f"Update error: LLM did not return JSON. Raw: {update_str}")
                raise ValueError("LLM did not return JSON")

            update_data = json.loads(json_match.group(0))
            weight_kg = update_data.get("weight_kg")
            goal_weight_kg = update_data.get("goal_weight_kg")

            if weight_kg:
                profile["weight_kg"] = str(weight_kg)
                profile["bmi"] = str(calculate_bmi(profile["weight_kg"], profile["height_cm"]))
                updated = True
            if goal_weight_kg:
                profile["goal_weight_kg"] = str(goal_weight_kg)
                updated = True

            if updated:
                new_plans = generate_plans_from_profile(profile)
                profile["plans"] = new_plans
                save_user_profile(profile)
                return jsonify({"response": "프로필을 업데이트하고 플랜을 다시 생성했습니다. 'Plan' 탭을 확인하세요!", "profile": profile})
            else:
                return jsonify({"response": "업데이트할 내용을 이해하지 못했어요. '내 체중 75kg으로 변경' 또는 '목표 체중 70kg으로 설정'처럼 말씀해주세요."})
        except Exception as e:
            print(f"Profile update error: {e}")
            return jsonify({"response": "프로필 업데이트 중 오류가 발생했습니다. 다시 시도해 주세요."})

    # --- Intent 4: Meal Logging (CHECKED THIRD) ---
    elif log_match:
        print("Intent: Meal Logging")
        try:
            prompt = f"""
            Extract the food name and weight in grams from: "{message}"
            Respond ONLY with JSON: {{"food": "<food_name>", "weight": <number>}}
            """
            meal_data_str = call_ollama(prompt)

            # --- FIX: Clean the JSON response ---
            json_match = re.search(r'\{.*\}', meal_data_str, re.DOTALL)
            if not json_match:
                print(f"Meal log error: LLM did not return JSON. Raw: {meal_data_str}")
                raise ValueError("LLM did not return JSON")
            meal_data = json.loads(json_match.group(0))
            # --- END FIX ---

            food_name = meal_data.get("food")
            weight = float(meal_data.get("weight", 0))
            if not food_name or weight == 0: raise ValueError("LLM parse fail")

            food_info = find_food_data(food_name)

            if food_info:
                quantity = float(food_info["quantity"])
                factor = weight / quantity
                macros = {"calories": round(food_info["calories"] * factor, 2), "protein": round(food_info["protein"] * factor, 2), "carbs": round(food_info["carbs"] * factor, 2), "fat": round(food_info["fat"] * factor, 2)}
                meal_entry = {"name": food_info["name"], "weight": weight, "macros": macros}

                # --- PASS 'time_str' to the function ---
                add_meal_to_log(meal_entry, date_str, time_str)

                return jsonify({
                    "response": f"기록 완료: {food_info['name']} {weight}g ({macros['calories']} kcal). 맛있게 드셨나요?",
                    "daily_summary": get_macros_for_date(date_str)
                })
            else:
                return jsonify({
                    "response": f"'{food_name}'이(가) 제 데이터베이스에 없네요. 이 음식을 추가하려면, 주재료와 무게를 알려주세요. (예: '돼지고기 100g, 김치 150g')",
                    "action_required": "add_new_food",
                    "food_name": food_name
                })
        except Exception as e:
            print(f"Meal log error: {e}")
            return jsonify({"response": "기록에 실패했어요. '[음식 이름] [무게]g' 형식으로 다시 시도해주세요. (예: '닭가슴살 200g')"})

    # --- Intent 5: General Q&A (CHECKED LAST) ---
    else:
        print("Intent: General Q&A (using PDF Brain 2)")
        context = find_knowledge_from_pdfs(message)
        prompt = f"""
        You are PocketCoach, an expert fitness AI. Answer the user's question based ONLY on the provided context.
        If the context is not relevant, just say '죄송합니다. 해당 질문에 대한 정보가 없습니다. 식단 기록이나 플랜 업데이트는 도와드릴 수 있어요!'.
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