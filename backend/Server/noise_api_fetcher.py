import requests
import os
import sys
from time import sleep
# NOTE: You will need to install the 'python-dotenv' library: pip install python-dotenv
from dotenv import load_dotenv

# Load environment variables from a .env file
load_dotenv()

# --- Configuration ---
API_KEY = os.getenv('MEERSENS_API_KEY')
# The actual Meersens API endpoint for current noise. 
API_URL = "https://api.meersens.com/environment/public/noise/current"
# ----------------------------------------------------------------------------------

MAX_RETRIES = 3
INITIAL_BACKOFF_SECONDS = 1
# Default return values if the API call fails
DEFAULT_NOISE_LEVEL = 50.0 
DEFAULT_DESCRIPTION = "Moderate (Default Baseline)"


def _classify_noise(level):
    """
    Classifies the noise level (in dBA) into a human-readable description.
    """
    if level < 30:
        return "Very Quiet (e.g., quiet library, bedroom at night)"
    elif 30 <= level < 50:
        return "Quiet (e.g., quiet office, suburban street)"
    elif 50 <= level < 70:
        return "Moderate (e.g., normal conversation, busy restaurant)"
    elif 70 <= level < 85:
        return "Loud (e.g., heavy traffic, vacuum cleaner)"
    else: # >= 85
        return "Very Loud (Potential hearing damage with prolonged exposure)"

def _scale_noise_to_score(dB):
    """
    Scales the average noise level in decibels (dB) to an inverse 1-10 quality score.
    Lower dB (Quieter) means a higher (Better) score.
    """
    dB_MIN = 20    # dB value corresponding to Score 10 (Best)
    dB_MAX = 100   # dB value corresponding to Score 1 (Worst)
    SCORE_MAX = 10.0
    SCORE_MIN = 1.0

    if dB <= dB_MIN:
        return SCORE_MAX
    if dB >= dB_MAX:
        return SCORE_MIN

    slope = (SCORE_MIN - SCORE_MAX) / (dB_MAX - dB_MIN) 
    intercept = SCORE_MAX - (slope * dB_MIN)

    score = (slope * dB) + intercept

    # Return score fixed to one decimal place
    return float(f'{score:.1f}')

def _fetch_data(latitude=None, longitude=None):
    """
    Internal helper to fetch raw noise data from the Meersens API.
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
                return response.json()
            
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

def get_current_noise(latitude=None, longitude=None):
    """
    Main public function to fetch and process the current noise level data.

    Returns:
        tuple: (score: float, value: float, description: str)
               Returns a 1-10 quality score, the raw dB value, and a description.
               Returns default values if the API call fails or data is missing.
    """
    noise_data = _fetch_data(latitude, longitude)
    
    if noise_data and noise_data.get('found'):
        try:
            # Assumes the structure: noise_data['pollutants']['noise']['avg_value']
            noise_level_raw = noise_data.get('pollutants', {}).get('noise', {}).get('avg_value')
            
            if noise_level_raw is not None:
                # Convert the noise level to float
                noise_level = float(noise_level_raw)
                score = _scale_noise_to_score(noise_level)
                description = _classify_noise(noise_level)
                
                return (score, noise_level, description)
            else:
                print("ERROR: 'avg_value' key missing from API response under ['pollutants']['noise'].")
                
        except (ValueError, TypeError, AttributeError) as e:
            print(f"ERROR: Failed to parse noise level from API response: {e}")
            
    # Default return for failure
    return (5.5, DEFAULT_NOISE_LEVEL, f"Data Unavailable - {DEFAULT_DESCRIPTION}")

if __name__ == "__main__":
    
    # --- Check for API Key ---
    if not API_KEY:
        print("\nFATAL ERROR: The MEERSENS_API_KEY environment variable is missing.")
        sys.exit(1)

    latitude = None
    longitude = None
    
    # Check if arguments were provided (e.g., python noise_api_fetcher.py 34.05 -118.24)
    if len(sys.argv) == 3:
        try:
            latitude = float(sys.argv[1])
            longitude = float(sys.argv[2])
            print(f"--- Using Command-Line Arguments: Lat={latitude}, Lng={longitude} ---")
        except ValueError:
            print("ERROR: Invalid command-line arguments. Expected two numeric values (latitude longitude).")
    
    # If no valid arguments were provided (or arguments were invalid), prompt the user
    if latitude is None or longitude is None:
        print("\n--- Interactive Noise Fetcher Test ---")
        print("Enter coordinates to test the Meersens API.")
        
        while True:
            try:
                lat_input = input("Enter Latitude (e.g., 40.7128): ")
                lng_input = input("Enter Longitude (e.g., -74.0060): ")
                
                # We need to make sure input is not empty before converting to float
                if not lat_input or not lng_input:
                    raise ValueError("Input cannot be empty.")
                    
                latitude = float(lat_input)
                longitude = float(lng_input)
                break
            except ValueError as e:
                print(f"Invalid input: {e}. Please enter valid numeric values for latitude and longitude.")
    
    # --- Fetch and Display Results ---
    print(f"\nFetching noise data for: Lat={latitude}, Lng={longitude}")
    score, value, description = get_current_noise(latitude, longitude)
    
    print("\n==================================")
    print("       FINAL NOISE REPORT")
    print("==================================")
    print(f"Noise Quality Score (1-10): {score}")
    print(f"Raw Noise Value: {value} dBA")
    print(f"Description: {description}")
    print("==================================")