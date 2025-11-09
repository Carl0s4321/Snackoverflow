import React from "react";
import { useLocation } from "react-router-dom";

const Logo = () => {
  const location = useLocation();

  return (
    <div
      className={`text-2xl font-bold tracking-tight text ${
        location.pathname != "/" ? "text-black" : ""
      }`}
    >
      welivehere
    </div>
  );
};

export default Logo;
