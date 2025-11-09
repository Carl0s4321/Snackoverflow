# ======================================================================
# app.py — Full Working Version (SnackOverflow Backend)
# ======================================================================

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
import os
from dotenv import load_dotenv
import certifi
import requests
from time import sleep
from typing import Dict, Optional, Tuple, Any
from werkzeug.utils import secure_filename
from uuid import uuid4
from datetime import datetime, timezone

# Import your schema
from reports_schema import REPORT_SCHEMA, ALL_CATEGORIES

# ======================================================================
# 0. CONFIGURATION AND WEIGHTS
# ======================================================================

WEIGHTS = {
    "air_quality": 0.60,
    "weather_rating": 0.40,
}

DEFAULT_SCORE = 5.5
DEFAULT_DESCRIPTION = "Data unavailable"

if abs(sum(WEIGHTS.values()) - 1.0) > 0.001:
    raise ValueError("The weights in the WEIGHTS dictionary must sum to 1.0.")

load_dotenv()
API_KEY = os.getenv('MEERSENS_API_KEY')
if not API_KEY:
    print("⚠️  WARNING: MEERSENS_API_KEY not set — API calls may fail.")

# ======================================================================
# 1. FLASK + MONGO SETUP
# ======================================================================

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

mongo_uri = os.getenv("MONGO_URI")
try:
    client = MongoClient(mongo_uri, tlsCAFile=certifi.where())
    db = client["welivehere"]
    collection = db["reports"]
    print("✅ MongoDB connection established (Collection: reports)")
except Exception as e:
    print(f"❌ ERROR: Failed to connect to MongoDB: {e}")
    client = None
    collection = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(BASE_DIR, "..", "images")
os.makedirs(IMAGES_DIR, exist_ok=True)

# ======================================================================
# 2. VALIDATION UTILITY
# ======================================================================

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
# 5. CITY QUALITY CALCULATOR
# ======================================================================

def calculate_city_quality_score(lat: float, lon: float) -> Dict[str, Any]:
    air_score, air_desc = get_air_quality_score(lat, lon)
    weather_score, weather_desc = get_weather_score(lat, lon)
    total = air_score * WEIGHTS["air_quality"] + weather_score * WEIGHTS["weather_rating"]
    return {
        "city_quality_score": round(total, 1),
        "individual_ratings": {
            "air_quality": {"score": air_score, "desc": air_desc, "weight": WEIGHTS["air_quality"]},
            "weather_rating": {"score": weather_score, "desc": weather_desc, "weight": WEIGHTS["weather_rating"]},
        },
    }

# ======================================================================
# 6. FLASK ROUTES
# ======================================================================

@app.route("/")
def home():
    return jsonify({"message": "Backend running"}), 200

@app.route("/api/city-quality")
def city_quality():
    try:
        lat = float(request.args.get("lat"))
        lon = float(request.args.get("lng"))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid coordinates"}), 400
    data = calculate_city_quality_score(lat, lon)
    return jsonify(data), 200

@app.route("/api/communities", methods=["POST"])
def save_community():
    data = request.json or {}
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

@app.route("/api/reports", methods=["GET"])
def get_reports():
    try:
        reports = list(collection.find({"type": "report"}, {"_id": 0}))
        return jsonify(reports), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/reports", methods=["POST"])
def create_report():
    form = request.form
    photo = request.files.get("photo")

    title = (form.get("title") or "").strip()
    desc = (form.get("description") or "").strip()
    cat = (form.get("category") or "infrastructure").strip().lower()
    lat, lon = form.get("lat"), form.get("lon")

    if not title or not desc or not photo:
        return jsonify({"message": "Missing required fields"}), 400

    safe_name = secure_filename(photo.filename or "report.jpg")
    ext = os.path.splitext(safe_name)[1] or ".jpg"
    stored_name = f"{uuid4().hex}{ext}"
    photo.save(os.path.join(IMAGES_DIR, stored_name))

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

    collection.insert_one(doc)
    return jsonify({"message": "Report saved", "imagePath": f"/images/{stored_name}"}), 201

@app.route("/images/<path:filename>")
def serve_image(filename):
    return send_from_directory(IMAGES_DIR, filename)

# ======================================================================
# 7. RUN APP
# ======================================================================

if __name__ == "__main__":
    app.run(port=5000, debug=True)
