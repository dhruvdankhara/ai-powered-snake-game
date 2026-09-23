import time
import httpx

BASE_URL = "http://127.0.0.1:8000"


def test_service():
    print(f"Testing Laya API & Snake Game Backend at {BASE_URL}...")

    with httpx.Client(base_url=BASE_URL, timeout=90.0) as client:
        # 1. Test Static Web UI & Root Serving
        print("\n--- 1. Testing Web UI Serving (GET /) ---")
        root_res = client.get("/")
        print("Status code:", root_res.status_code)
        assert root_res.status_code == 200
        assert "<canvas id=\"game-canvas\">" in root_res.text
        print("Successfully verified Snake game HTML is served at root /")

        # 2. Test Health Endpoint
        print("\n--- 2. Testing /health ---")
        health_res = client.get("/health")
        print("Status code:", health_res.status_code)
        print("Response:", health_res.json())
        assert health_res.status_code == 200
        assert health_res.json().get("model_loaded") is True
        assert health_res.json().get("model") == "convaiinnovations/laya"

        # 3. Test Snake Game Autopilot Move Decision
        print("\n--- 3. Testing /predict with Snake Game Candidate Evaluation ---")
        snake_payload = {
            "state": {
                "current_position": "Snake head is at position x=10, y=10",
                "previous_direction": "UP",
                "food_direction": "Food is located 5 steps UP and 2 steps RIGHT",
                "canvas_bounds": "Grid size is 20 columns by 20 rows",
                "decision_goal": "Pick the best safe move that approaches the food and avoids fatal obstacles.",
            },
            "questions": {
                "next_move": {
                    "type": "choice",
                    "instructions": "Which move should the snake take to safely reach the food?",
                    "criteria": {
                        "UP": "BEST MOVE: Clear safe path moving directly closer towards target food",
                        "LEFT": "NEUTRAL MOVE: Clear safe path maintaining distance from target food",
                        "RIGHT": "SUBOPTIMAL MOVE: Clear safe path moving further away from target food",
                    },
                }
            },
        }

        t0 = time.time()
        snake_res = client.post("/predict", json=snake_payload)
        dur = time.time() - t0
        print(f"Status code: {snake_res.status_code} (took {dur:.3f}s)")
        assert snake_res.status_code == 200, f"Error: {snake_res.text}"
        snake_data = snake_res.json()
        chosen = snake_data.get("answers", {}).get("next_move", {}).get("choice")
        probs = snake_data.get("answers", {}).get("next_move", {}).get("probabilities", {})
        print("Chosen Snake Move:", chosen)
        print("Probabilities    :", probs)
        assert chosen in ["UP", "LEFT", "RIGHT"]
        print("Successfully verified Laya AI chose a valid legal move for Snake!")

        # 4. Test Customer Triage Questions
        print("\n--- 4. Testing /predict with customer triage questions ---")
        payload1 = {
            "state": {
                "from": "user@acme.com",
                "subject": "Duplicate charge on invoice #4411",
                "body": "Hi, we were billed twice for March. Please refund the duplicate today or we will cancel our plan.",
            },
            "questions": {
                "department": {
                    "type": "choice",
                    "instructions": "Which department should handle this request?",
                    "criteria": {
                        "billing": "invoices, payments, refunds",
                        "technical": "bugs, outages, system errors",
                        "sales": "pricing, new contracts",
                        "other": "everything else",
                    },
                },
                "urgency": {
                    "type": "score",
                    "instructions": "How urgent is this request?",
                    "criteria": ["not urgent", "soon", "critical deadline or blocking issue"],
                },
                "churn_risk": {
                    "type": "noul",
                    "instructions": "Does the user threaten to cancel or leave?",
                },
                "refund_requested": {
                    "type": "noul",
                    "instructions": "Does the user explicitly request a refund?",
                },
            },
        }
        pred_res1 = client.post("/predict", json=payload1)
        assert pred_res1.status_code == 200
        data1 = pred_res1.json()
        assert data1["answers"]["department"]["choice"] == "billing"
        assert data1["routing"]["model"] == "english"

        # 5. Validation Failure on Missing Questions
        print("\n--- 5. Testing validation: missing questions must return 422 ---")
        pred_res3 = client.post("/predict", json={"state": {"message": "Hello world"}})
        assert pred_res3.status_code == 422
        print("Successfully validated that questions are required!")

        print("\nAll integration & AI tests passed successfully!")


if __name__ == "__main__":
    test_service()
