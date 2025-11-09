import React from "react";
import type { Pin } from "./types/types";
interface ReportProps {
  pin: Pin;
}

const Report = ({ pin }: ReportProps) => {
  return (
    <div>
      <h2 className="text-xl font-bold">{pin.title}</h2>
      <p>{pin.description}</p>
    </div>
  );
};

export default Report;
