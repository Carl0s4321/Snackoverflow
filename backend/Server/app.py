from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
import os
from dotenv import load_dotenv
import certifi
import requests
from time import sleep # Retained, though not used in the simplified fetchers
from typing import Dict, Optional, Tuple, Any

# Import the schema for report validation (Assumes reports_schema.py is in the same directory)
from reports_schema import REPORT_SCHEMA, ALL_CATEGORIES

# ==============================================================================
# 0. CONFIGURATION AND WEIGHTS
# ==============================================================================

# Define the weight for each environmental factor (must sum to 1.0)
WEIGHTS = {
    "air_quality": 0.60,  # 60% weight for Air Quality
    "weather_rating": 0.40, # 40% weight for Weather Rating
}

# Ensure weights sum to 1.0 (simple check)
if abs(sum(WEIGHTS.values()) - 1.0) > 0.001:
    raise ValueError("The weights in the WEIGHTS dictionary must sum to 1.0.")

# API Settings
DEFAULT_SCORE = 5.5 
DEFAULT_DESCRIPTION = "Data unavailable"

# Load environment variables
load_dotenv()
API_KEY = os.getenv('MEERSENS_API_KEY')
if not API_KEY:
    print("WARNING: MEERSENS_API_KEY is not set. API calls will likely fail.")

# ==============================================================================
# 1. FLASK AND MONGODB SETUP
# ==============================================================================

app = Flask(__name__)
CORS(app)

mongo_uri = os.getenv("MONGO_URI")
try:
    client = MongoClient(mongo_uri, tlsCAFile=certifi.where())
    db = client["welivehere"]
    # Use the 'reports' collection for submissions
    collection = db["reports"]
    print("INFO: MongoDB connection established (Collection: reports).")
except Exception as e:
    print(f"ERROR: Failed to connect to MongoDB: {e}")
    client = None
    collection = None

# ==============================================================================
# 2. VALIDATION UTILITY
# ==============================================================================

def _validate_report_data(data: Dict) -> Optional[str]:
    """Validates incoming report data against the REPORT_SCHEMA."""
    if not isinstance(data, dict):
        return "Payload must be a JSON object."

    for field, rules in REPORT_SCHEMA.items():
        is_required = rules.get("required", False)
        
        # 1. Check for missing required fields
        if is_required and field not in data:
            return f"Missing required field: '{field}'"

        if field in data:
            value = data[field]
            expected_type = rules["type"]
            
            # 2. Check type
            if not isinstance(value, expected_type):
                return f"Field '{field}' must be of type {expected_type.__name__}, got {type(value).__name__}"

            # 3. Check specific category constraints
            if field == "category" and value not in rules.get("allowed_values", []):
                allowed = ', '.join(rules['allowed_values'])
                return f"Field 'category' must be one of: {allowed}"
            
            # 4. Check nested geolocation structure
            if field == "geolocation":
                geo_schema = rules["schema"]
                for geo_field, geo_rules in geo_schema.items():
                    if geo_field not in value:
                        return f"Missing required geolocation sub-field: '{geo_field}'"
                    if not isinstance(value[geo_field], geo_rules["type"]):
                        return f"Geolocation field '{geo_field}' must be of type {geo_rules['type'].__name__}"
                        
    return None # Validation passed

# ==============================================================================
# 3. AIR QUALITY SERVICE
# (Meersens MAQI 0-100 where 0=best, 100=worst)
# ==============================================================================

def _scale_maqi_to_score(maqi_value: float) -> float:
    """Scales MAQI (0-100, 100=worst) to a 1-10 quality score (10=best)."""
    MAQI_MIN = 0.0
    MAQI_MAX = 100.0
    SCORE_MAX = 10.0
    SCORE_MIN = 1.0
    
    maqi_clamped = max(MAQI_MIN, min(MAQI_MAX, maqi_value))
    # Slope = -0.09
    slope = (SCORE_MIN - SCORE_MAX) / (MAQI_MAX - MAQI_MIN)
    intercept = SCORE_MAX
    score = (slope * maqi_clamped) + intercept
    
    # Clamp minimum score to 1.0
    score = max(SCORE_MIN, score)
    
    return float(f'{score:.1f}')

