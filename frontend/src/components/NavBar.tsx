import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import Logo from "./Logo";
import {links} from "../constants/navLinks"

export default function Navbar() {
  const navRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    tl.fromTo(
      navRef.current,
      { y: -50, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8 }
    ).fromTo(
      itemsRef.current,
      { opacity: 0, y: -10 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.1 },
      "-=0.4"
    );
  }, []);

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (e.clientY < 60) {
        setIsOpen(true);
      } else if (e.clientY > 120) {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    gsap.to(navRef.current, {
      y: isOpen ? 0 : -100, 
      duration: 0.6,
      ease: "power3.out",
    });
  }, [isOpen]);

  return (
    <nav
      ref={navRef}
      className="w-full fixed top-0 left-0 bg-white/10 backdrop-blur-md border-b border-white/20 z-40"
    >
      <div className="max-w-6xl mx-auto flex justify-between items-center px-6 py-4 text-white">
        <Logo/>

        <div className="hidden md:flex space-x-8">
          {links.map((l, i) => (
            <a
              key={i}
              href={l.link}
              className="hover:text-pink-300 transition font-medium"
            >
              {l.text}
            </a>
          ))}
        </div>

        <div className="md:hidden">
          <button className="text-white focus:outline-none">☰</button>
        </div>
      </div>
    </nav>
  );
}
