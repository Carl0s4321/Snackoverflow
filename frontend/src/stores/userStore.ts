import { create } from 'zustand';

// Define the shape of the User object
interface User {
  id: string;
  email: string;
  fullName: string;
  token: string;
  status: string; // Added status for role-based logic
}

// Define the shape of the store state and actions
interface UserStore {
  user: User | null;
  isLoggedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  fetchUser: () => Promise<void>;
  logout: () => void;
  // FIX: This utility function was used inside the store but not defined in the interface.
  setAuthToken: (token: string) => void; 
}

const API_BASE_URL = "http://127.0.0.1:5000";

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  isLoggedIn: false,

  // Utility to store token after successful auth
  setAuthToken: (token: string) => {
    localStorage.setItem('access_token', token);
  },

  // --- Login Function ---
  login: async (email, password) => {
    console.log(`[STORE] Attempting login for ${email}`);
    
    const response = await fetch(`${API_BASE_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password: password }), // Backend uses 'username'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Login failed.");
    }
    
    const data = await response.json();
    (get() as any).setAuthToken(data.access_token); // Use setAuthToken
    
    // We immediately fetch the user details using the new token
    await get().fetchUser(); 
  },

  // --- Register Function ---
  register: async (fullName, email, password) => {
    console.log(`[STORE] Attempting registration for ${email}`);

    const response = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fullName: fullName, 
          username: email, 
          password: password 
        }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Registration failed.");
    }

    // After successful registration, immediately log the user in
    await get().login(email, password);
  },

  // --- Fetch User Function (for persistence/initial load) ---
  fetchUser: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      set({ user: null, isLoggedIn: false });
      return;
    }

    console.log("[STORE] Checking user session via API/ME...");

    const response = await fetch(`${API_BASE_URL}/api/me`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}` 
      },
    });

    if (response.ok) {
      const userData = await response.json();
      const user: User = {
        id: userData.id, // Assuming backend provides an ID
        email: userData.username, 
        fullName: userData.fullName || 'User',
        token: token,
        status: userData.status || 'user',
      };
      set({ user, isLoggedIn: true });
    } else {
      console.error("[STORE] Token invalid or expired. Logging out.");
      localStorage.removeItem('access_token');
      set({ user: null, isLoggedIn: false });
    }
  },

  // --- Logout Function ---
  logout: () => {
    localStorage.removeItem('access_token');
    set({ user: null, isLoggedIn: false });
  },
}));