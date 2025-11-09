import type { LngLatLike } from "mapbox-gl";

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

export interface Pin {
  id: number;
  title: string;
  description: string;
  coordinates: number[];
  type: string;
}
