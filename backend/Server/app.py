from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

mongo_uri = os.getenv("MONGO_URI")
client = MongoClient(mongo_uri)
db = client["welivehere"]
collection = db["submissions"]

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

if __name__ == "__main__":
    app.run(port=5000, debug=True)
