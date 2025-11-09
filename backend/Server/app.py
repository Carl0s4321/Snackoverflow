from flask import Flask, jsonify, request, send_from_directory
from pymongo import MongoClient
import os
from dotenv import load_dotenv
import certifi
import requests
from typing import Dict, Optional, Tuple, Any
from werkzeug.utils import secure_filename
from uuid import uuid4
from datetime import datetime, timezone

from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required
# from flask_cors import CORS # Removed standard CORS to use manual after_request hook

# === NEW: Import Transit Score Function ===
# NOTE: transit_score.py must be present for this to run
from transit_score import get_transit_score
# ==========================================

# Import your schema
# NOTE: The reports_schema.py file must be present for this to run
from reports_schema import REPORT_SCHEMA, ALL_CATEGORIES

# ======================================================================
# 0. CONFIGURATION AND WEIGHTS
# ======================================================================

WEIGHTS = {
    # Weights have been updated to include transit score and still sum to 1.0
    "air_quality": 0.40,
    "weather_rating": 0.30,
    "transit_score": 0.30, # New factor based on proximity to downtown hub
}

DEFAULT_SCORE = 5.5
DEFAULT_DESCRIPTION = "Data unavailable"

if abs(sum(WEIGHTS.values()) - 1.0) > 0.001:
    raise ValueError("The weights in the WEIGHTS dictionary must sum to 1.0.")

load_dotenv()
API_KEY = os.getenv('MEERSENS_API_KEY')
if not API_KEY:
    print("WARNING: MEERSENS_API_KEY is not set. API calls will likely fail.")

# --- JWT Configuration Fix ---
JWT_KEY = os.getenv('JWT_SECRET_KEY')
FLASK_KEY = os.getenv('FLASK_SECRET_KEY')
if not JWT_KEY or not FLASK_KEY:
    raise RuntimeError("JWT_SECRET_KEY and FLASK_SECRET_KEY must be set in your .env file.")
# -----------------------------

# ======================================================================
# 1. FLASK + MONGO SETUP
# ======================================================================

app = Flask(__name__)

# --- APPLY SECRETS ---
app.config["SECRET_KEY"] = FLASK_KEY
app.config["JWT_SECRET_KEY"] = JWT_KEY
# ---------------------

# <--- REPLACED CORS WITH MANUAL AFTER_REQUEST HOOK --->
@app.after_request
def add_cors_headers(response):
    # Only allow the specific origins used by the frontend
    allowed_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
    request_origin = request.headers.get('Origin')

    if request_origin in allowed_origins:
        response.headers.add('Access-Control-Allow-Origin', request_origin)

    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')

    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response.status_code = 200
        response.data = b'' # Ensure response body is empty for OPTIONS

    return response


jwt = JWTManager(app)
bcrypt = Bcrypt(app)


mongo_uri = os.getenv("MONGO_URI")
try:
    # Use a shorter timeout for quicker failure detection in development
    client = MongoClient(mongo_uri, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000)
    # The ismaster command is a lightweight way to verify a connection
    client.admin.command('ismaster')
    db = client["welivehere"]
    collection = db["reports"]
    usersCollection = db["users"]
    print("INFO: MongoDB connection established (Collection: reports).")
except Exception as e:
    print(f"❌ ERROR: Failed to connect to MongoDB. Users/Reports data will be unavailable: {e}")
    client = None
    collection = None
    usersCollection = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(BASE_DIR, "..", "images")
os.makedirs(IMAGES_DIR, exist_ok=True)

# ======================================================================
# 2. VALIDATION UTILITY
# ======================================================================

def validate_user_register(data):
    # Check database status first
    if usersCollection is None:
        return "Database unavailable for registration check."

    user = usersCollection.find_one({"username": data.get("username")})
    if user:
        return "Username found"
    # MAKE OTHER IDK

def _validate_report_data(data: Dict) -> Optional[str]:
    if not isinstance(data, dict):
        return "Payload must be a JSON object."

    for field, rules in REPORT_SCHEMA.items():
        is_required = rules.get("required", False)
        if is_required and field not in data:
            return f"Missing required field: '{field}'"

        if field in data:
            value = data[field]
            expected_type = rules["type"]

            if not isinstance(value, expected_type):
                return f"Field '{field}' must be {expected_type.__name__}"

            if field == "category" and value not in rules.get("allowed_values", []):
                allowed = ', '.join(rules['allowed_values'])
                return f"Category must be one of: {allowed}"

            if field == "geolocation":
                geo_schema = rules["schema"]
                for geo_field, geo_rules in geo_schema.items():
                    if geo_field not in value:
                        return f"Missing geolocation field: '{geo_field}'"
                    if not isinstance(value[geo_field], geo_rules["type"]):
                        return f"'{geo_field}' must be {geo_rules['type'].__name__}"

    return None

