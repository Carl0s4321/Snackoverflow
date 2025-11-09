import { create } from "zustand";
import type { User, UserStore } from "../components/types/types";

export const useUserStore = create<UserStore>((set) => ({
  user: null,
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
