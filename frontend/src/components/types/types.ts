import type { LngLatLike } from "mapbox-gl";

export interface User {
  userId: number;
  name: string;
  userName: string;
  status: "admin" | "user";
}

export interface UserStore {
  user: User | null;
  token: any;
  login: (username: any, password: any) => Promise<void>
  fetchUser: () => void;
  logout: () => void
}

export interface Pin {
  id: number;
  title: string;
  description: string;
  coordinates: number[];
  type: string;
}

export interface CommunityQuality {
  city_quality_score: number;
  scores: Record<
    string,
    { score: number; description: string; weight: number }
  >;
  message?: string;
}
