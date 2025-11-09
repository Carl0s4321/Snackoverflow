/**
 * Defines the structure for a single detailed rating within the API response's
 * 'individual_ratings' map (e.g., the structure for 'air_quality' or 'transit_score').
 */
export interface RatingDetail {
    score: number;
    description: string;
    weight: number;
}

/**
 * Defines the canonical structure of the API response for the city quality score.
 */
export interface CityQualityData {
    city_quality_score: number;
    // This is a Record/Map where keys are the rating names (e.g., "air_quality")
    // and values are the detailed rating objects (RatingDetail).
    individual_ratings: Record<string, RatingDetail>;
    weights_used?: Record<string, number>;
    message?: string;
}

// --- Original Interfaces (retained for other components) ---

export interface User {
    _id: string; // The MongoDB ObjectId for the User
    username: string;
    status: 'user' | 'admin'; // Using a union type for status
    // Note: Password and other sensitive fields should generally not be included in client-side types
}

export interface UserStore {
    user: User | null;
    token: any;
    login: (username: any, password: any) => Promise<void>;
    fetchUser: () => void;
    logout: () => void;
}

export interface Pin {
    _id: number;
    title: string;
    description: string;
    latitude: number;
    longitude: number;
    type: 'report' | 'mock' | 'event';
    userId?: string; // Optional user ID for authorship checks
    createdAt?: string; // Optional creation timestamp
}