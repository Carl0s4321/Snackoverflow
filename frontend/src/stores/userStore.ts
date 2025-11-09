import { create } from "zustand";
import type { User, UserStore } from "../components/types/types";
import {jwtDecode} from "jwt-decode";

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  token: null,

  login: async (username: any, password: any) => {
    try {
      const res = await fetch("http://127.0.0.1:5000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        throw new Error("Invalid credentials");
      }

      const data = await res.json();
      const token = data.access_token;

      const decoded: any = jwtDecode(token);

      set({ user: decoded.sub, token });

      localStorage.setItem("token", token);
    } catch (err) {
      console.error("Login error:", err);
      throw err;
    }
  },
  
  logout: () => {
    set({ user: null, token: null });
    localStorage.removeItem("token");
  },

  fetchUser: async () => {

    

    const res: User = {
      userId: 1,
      name: "John",
      userName: "JohnDoe",
      status: "admin",
    };
    set({ user: res });
  },
}));
