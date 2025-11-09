import React, { useEffect } from "react";
import LandingScreen from "./Screens/LandingScreen";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import AuthPage from "./Screens/AuthScreen";
import MapView from "./components/map/MapView";
import { useUserStore } from "./stores/userStore";

const App = () => {
  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/auth/:type" element={<AuthPage />} />
        <Route path="/map" element={<MapView />} />
      </Routes>
    </Router>
  );
};

export default App;
