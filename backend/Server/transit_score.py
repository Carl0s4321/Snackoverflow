import math
from typing import Tuple

# Coordinates for downtown Calgary, used as the optimal transit hub reference point.
CALGARY_DOWNTOWN_LAT = 51.045
CALGARY_DOWNTOWN_LNG = -114.075

def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the great-circle distance (in km) between two points on Earth 
    using the Haversine formula.
    """
    R = 6371 # Earth radius in km
    
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance_km = R * c
    return distance_km

def get_transit_score(latitude: float, longitude: float) -> Tuple[float, str]:
    """
    Simulates a Transit Accessibility score (1-10) based on proximity to the 
    Calgary downtown core (major transit hub).
    
    Args:
        latitude (float): The target location's latitude.
        longitude (float): The target location's longitude.
        
    Returns:
        Tuple[float, str]: The accessibility score and a descriptive string.
    """
    
    # 1. Calculate distance to the central transit hub
    distance_km = _haversine_distance(
        latitude, 
        longitude, 
        CALGARY_DOWNTOWN_LAT, 
        CALGARY_DOWNTOWN_LNG
    )
    
    # 2. Define scaling parameters:
    # Score 10 is at 0km. Score 2.0 is at 15km.
    MAX_DISTANCE_KM = 15.0 
    SCORE_MAX = 10.0
    SCORE_MIN = 2.0
    
    clamped_distance_km = min(distance_km, MAX_DISTANCE_KM)

    # Linear scaling: Score decreases as distance increases
    # Slope = (SCORE_MIN - SCORE_MAX) / MAX_DISTANCE_KM 
    score = SCORE_MAX + (clamped_distance_km * (SCORE_MIN - SCORE_MAX) / MAX_DISTANCE_KM)
    
    # Ensure score is never below 1.0 (the absolute minimum)
    score = max(1.0, score)
    score = round(score, 1)
    
    # 3. Generate Description
    if score >= 8.5:
        desc_qualifier = "Excellent Access (Walkable to LRT)"
    elif score >= 6.0:
        desc_qualifier = "Good Access (Main Bus Route Coverage)"
    else:
        desc_qualifier = "Limited Access (Suburban/Car Dependent)"
            
    description = f"Transit: {desc_qualifier} ({distance_km:.1f} km from downtown)"
    
    return score, description

if __name__ == "__main__":
    """Allows the script to be run independently for testing."""
    print("--- Transit Accessibility Score Testing ---")
    
    # Test Case 1: Downtown Core (Should score 10.0)
    lat_dt = 51.045
    lng_dt = -114.075
    score_dt, desc_dt = get_transit_score(lat_dt, lng_dt)
    print(f"\nLocation: Downtown Core")
    print(f"Coordinates: ({lat_dt}, {lng_dt})")
    print(f"Final Score: {score_dt}")
    print(f"Details: {desc_dt}")

    # Test Case 2: Mid-Distance (~7km - Should score around 6.0-7.0)
    lat_mid = 51.09
    lng_mid = -114.15
    score_mid, desc_mid = get_transit_score(lat_mid, lng_mid)
    print(f"\nLocation: Inner City Suburb")
    print(f"Coordinates: ({lat_mid}, {lng_mid})")
    print(f"Final Score: {score_mid}")
    print(f"Details: {desc_mid}")
    
    # Test Case 3: Far Distance (>15km - Should score 2.0)
    lat_far = 50.93
    lng_far = -113.88
    score_far, desc_far = get_transit_score(lat_far, lng_far)
    print(f"\nLocation: Distant Suburb")
    print(f"Coordinates: ({lat_far}, {lng_far})")
    print(f"Final Score: {score_far}")
    print(f"Details: {desc_far}")
    
    print("\n--- Testing Complete ---")