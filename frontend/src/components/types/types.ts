// types.ts (optional)
export interface User {
    userId: number;
    name: string;
    userName: string;
    status: "admin" | "user";
  }
  
  export interface UserStore {
    user: User | null;
    fetchUser: () => void;
  }
  