def get_air_quality_score(latitude: float, longitude: float) -> Tuple[float, str]:
    """Fetches air quality and returns a (score_1_10, description) tuple."""
    print(f"DEBUG: Starting Air Quality fetch for {latitude},{longitude}")
    url = "https://api.meersens.com/environment/public/air/current"
    
    if not API_KEY:
        print("ERROR: API_KEY is missing. Cannot fetch Air Quality data.")
        return DEFAULT_SCORE, f"Air: {DEFAULT_DESCRIPTION} (API Key Missing)"

    try:
        response = requests.get(url, headers={'apikey': API_KEY}, params={'lat': latitude, 'lng': longitude}, timeout=10)
        response.raise_for_status() # Raises an exception for 4xx or 5xx status codes
        air_data = response.json()
        
        if air_data.get('found'):
            raw_maqi_value = air_data.get('index', {}).get('value')
            qualification = air_data.get('index', {}).get('qualification')
            
            if raw_maqi_value is not None and qualification is not None:
                maqi_float = float(raw_maqi_value)
                score = _scale_maqi_to_score(maqi_float)
                description = f"Air: {qualification}"
                print("DEBUG: Successfully fetched and calculated Air Quality score.")
                return score, description

    except (requests.RequestException, ValueError, TypeError) as e:
        print(f"ERROR: Air Quality API failure: {e}")
    
    print("DEBUG: Air Quality fetch returning default score.")
    return DEFAULT_SCORE, f"Air: {DEFAULT_DESCRIPTION}"

# ==============================================================================
# 4. WEATHER SERVICE
# (Based on temperature deviation from 25°C)
# ==============================================================================

class WeatherService:
    OPTIMAL_TEMP = 25.0
    BASE_URL = "https://api.meersens.com/environment/public/weather/current"

    def get_weather_data(self, lat: float, lng: float) -> Dict[str, Any]:
        """Fetch raw weather data from Meersens API."""
        response = requests.get(
            self.BASE_URL,
            headers={'apikey': API_KEY},
            params={'lat': lat, 'lng': lng},
            timeout=10
        )
        response.raise_for_status()
        return response.json()

    def calculate_weather_rating(self, weather_data: Dict[str, Any]) -> float:
        """Calculate a weather rating out of 10 based on temperature deviation."""
        temperature = weather_data.get("parameters", {}).get("temperature", {}).get("value")
        if temperature is None:
            # If temp is missing, assign the default score
            return DEFAULT_SCORE

        # Max deviation from optimal (25C) to bounds (-40C or 90C) is 65 degrees
        max_deviation = 65.0
        deviation = abs(temperature - self.OPTIMAL_TEMP)
        
        # Rating reaches 1.0 at max deviation (to keep it a 1-10 scale)
        rating = max(1.0, 10 - (deviation / max_deviation) * 10) 
        return round(rating, 1)

    def get_weather_description(self, weather_data: Dict[str, Any]) -> str:
        """Generate a short description of the weather (condition and temperature)."""
        parameters = weather_data.get("parameters", {})
        temperature = parameters.get("temperature", {}).get("value")
        weather_condition = parameters.get("weather_condition", {}).get("value")

        condition_text = weather_condition.lower() if weather_condition else "Unknown"
        
        if temperature is not None:
            if temperature < 0: temp_desc = "Freezing"
            elif temperature < 10: temp_desc = "Cold"
            elif temperature < 20: temp_desc = "Cool"
            elif temperature < 28: temp_desc = "Pleasant"
            elif temperature < 35: temp_desc = "Warm"
            else: temp_desc = "Hot"
            
            return f"Weather: {condition_text.title()}, {temp_desc} ({temperature}°C)"
        
        return f"Weather: {condition_text.title()}"


