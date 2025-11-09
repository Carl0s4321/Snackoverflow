from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
import os
from dotenv import load_dotenv
import certifi
from datetime import datetime
from uuid import uuid4
from werkzeug.utils import secure_filename

load_dotenv()

app = Flask(__name__)
CORS(app)

mongo_uri = os.getenv("MONGO_URI")
client = MongoClient(mongo_uri, tlsCAFile=certifi.where())
db = client["welivehere"]
collection = db["submissions"]
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
IMAGES_DIR = os.path.join(BASE_DIR, "..", "images")
os.makedirs(IMAGES_DIR, exist_ok=True)

@app.route("/")
def home():
    return jsonify({"message": "Flask backend running and connected to MongoDB"})

@app.route("/api/submissions", methods=["GET"])
def get_submissions():
    data = list(collection.find({}, {"_id": 0}))
    return jsonify(data)

@app.route("/api/submissions", methods=["POST"])
def add_submission():
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
