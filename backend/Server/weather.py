import requests
from typing import Dict, Optional


class WeatherService:
    """Service for fetching weather data from Meersens API and calculating weather ratings."""

    BASE_URL = "https://api.meersens.com/environment/public/weather/current"
    OPTIMAL_TEMP = 25.0  # Optimal temperature in Celsius

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the WeatherService.

        Args:
            api_key: Meersens API key. If not provided, uses default key
        """
        self.api_key = api_key or 'WFWUTYplyI2yWoN2YLsFwarDasFykeEu'

    def get_current_weather(self, lat: float, lng: float) -> Dict:
        """
        Fetch current weather conditions from Meersens API.

        Args:
            lat: Latitude coordinate
            lng: Longitude coordinate

        Returns:
            Dictionary containing weather data from the API

        Raises:
            requests.RequestException: If the API request fails
        """
        try:
            response = requests.get(
                self.BASE_URL,
                headers={'apikey': self.api_key},
                params={'lat': lat, 'lng': lng}
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            raise Exception(f"Failed to fetch weather data: {str(e)}")

    def get_weather_description(self, weather_data: Dict) -> str:
        """
        Generate a human-readable description of the current weather conditions.

        Args:
            weather_data: Weather data dictionary from the API

        Returns:
            A descriptive string of the weather conditions
        """
        parameters = weather_data.get("parameters", {})

        # Extract weather parameters
        temperature = parameters.get("temperature", {}).get("value")
        weather_condition = parameters.get("weather_condition", {}).get("value")
        cloud_cover = parameters.get("cloud_cover", {}).get("value")
        wind_speed = parameters.get("wind_speed", {}).get("value")

        # Build description parts
        description_parts = []

        # Weather condition (e.g., clear, cloudy, rainy)
        if weather_condition:
            condition_text = weather_condition.lower()
            description_parts.append(f"It is {condition_text}")
        elif cloud_cover is not None:
            # Fallback to cloud cover if weather condition is not available
            if cloud_cover < 20:
                description_parts.append("It is clear")
            elif cloud_cover < 50:
                description_parts.append("It is partly cloudy")
            elif cloud_cover < 80:
                description_parts.append("It is mostly cloudy")
            else:
                description_parts.append("It is overcast")

        # Temperature description
        if temperature is not None:
            if temperature < 0:
                temp_desc = "freezing"
            elif temperature < 10:
                temp_desc = "cold"
            elif temperature < 20:
                temp_desc = "cool"
            elif temperature < 28:
                temp_desc = "pleasant"
            elif temperature < 35:
                temp_desc = "warm"
            else:
                temp_desc = "hot"
            description_parts.append(f"and {temp_desc} ({temperature}°C)")

        # Wind description
        if wind_speed is not None:
            if wind_speed < 5:
                wind_desc = "calm"
            elif wind_speed < 15:
                wind_desc = "breezy"
            elif wind_speed < 25:
                wind_desc = "windy"
            else:
                wind_desc = "very windy"
            description_parts.append(f"with {wind_desc} conditions")

        # Join all parts
        if description_parts:
            return " ".join(description_parts) + "."
        else:
            return "Weather data unavailable."

    def calculate_weather_rating(self, weather_data: Dict) -> float:
        """
        Calculate a weather rating out of 10 based on temperature deviation from optimal (25�C).

        The rating decreases as temperature deviates from 25�C in either direction.
        - At 25�C: rating = 10.0
        - Rating decreases linearly with temperature deviation
        - Rating reaches 0 at -40�C (lower bound) or 90�C (upper bound)

        Args:
            weather_data: Weather data dictionary from the API

        Returns:
            Weather rating from 0 to 10
        """
        # Extract temperature value from the weather data
        # The temperature is nested in parameters.temperature.value
        temperature = weather_data.get("parameters", {}).get("temperature", {}).get("value")

        if temperature is None:
            raise ValueError("Temperature value not found in weather data")

        # Lower bound is -40�C, upper bound is 90�C (symmetric around 25�C)
        # Deviation from optimal: 25 - (-40) = 65 degrees
        lower_bound = -40.0
        upper_bound = 90.0
        max_deviation = 65.0  # Distance from optimal (25�C) to lower bound (-40�C)

        # Calculate deviation from optimal temperature
        deviation = abs(temperature - self.OPTIMAL_TEMP)

        # Calculate rating (10 at optimal, 0 at max deviation)
        # Linear decrease: rating = 10 - (deviation / max_deviation) * 10
        rating = max(0, 10 - (deviation / max_deviation) * 10)

        return round(rating, 2)

    def get_weather_with_rating(self, lat: float, lng: float) -> Dict:
        """
        Fetch weather data and calculate rating in one call.

        Args:
            lat: Latitude coordinate
            lng: Longitude coordinate

        Returns:
            Dictionary containing weather data, calculated rating, and description
        """
        weather_data = self.get_current_weather(lat, lng)
        rating = self.calculate_weather_rating(weather_data)
        description = self.get_weather_description(weather_data)

        return {
            'weather_data': weather_data,
            'rating': rating,
            'description': description,
            'temperature': weather_data.get('parameters', {}).get('temperature', {}).get('value'),
            'optimal_temperature': self.OPTIMAL_TEMP
        }


# Example usage
if __name__ == "__main__":
    # Example coordinates (New York City)
    lat = 51.0447
    lng = 114.0719

    # Initialize the service (make sure to set MEERSENS_API_KEY environment variable)
    try:
        weather_service = WeatherService()

        # Get weather data
        weather_data = weather_service.get_current_weather(lat, lng)
        # print(f"Weather Data: {weather_data}")

        # Calculate rating
        rating = weather_service.calculate_weather_rating(weather_data)
        print(f"Weather Rating: {rating}/10")

        # Get weather description
        description = weather_service.get_weather_description(weather_data)
        print(f"Weather Description: {description}")

        # Or get everything at once
        result = weather_service.get_weather_with_rating(lat, lng)
        print(f"\nCombined Result:")
        print(f"  Rating: {result['rating']}/10")
        print(f"  Description: {result['description']}")
        print(f"  Temperature: {result['temperature']}°C")

    except Exception as e:
        print(f"Error: {e}")