def get_weather_score(latitude: float, longitude: float) -> Tuple[float, str]:
    """Fetches weather data and returns a (score_1_10, description) tuple."""
    print(f"DEBUG: Starting Weather fetch for {latitude},{longitude}")
    service = WeatherService()

    if not API_KEY:
        print("ERROR: API_KEY is missing. Cannot fetch Weather data.")
        return DEFAULT_SCORE, f"Weather: {DEFAULT_DESCRIPTION} (API Key Missing)"

    try:
        weather_data = service.get_weather_data(latitude, longitude)
        rating = service.calculate_weather_rating(weather_data)
        description = service.get_weather_description(weather_data)
        print("DEBUG: Successfully fetched and calculated Weather score.")
        return rating, description
    except (requests.RequestException, ValueError, TypeError, Exception) as e:
        print(f"ERROR: Weather API failure: {e}")
    
    print("DEBUG: Weather fetch returning default score.")
    return DEFAULT_SCORE, f"Weather: {DEFAULT_DESCRIPTION}"

# ==============================================================================
# 5. CORE CITY QUALITY LOGIC
# ==============================================================================

def calculate_city_quality_score(lat: float, lng: float) -> Dict[str, Any]:
    """
    Fetches scores from Air Quality and Weather APIs, calculates the weighted average,
    and formats the final output for the frontend.
    """
    
    # 1. Fetch individual scores and descriptions
    print("DEBUG: Starting individual score fetching.")
    
    # Air Quality
    air_score, air_desc = get_air_quality_score(lat, lng)

    # Weather Rating
    weather_score, weather_desc = get_weather_score(lat, lng)
    
    print("DEBUG: Completed individual score fetching.")
    
    # 2. Compile scores for averaging
    scores = {
        "air_quality": air_score,
        "weather_rating": weather_score,
    }

    # 3. Calculate the Weighted Average Score
    total_weighted_score = 0.0
    for factor, score in scores.items():
        weight = WEIGHTS.get(factor, 0.0)
        total_weighted_score += score * weight
    
    # Final City Quality Score (clamp and format)
    city_quality_score = round(total_weighted_score, 1)

    # 4. Format Output
    print(f"DEBUG: Final Calculated Score: {city_quality_score}")
    return {
        "city_quality_score": city_quality_score,
        "individual_ratings": {
            "air_quality": {"score": air_score, "description": air_desc, "weight": WEIGHTS["air_quality"]},
            "weather_rating": {"score": weather_score, "description": weather_desc, "weight": WEIGHTS["weather_rating"]},
        },
        "weights_used": WEIGHTS,
        "message": "City Quality Score calculated successfully."
    }

# ==============================================================================
# 6. FLASK ROUTES
# ==============================================================================

@app.route("/")
def home():
    print("DEBUG: Hit / route.")
    return jsonify({"message": "Flask backend running and connected to MongoDB"})

@app.route("/api/reports", methods=["GET"])
def get_submissions():
    print("DEBUG: Hit /api/reports GET route.")
    if collection is None:
        return jsonify({"error": "Database not connected"}), 500
    try:
        # Fetch all reports from the 'reports' collection
        # This data, including the 'geolocation' field, is what the frontend needs for mapping.
        data = list(collection.find({}, {"_id": 0}))
        return jsonify(data)
    except Exception as e:
        print(f"ERROR: Database query failed: {e}")
        return jsonify({"error": f"Database query failed: {e}"}), 500


@app.route("/api/reports", methods=["POST"])
def add_submission():
    print("DEBUG: Hit /api/reports POST route.")
    if collection is None:
        return jsonify({"error": "Database not connected"}), 500
    try:
        data = request.json
        
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


@app.route("/api/city-quality", methods=["GET"])
def get_city_quality():
    """
    API endpoint to fetch and calculate the City Quality Score for given coordinates.
    Expects: ?lat=<latitude>&lng=<longitude>
    """
    print("DEBUG: --- BEGIN /api/city-quality ROUTE EXECUTION ---") 
    try:
        # Get coordinates from query parameters
        latitude = float(request.args.get("lat"))
        longitude = float(request.args.get("lng"))
        print(f"DEBUG: Parsed coordinates: Lat={latitude}, Lng={longitude}")
        
        # Calculate score and format data
        result = calculate_city_quality_score(latitude, longitude)
        
        print("DEBUG: --- END /api/city-quality ROUTE EXECUTION (Success) ---")
        return jsonify(result), 200

    except (TypeError, ValueError):
        print("ERROR: Invalid lat/lng parameters.")
        return jsonify({
            "error": "Invalid or missing latitude/longitude parameters.",
            "expected_format": "/api/city-quality?lat=40.7128&lng=-74.0060"
        }), 400
    except Exception as e:
        print(f"FATAL ERROR: CITY QUALITY ROUTE FAILED: {e}")
        return jsonify({"error": "An internal error occurred while fetching data."}), 500

    data = request.json
    collection.insert_one(data)
    return jsonify({"message": "Submission added"}), 201

