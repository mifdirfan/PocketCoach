import json
from app import generate_plans_from_profile # Import the complex function

# This is a 'fixture' that provides sample data for our tests
@pytest.fixture
def sample_profile():
    return {
        "status": "active_user",
        "name": "Irfab",
        "goal": "muscle_gain",
        "weight_kg": "68",
        "height_cm": "170",
        "gender": "male",
        # ... and other keys ...
    }

def test_generate_plans_from_profile(mocker, sample_profile):
    """
    Tests the plan generation logic, but mocks the external AI call.
    'mocker' is provided by pytest-mock.
    'sample_profile' is provided by our fixture above.
    """

    # 1. Define the FAKE response we want our mock AI to return
    # This must be a clean JSON string, since we fixed this logic
    fake_llm_response = """
    {
      "diet_plan": {
        "daily_calories_goal": 3000,
        "daily_protein_goal_g": 200,
        "notes": "Test diet plan."
      },
      "workout_plan": [
        { 
          "day": "Monday - Push", 
          "exercises": [{ "name": "Barbell Bench Press", "sets_reps": "3 sets of 8-10 reps" }]
        }
      ]
    }
    """

    # 2. Tell pytest to "patch" the real functions

    # When 'app.call_ollama' is called, return our fake response instead
    mocker.patch('app.call_ollama', return_value=fake_llm_response)

    # We also need to mock the RAG function 'find_exercise_data'
    mocker.patch('app.find_exercise_data', return_value={
        "name": "Barbell Bench Press",
        "youtube_link": "http://fake-youtube.com/link",
        "target-muscle": "Chest"
    })

    # 3. Now, run the real function
    result = generate_plans_from_profile(sample_profile)

    # 4. Check if the function worked as expected
    assert "error" not in result
    assert result["diet_plan"]["daily_calories_goal"] == 3000
    assert result["workout_plan"][0]["exercises"][0]["name"] == "Barbell Bench Press"
    # Check that the data from our mock find_exercise_data was added
    assert result["workout_plan"][0]["exercises"][0]["youtube_link"] == "http://fake-youtube.com/link"