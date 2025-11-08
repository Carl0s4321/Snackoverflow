import React from "react";
import LandingScreen from "./Screens/LandingScreen";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";
import Login from "./Screens/Login";
import Register from "./Screens/Register";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import MapView from "./components/map/MapView";

const App = () => {

gsap.registerPlugin(ScrollTrigger);

  return (
    <Router>
      {/* <NavBar /> */}
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/login" element={<Login/>} />
        <Route path="/register" element={<Register/>} />
        <Route path="/map" element={<MapView/>} />
        
    </Routes>
      </Router>
    //   <MapView/>
  );
};

export default App;