@app.route("/api/submissions/photo", methods=["POST"])
def upload_photo():
    if "photo" not in request.files:
        return jsonify({"message": "Photo is required"}), 400

    lat = request.form.get("lat")
    lon = request.form.get("lon")
    notes = request.form.get("notes")

    if lat is None or lon is None:
        return jsonify({"message": "Latitude and longitude are required"}), 400

    try:
        lat_val = float(lat)
        lon_val = float(lon)
    except ValueError:
        return jsonify({"message": "Latitude/longitude must be numbers"}), 400

    photo = request.files["photo"]
    if photo.filename == "":
        return jsonify({"message": "Photo filename is empty"}), 400

    safe_name = secure_filename(photo.filename)
    extension = os.path.splitext(safe_name)[1] or ".jpg"
    stored_name = f"{uuid4().hex}{extension}"
    save_path = os.path.join(IMAGES_DIR, stored_name)
    photo.save(save_path)

    document = {
        "type": "photo",
        "latitude": lat_val,
        "longitude": lon_val,
        "image": stored_name,
        "createdAt": datetime.utcnow().isoformat() + "Z",
    }
    if notes:
        document["notes"] = notes
    collection.insert_one(document)

    return jsonify(
        {"message": "Photo submission stored", "imagePath": f"/images/{stored_name}"}
    ), 201

@app.route("/api/communities", methods=["POST"])
def save_community():
    data = request.json or {}
    name = data.get("name")
    centroid = data.get("centroid") or {}
    lat = centroid.get("lat")
    lon = centroid.get("lon")

    if not name or lat is None or lon is None:
        return (
            jsonify({"message": "Community name and centroid (lat/lon) are required."}),
            400,
        )

    try:
        lat_val = float(lat)
        lon_val = float(lon)
    except (TypeError, ValueError):
        return jsonify({"message": "Centroid lat/lon must be numeric."}), 400

    document = {
        "type": "community",
        "name": name,
        "centroid": {"lat": lat_val, "lon": lon_val},
        "createdAt": datetime.utcnow().isoformat() + "Z",
    }
    collection.insert_one(document)

    return jsonify({"message": "Community saved."}), 201

@app.route("/api/reports", methods=["POST"])
def create_report():
    title = (request.form.get("title") or "").strip()
    description = (request.form.get("description") or "").strip()
    lat = request.form.get("lat")
    lon = request.form.get("lon")
    photo = request.files.get("photo")

    if not title or not description:
        return jsonify({"message": "Title and description are required."}), 400

    if photo is None:
        return jsonify({"message": "Report photo is required."}), 400

    lat_val = lon_val = None
    if lat and lon:
        try:
            lat_val = float(lat)
            lon_val = float(lon)
        except ValueError:
            return jsonify({"message": "Latitude/longitude must be numeric."}), 400

    safe_name = secure_filename(photo.filename or "report.jpg")
    extension = os.path.splitext(safe_name)[1] or ".jpg"
    stored_name = f"{uuid4().hex}{extension}"
    save_path = os.path.join(IMAGES_DIR, stored_name)
    photo.save(save_path)

    document = {
        "type": "report",
        "title": title,
        "description": description,
        "image": stored_name,
        "createdAt": datetime.utcnow().isoformat() + "Z",
    }
    if lat_val is not None and lon_val is not None:
        document["latitude"] = lat_val
        document["longitude"] = lon_val

    collection.insert_one(document)

    return jsonify(
        {
            "message": "Report saved.",
            "imagePath": f"/images/{stored_name}",
        }
    ), 201

@app.route("/images/<path:filename>", methods=["GET"])
def serve_image(filename):
    return send_from_directory(IMAGES_DIR, filename)

if __name__ == "__main__":
    app.run(port=5000, debug=True)
