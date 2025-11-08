import React from "react";
import LandingScreen from "./Screens/LandingScreen";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";
import Login from "./Screens/Login";
import Register from "./Screens/Register";

const App = () => {
  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<LandingScreen />} />
        <Route path="/login" element={<Login/>} />
        <Route path="/register" element={<Register/>} />
      </Routes>
    </Router>
  );
};

export default App;
