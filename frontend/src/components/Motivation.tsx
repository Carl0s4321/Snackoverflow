import React from "react";
import { motivation } from "../constants/motive";

export default function MotivationSection() {
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <h2 className="text-3xl font-bold mb-10">What Our App Does</h2>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {motivation.map((item, index) => (
            <div
              key={index}
              className="bg-white p-6 rounded-2xl shadow-md hover:shadow-xl transition transform hover:-translate-y-2"
            >
              <h3 className="text-xl font-semibold mb-3 text-purple-600">
                {item.title}
              </h3>
              <p className="text-gray-600">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
