import requests
import os
import sys
from time import sleep
from dotenv import load_dotenv
import json 

# Load environment variables from a .env file
load_dotenv()

# --- Configuration ---
# Uses the same API key as noise, assuming Meersens API uses a single key.
API_KEY = os.getenv('MEERSENS_API_KEY') 
# Meersens API endpoint for current air quality.
API_URL = "https://api.meersens.com/environment/public/air/current"
# ----------------------------------------------------------------------------------

MAX_RETRIES = 3
INITIAL_BACKOFF_SECONDS = 1
# Default return values if the API call fails
DEFAULT_SCORE = 5.5 
DEFAULT_DESCRIPTION = "Moderate (Data unavailable)"
DEFAULT_MEERSENS_INDEX = 50.0 # Use 50 as the neutral point on a 0-100 scale


def _scale_maqi_to_score(maqi_value):
    """
    Scales the proprietary Meersens Air Quality Index (MAQI) from a 0-100 scale
    (where 0 is best, 100 is worst) to an inverse 1-10 quality score.

    Score = 10 - (0.09 * MAQI)
    
    @param maqi_value: The raw MAQI value (float, expected 0.0 to 100.0).
    @returns: The calculated quality score (1.0 to 10.0).
    """
    MAQI_MIN = 0.0    # MAQI value corresponding to Score 10 (Best)
    MAQI_MAX = 100.0  # MAQI value corresponding to Score 1 (Worst)
    SCORE_MAX = 10.0
    SCORE_MIN = 1.0
    
    # 1. Clamp the input MAQI value
    maqi_clamped = max(MAQI_MIN, min(MAQI_MAX, maqi_value))

    # 2. Linear scaling: Score = m * MAQI + b
    # Slope (m) = (SCORE_MIN - SCORE_MAX) / (MAQI_MAX - MAQI_MIN) = (1 - 10) / (100 - 0) = -9 / 100 = -0.09
    slope = (SCORE_MIN - SCORE_MAX) / (MAQI_MAX - MAQI_MIN)

    # Intercept (b) = SCORE_MAX - slope * MAQI_MIN = 10.0 - (-0.09 * 0) = 10.0
    intercept = SCORE_MAX - (slope * MAQI_MIN)

    score = (slope * maqi_clamped) + intercept

    # Return score fixed to one decimal place
    return float(f'{score:.1f}')


def _fetch_data(latitude=None, longitude=None):
    """
    Internal helper to fetch raw air quality data from the Meersens API.
    Handles network errors and retries.
    
    Returns the raw JSON data (dict) on success, or None on failure.
    """
    if not API_KEY:
        print("ERROR: API_KEY is not set. Ensure 'MEERSENS_API_KEY' is in your .env file.")
        return None
    
    headers = {
        "apikey": API_KEY,
        "Accept": "application/json"
    }

    params = {}
    if latitude is not None and longitude is not None:
        params['lat'] = latitude
        params['lng'] = longitude
    else:
         print("WARNING: Latitude and longitude were not provided. API may return an irrelevant default location.")

    
    backoff_time = INITIAL_BACKOFF_SECONDS
    
    for attempt in range(MAX_RETRIES):
        try:
            print(f"Attempting to fetch data (Attempt {attempt + 1})...")
            response = requests.get(API_URL, headers=headers, params=params, timeout=10) 
            
            if response.status_code == 200:
                print("Successfully fetched data.")
                
                # Extract and pretty-print the raw JSON response
                raw_json_data = response.json()
                print("\n--- RAW JSON API RESPONSE START ---")
                print(json.dumps(raw_json_data, indent=2))
                print("--- RAW JSON API RESPONSE END ---\n")
                
                return raw_json_data
            
            elif response.status_code == 401:
                print("API Error: Authentication failed. Check your API key and permissions.")
                break
            
            else:
                print(f"API Error (Status {response.status_code}): {response.text}")
                
        except requests.exceptions.RequestException as e:
            print(f"Network error on attempt {attempt + 1}: {e}")
        
        if attempt < MAX_RETRIES - 1:
            print(f"Retrying in {backoff_time} seconds...")
            sleep(backoff_time)
            backoff_time *= 2
        else:
            print("Maximum retries reached. Failing to fetch data.")
            break

    return None

def get_current_air(latitude=None, longitude=None):
    """
    Main public function to fetch and process the current air quality data.
    
    Returns:
        tuple: (score: float, index_value: float, description: str)
               Returns a 1-10 quality score (derived from MAQI), the raw 
               MAQI value, and the official qualification description. 
               Returns default values if the API call fails.
    """
    air_data = _fetch_data(latitude, longitude)
    
    if air_data and air_data.get('found'):
        try:
            # 1. Get the Raw MAQI Value (e.g., 71.05)
            raw_maqi_value = air_data.get('index', {}).get('value')
            
            # 2. Get the Qualification String (e.g., 'Poor') for the description
            qualification = air_data.get('index', {}).get('qualification')
            
            if raw_maqi_value is not None:
                maqi_float = float(raw_maqi_value)
                
                # 3. Calculate the score using the 0-100 scale conversion
                score = _scale_maqi_to_score(maqi_float)
                
                # 4. Use the official API qualification string as the description
                description = f"{qualification} (MAQI: {score})"
                
                # Return (score, raw_value, description)
                return (score, maqi_float, description)
            else:
                print("ERROR: 'value' key missing from API response under ['index'].")
                
        except (ValueError, TypeError, AttributeError) as e:
            print(f"ERROR: Failed to parse air quality data from API response: {e}")
            
    # Default return for failure
    return (DEFAULT_SCORE, DEFAULT_MEERSENS_INDEX, f"Data Unavailable - {DEFAULT_DESCRIPTION}")

if __name__ == "__main__":
    
    # --- Check for API Key ---
    if not API_KEY:
        print("\nFATAL ERROR: The MEERSENS_API_KEY environment variable is missing.")
        sys.exit(1)

    latitude = None
    longitude = None
    
    # Check if arguments were provided (e.g., python air_api_fetcher.py 34.05 -118.24)
    if len(sys.argv) == 3:
        try:
            latitude = float(sys.argv[1])
            longitude = float(sys.argv[2])
            print(f"--- Using Command-Line Arguments: Lat={latitude}, Lng={longitude} ---")
        except ValueError:
            print("ERROR: Invalid command-line arguments. Expected two numeric values (latitude longitude).")
    
    # If no valid arguments were provided (or arguments were invalid), prompt the user
    if latitude is None or longitude is None:
        print("\n--- Interactive Air Quality Fetcher Test ---")
        print("Enter coordinates to test the Meersens API.")
        
        while True:
            try:
                lat_input = input("Enter Latitude (e.g., 40.7128): ")
                lng_input = input("Enter Longitude (e.g., -74.0060): ")
                
                if not lat_input or not lng_input:
                    raise ValueError("Input cannot be empty.")
                    
                latitude = float(lat_input)
                longitude = float(lng_input)
                break
            except ValueError as e:
                print(f"Invalid input: {e}. Please enter valid numeric values for latitude and longitude.")
    
    # --- Fetch and Display Results ---
    print(f"\nFetching air quality data for: Lat={latitude}, Lng={longitude}")
    score, value, description = get_current_air(latitude, longitude)
    
    print("\n==================================")
    print("      FINAL AIR QUALITY REPORT")
    print("==================================")
    print(f"Air Quality Score (1-10): {score}")
    print(f"Raw Meersens MAQI (0-100): {value}")
    print(f"Description: {description}")
    print("==================================")