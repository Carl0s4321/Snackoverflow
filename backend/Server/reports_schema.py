REPORT_CATEGORIES = ["disaster", "infrastructure", "safety"]

REPORT_SCHEMA = {
    # Title (string, required)
    "title": {"type": str, "required": True},
    
    # Category (string, required, must be one of the predefined list)
    "category": {"type": str, "required": True, "allowed_values": REPORT_CATEGORIES},
    
    # Description (string, required)
    "description": {"type": str, "required": True},
    
    # Geolocation (nested dictionary, required)
    "geolocation": {
        "type": dict, 
        "required": True,
        "schema": {
            "lat": {"type": float, "required": True}, # Latitude (float)
            "lng": {"type": float, "required": True}  # Longitude (float)
        }
    },
    
    # User ID (string, required for tracking)
    "userid": {"type": str, "required": True},
    
    # Timestamp (integer, Unix epoch time, required)
    "timestamp": {"type": int, "required": True},
    
    # Datestamp (string, human-readable date, required)
    "datestamp": {"type": str, "required": True},
    
    # Image Link (string, optional, defaults to empty string)
    "imagelink": {"type": str, "required": False, "default": ""},
}

# The categories list is exported for easy reference
ALL_CATEGORIES = REPORT_CATEGORIES