# ======================================================================
# 3. AIR QUALITY SERVICE
# ======================================================================

def _scale_maqi_to_score(maqi_value: float) -> float:
    MAQI_MIN, MAQI_MAX = 0.0, 100.0
    SCORE_MAX, SCORE_MIN = 10.0, 1.0
    maqi_clamped = max(MAQI_MIN, min(MAQI_MAX, maqi_value))
    slope = (SCORE_MIN - SCORE_MAX) / (MAQI_MAX - MAQI_MIN)
    score = (slope * maqi_clamped) + SCORE_MAX
    return round(max(SCORE_MIN, score), 1)

def get_air_quality_score(latitude: float, longitude: float) -> Tuple[float, str]:
    print(f"DEBUG: Fetching Air Quality for {latitude},{longitude}")
    if not API_KEY:
        return DEFAULT_SCORE, "Air: Data unavailable (no API key)"

    try:
        url = "https://api.meersens.com/environment/public/air/current"
        resp = requests.get(url, headers={'apikey': API_KEY}, params={'lat': latitude, 'lng': longitude}, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data.get('found'):
            idx = data.get('index', {})
            if idx.get('value') is not None:
                score = _scale_maqi_to_score(float(idx['value']))
                desc = f"Air: {idx.get('qualification', 'Unknown')}"
                return score, desc
    except Exception as e:
        print(f"ERROR: Air Quality API failed: {e}")
    return DEFAULT_SCORE, f"Air: {DEFAULT_DESCRIPTION}"

# ======================================================================
# 4. WEATHER SERVICE
# ======================================================================

class WeatherService:
    OPTIMAL_TEMP = 25.0
    BASE_URL = "https://api.meersens.com/environment/public/weather/current"

    def get_weather_data(self, lat: float, lng: float):
        r = requests.get(self.BASE_URL, headers={'apikey': API_KEY}, params={'lat': lat, 'lng': lng}, timeout=10)
        r.raise_for_status()
        return r.json()

    def calculate_weather_rating(self, data: Dict[str, Any]) -> float:
        temp = data.get("parameters", {}).get("temperature", {}).get("value")
        if temp is None:
            return DEFAULT_SCORE
        deviation = abs(temp - self.OPTIMAL_TEMP)
        rating = max(1.0, 10 - (deviation / 65.0) * 10)
        return round(rating, 1)

    def describe_weather(self, data: Dict[str, Any]) -> str:
        params = data.get("parameters", {})
        temp = params.get("temperature", {}).get("value")
        condition = params.get("weather_condition", {}).get("value", "Unknown").title()
        if temp is None:
            return f"Weather: {condition}"
        if temp < 0: desc = "Freezing"
        elif temp < 10: desc = "Cold"
        elif temp < 20: desc = "Cool"
        elif temp < 28: desc = "Pleasant"
        elif temp < 35: desc = "Warm"
        else: desc = "Hot"
        return f"Weather: {condition}, {desc} ({temp}°C)"

def get_weather_score(lat: float, lon: float) -> Tuple[float, str]:
    print(f"DEBUG: Fetching Weather for {lat},{lon}")
    service = WeatherService()
    if not API_KEY:
        return DEFAULT_SCORE, "Weather: API key missing"
    try:
        data = service.get_weather_data(lat, lon)
        score = service.calculate_weather_rating(data)
        desc = service.describe_weather(data)
        return score, desc
    except Exception as e:
        print(f"ERROR: Weather API failed: {e}")
        return DEFAULT_SCORE, f"Weather: {DEFAULT_DESCRIPTION}"

# ======================================================================
# 5. CITY QUALITY CALCULATOR (UPDATED)
# ======================================================================

def calculate_city_quality_score(lat: float, lon: float) -> Dict[str, Any]:
    # 1. Get individual scores
    air_score, air_desc = get_air_quality_score(lat, lon)
    weather_score, weather_desc = get_weather_score(lat, lon)
    transit_score, transit_desc = get_transit_score(lat, lon) # NEW: Get transit score

    # 2. Calculate weighted total
    total = (
        air_score * WEIGHTS["air_quality"] + 
        weather_score * WEIGHTS["weather_rating"] +
        transit_score * WEIGHTS["transit_score"] # NEW: Include transit weight
    )

    # 3. Return results
    return {
        "city_quality_score": round(total, 1),
        "individual_ratings": {
            "air_quality": {"score": air_score, "desc": air_desc, "weight": WEIGHTS["air_quality"]},
            "weather_rating": {"score": weather_score, "desc": weather_desc, "weight": WEIGHTS["weather_rating"]},
            "transit_score": {"score": transit_score, "desc": transit_desc, "weight": WEIGHTS["transit_score"]}, # NEW: Include transit details
        },
    }

# ======================================================================
# 6. FLASK ROUTES
# ======================================================================

@app.route("/")
def home():
    print("DEBUG: Hit / route.")
    return jsonify({"message": "Flask backend running and connected to MongoDB"})

@app.route("/api/register", methods=["POST", "OPTIONS"])
def register():
    # Database Guard: Check connection status
    if usersCollection is None:
        return jsonify({"error": "Database not connected. Cannot register user."}), 500

    if request.method == 'OPTIONS':
        return '', 200 # Preflight handled by after_request hook

    data = None
    try:
        data = request.json
    except Exception as e:
        print(f"ERROR: Failed to parse JSON payload in /register: {e}")
        return jsonify({"error": "Failed to parse JSON request body."}), 400
    
    if data is None:
        return jsonify({"error": "Invalid JSON payload. Ensure Content-Type is application/json."}), 400

    validation_error = validate_user_register(data)
    if validation_error and validation_error != "Database unavailable for registration check.":
        print(f"ERROR: Validation failed: {validation_error}")
        return jsonify({"error": "Invalid report data format", "details": validation_error}), 400

    # Ensure required fields exist before accessing them
    if "password" not in data or "username" not in data:
            return jsonify({"error": "Missing username or password"}), 400

    password_hash = bcrypt.generate_password_hash(data["password"]).decode("utf-8")

    user = {
        "username": data["username"],
        "password": password_hash,
        "status": "user"
    }

    try:
        usersCollection.insert_one(user)
        return jsonify({"msg": "User created"}), 201
    except Exception as e:
        print(f"ERROR: Failed to insert user: {e}")
        return jsonify({"error": f"Failed to register user: {e}"}), 500


@app.route("/api/login", methods=["POST", "OPTIONS"])
def login():
    # Database Guard: Check connection status
    if usersCollection is None:
        return jsonify({"error": "Database not connected. Cannot process login."}), 500
    
    if request.method == 'OPTIONS':
        return '', 200 # Preflight handled by after_request hook

    data = None
    try:
        data = request.json
    except Exception as e:
        print(f"ERROR: Failed to parse JSON payload in /login: {e}")
        return jsonify({"error": "Failed to parse JSON request body."}), 400

    if data is None:
        return jsonify({"error": "Invalid JSON payload. Ensure Content-Type is application/json."}), 400
    
    username = data.get("username")
    password = data.get("password")

    try:
        user = usersCollection.find_one({"username": username})
    except Exception as e:
        print(f"ERROR: MongoDB query error during login: {e}")
        return jsonify({"error": "Login failed due to database error."}), 500
    
    if not user:
        return jsonify({"error": "Invalid username or password"}), 400
    
    # Ensure 'password' field exists before checking hash
    if "password" not in user or not bcrypt.check_password_hash(user["password"], password):
        return jsonify({"error": "Invalid username or password"}), 400

    # FIX: This now works because app.config["JWT_SECRET_KEY"] is set above.
    access_token = create_access_token(identity={
        "username": user["username"],
        "status": user.get("status", "user")
    })

    return jsonify({"access_token": access_token})

@app.route("/api/me", methods=["GET", "OPTIONS"])
@jwt_required()
def me():
    if request.method == 'OPTIONS':
        return '', 200

    # TODO: Implement user details retrieval
    return jsonify({"message": "User details not implemented yet."}), 200

@app.route("/api/users", methods=["GET", "OPTIONS"])
def get_users():
    if request.method == 'OPTIONS':
        return '', 200
    
    if usersCollection is None:
        return jsonify({"error": "Database not connected"}), 500
    data = list(usersCollection.find({}, {"_id": 0}))
    return jsonify(data)

@app.route("/api/reports", methods=["GET", "OPTIONS"])
def get_submissions():
    print("DEBUG: Hit /api/reports GET route.")
    if request.method == 'OPTIONS':
        return '', 200

    if collection is None:
        return jsonify({"error": "Database not connected"}), 500
    try:
        # Fetch all reports from the 'reports' collection
        data = list(collection.find({}, {"_id": 0}))
        return jsonify(data)
    except Exception as e:
        print(f"ERROR: Database query failed: {e}")
        return jsonify({"error": f"Database query failed: {e}"}), 500


@app.route("/api/reports", methods=["POST", "OPTIONS"])
# Note: This route expects JSON payload
def add_submission_json():
    print("DEBUG: Hit /api/reports POST route (JSON).")
    if request.method == 'OPTIONS':
        return '', 200

    if collection is None:
        return jsonify({"error": "Database not connected"}), 500
    try:
        data = request.json
        
        # Check for empty or invalid JSON payload
        if data is None:
            return jsonify({"error": "Invalid JSON payload. Ensure Content-Type is application/json."}), 400
        
        # Validate incoming data using the schema
        validation_error = _validate_report_data(data)
        if validation_error:
            print(f"ERROR: Validation failed: {validation_error}")
            return jsonify({"error": "Invalid report data format", "details": validation_error}), 400

        # Data is valid, insert into the 'reports' collection
        collection.insert_one(data)
        print(f"DEBUG: Successfully added submission: {data.get('title')}")
        return jsonify({"message": "Report submission added successfully"}), 201
    except Exception as e:
        print(f"ERROR: Failed to add submission: {e}")
        return jsonify({"error": f"Failed to add submission: {e}"}), 500


@app.route("/api/city-quality", methods=["GET", "OPTIONS"])
def city_quality():
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        lat = float(request.args.get("lat"))
        lon = float(request.args.get("lng"))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid coordinates"}), 400
    data = calculate_city_quality_score(lat, lon)
    return jsonify(data), 200

@app.route("/api/communities", methods=["POST", "OPTIONS"])
def save_community():
    if request.method == 'OPTIONS':
        return '', 200

    if collection is None:
        return jsonify({"error": "Database not connected"}), 500

    data = request.json or {}
    
    # Check for empty or invalid JSON payload
    if data is None:
        return jsonify({"error": "Invalid JSON payload. Ensure Content-Type is application/json."}), 400
    
    name = data.get("name")
    centroid = data.get("centroid") or {}
    lat, lon = centroid.get("lat"), centroid.get("lon")

    if not name or lat is None or lon is None:
        return jsonify({"message": "Missing name or coordinates"}), 400

    try:
        doc = {
            "type": "community",
            "name": name,
            "centroid": {"lat": float(lat), "lon": float(lon)},
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        collection.insert_one(doc)
        return jsonify({"message": "Community saved"}), 201
    except Exception as e:
        return jsonify({"message": f"DB error: {e}"}), 500

# This route handles form data/file uploads.
@app.route("/api/reports_file", methods=["POST", "OPTIONS"])
def create_report_file():
    if request.method == 'OPTIONS':
        return '', 200

    if collection is None:
        return jsonify({"error": "Database not connected"}), 500

    form = request.form
    photo = request.files.get("photo")

    title = (form.get("title") or "").strip()
    desc = (form.get("description") or "").strip()
    cat = (form.get("category") or "infrastructure").strip().lower()
    lat, lon = form.get("lat"), form.get("lon")

    if not title or not desc or not photo:
        return jsonify({"message": "Missing required fields (title, description, or photo)"}), 400

    safe_name = secure_filename(photo.filename or "report.jpg")
    ext = os.path.splitext(safe_name)[1] or ".jpg"
    stored_name = f"{uuid4().hex}{ext}"
    
    try:
        photo.save(os.path.join(IMAGES_DIR, stored_name))
    except Exception as e:
        print(f"ERROR: Failed to save photo: {e}")
        return jsonify({"message": f"Failed to save photo: {e}"}), 500


    doc = {
        "type": "report",
        "title": title,
        "description": desc,
        "category": cat if cat in ALL_CATEGORIES else "infrastructure",
        "image": stored_name,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }

    if lat and lon:
        try:
            doc["latitude"] = float(lat)
            doc["longitude"] = float(lon)
        except ValueError:
            pass
    
    try:
        collection.insert_one(doc)
        return jsonify({"message": "Report saved", "imagePath": f"/images/{stored_name}"}), 201
    except Exception as e:
        print(f"ERROR: Failed to insert report document: {e}")
        return jsonify({"message": f"DB error: {e}"}), 500


@app.route("/images/<path:filename>", methods=["GET", "OPTIONS"])
def serve_image(filename):
    if request.method == 'OPTIONS':
        return '', 200
    
    return send_from_directory(IMAGES_DIR, filename)

# ======================================================================
# 7. RUN APP
# ======================================================================

if __name__ == "__main__":
    # Create the images directory if it doesn't exist (needed for upload_photo)
    if not os.path.exists(IMAGES_DIR):
        os.makedirs(IMAGES_DIR)
    
    app.run(port=5000, debug=True)