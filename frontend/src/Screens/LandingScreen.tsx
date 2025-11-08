import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import {images} from "../assets/index"
import Navbar from "../components/NavBar";

export default function LandingPage() {
  const heroRef = useRef(null);
  const headingRef = useRef(null);
  const buttonRef = useRef(null);

  // useEffect(() => {
  //   const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
  //   tl.fromTo(
  //     heroRef.current,
  //     { opacity: 0, y: 50 },
  //     { opacity: 1, y: 0, duration: 1 }
  //   )
  //     .fromTo(
  //       headingRef.current,
  //       { opacity: 0, y: 40 },
  //       { opacity: 1, y: 0, duration: 0.8 },
  //       "-=0.5"
  //     )
  //     .fromTo(
  //       buttonRef.current,
  //       { opacity: 0, scale: 0.8 },
  //       { opacity: 1, scale: 1, duration: 0.6 },
  //       "-=0.3"
  //     );
  // }, []);

  return (
    <>
      <div className="overlay">
        <div className="projects">
          <div className="projects-header">
            <p>Projects</p>
            <p>Directors</p>
          </div>
        </div>
        <div className="loader">
          <h1 className="logo-line-1">We Live</h1>
          <h1 className="logo-line-2">Here</h1>
        </div>
        <div className="locations">
          <div className="locations-header">
            <p>locations</p>
          </div>
        </div>

        <div className="image-grid">
          <div className="grid-row">
            {images.map((image, index) => (
              <div className="img" key={index}>
                <img src={image} alt="" />
              </div>
            ))}
          </div>
          <div className="grid-row">
            {images.map((image, index) => (
              <div
                className={`img ${index === 4 ? "hero-img" : ""}`}
                key={index}
              >
                <img src={image} alt="" />
              </div>
            ))}
          </div>
          <div className="grid-row">
            {images.map((image, index) => (
              <div className="img" key={index}>
                <img src={image} alt="" />
              </div>
            ))}
          </div>
        </div>

        <Navbar />

        <div className="banner-img banner-img-1">
          <img src={images[0]} alt="" />
        </div>
        <div className="banner-img banner-img-2">
          <img src={images[0]} alt="" />
        </div>

        <div className="intro-copy">
          <h3>HEYY</h3>
          <h3>HEYY</h3>
        </div>

        <div className="title"><h1>TITLEEE</h1></div>
      </div>
    </>
  );
}
