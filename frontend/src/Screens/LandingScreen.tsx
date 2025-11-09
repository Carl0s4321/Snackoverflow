import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { Link } from "react-router-dom";

export default function LandingPage() {
  const heroRef = useRef(null);
  const headingRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(
      heroRef.current,
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 1 }
    )
      .fromTo(
        headingRef.current,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.8 },
        "-=0.5"
      )
      .fromTo(
        buttonRef.current,
        { opacity: 0, scale: 0.8 },
        { opacity: 1, scale: 1, duration: 0.6 },
        "-=0.3"
      );
  }, []);

  return (
    <div
      ref={heroRef}
      className="w-screen h-screen flex flex-col justify-center items-center bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 text-white text-center"
    >
      <h1
        ref={headingRef}
        className="text-5xl md:text-6xl font-extrabold mb-6 drop-shadow-lg"
      >
        welivehere
      </h1>
      <p className="text-lg md:text-xl max-w-xl mb-8 opacity-90">subtitle</p>
      <button
        ref={buttonRef}
        className="px-8 py-3 bg-white text-indigo-600 rounded-full font-semibold shadow-lg hover:scale-105 transform transition"
      >
        <Link to="/auth/register">Register</Link>
      </button>
      <button
        ref={buttonRef}
        className="px-8 py-3 bg-white text-indigo-600 rounded-full font-semibold shadow-lg hover:scale-105 transform transition"
      >
        <Link to="/auth/login">Login</Link>
      </button>
    </div>
  );
}
