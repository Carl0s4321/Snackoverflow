import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Link } from "react-router-dom";
import Motivation from "../components/Motivation";
import { images } from "../assets";
import SplitType from "split-type";
import { regions } from "../constants/regions";
import { useNavigate } from "react-router-dom";

// export default function LandingPage() {
//   const heroRef = useRef(null);
//   const headingRef = useRef(null);
//   const buttonRef = useRef(null);

//   useEffect(() => {
//     const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
//     tl.fromTo(
//       heroRef.current,
//       { opacity: 0, y: 50 },
//       { opacity: 1, y: 0, duration: 1 }
//     )
//       .fromTo(
//         headingRef.current,
//         { opacity: 0, y: 40 },
//         { opacity: 1, y: 0, duration: 0.8 },
//         "-=0.5"
//       )
//       .fromTo(
//         buttonRef.current,
//         { opacity: 0, scale: 0.8 },
//         { opacity: 1, scale: 1, duration: 0.6 },
//         "-=0.3"
//       );
//   }, []);

//   return (
//     <>
//       <div
//         ref={heroRef}
//         className="w-screen h-screen flex flex-col justify-center items-center bg-linear-to-br from-indigo-500 via-purple-500 to-pink-500 text-white text-center"
//       >
//         <h1
//           ref={headingRef}
//           className="text-5xl md:text-6xl font-extrabold mb-6 drop-shadow-lg"
//         >
//           welivehere
//         </h1>
//         <p className="text-lg md:text-xl max-w-xl mb-8 opacity-90">subtitle</p>
//         <button
//           ref={buttonRef}
//           className="px-8 py-3 bg-white text-indigo-600 rounded-full font-semibold shadow-lg hover:scale-105 transform transition"
//         >
//           <Link to="/auth/register">Register</Link>
//         </button>
//         <button
//           ref={buttonRef}
//           className="px-8 py-3 bg-white text-indigo-600 rounded-full font-semibold shadow-lg hover:scale-105 transform transition"
//         >
//           <Link to="/auth/login">Login</Link>
//         </button>
//       </div>
//       <Motivation/>
//     </>
//   );
// }

export default function LandingPage() {
  const projectsContainer = document.querySelector(".projects");
  const locationsContainer = document.querySelector(".locations");

  const [title, setTitle] = useState("welivehere");
  const navigate = useNavigate();

  const gridImages = gsap.utils.toArray(".img");
  const heroImage = document.querySelector(".img.hero-img");

  const images = gridImages.filter((img) => img != heroImage);

  const introCopy = new SplitType(".intro-copy h3", {
    types: "words",
    absolute: false,
  });
  const titleHeading = new SplitType(".title h1", {
    types: "words",
    absolute: false,
  });
  // const allImageSources = Array.from(
  //   {length: 35}

  // )

  const getRandomImageSet = () => {
    const shuffled = [];
  };

  function startImageRotation() {
    const totalCycles = 20;
    for (let cycle = 0; cycle < totalCycles; cycle++) {
      const randomImage = images[0];

      gsap.to(
        {},
        {
          duration: 0,
          delay: cycle * 0.15,
          onComplete: () => {
            gridImages.forEach((img, index) => {
              const imgElement = img.querySelector("img");

              if (cycle === totalCycles - 1 && img === heroImage) {
                imgElement.src = images[0];
                gsap.set(".hero-img img", { scale: 2 });
              } else {
                imgElement.src = images[0];
              }
            });
          },
        }
      );
    }
  }

  function setupInitStates() {
    gsap.set("nav", {
      y: "-125%",
    });

    gsap.set(introCopy.words, {
      y: "110%",
    });

    gsap.set(titleHeading.words, {
      y: "110%",
    });
  }

  function createAnimationTimelines() {
    const overlayTimeline = gsap.timeline();
    const imagesTimeline = gsap.timeline();
    const textTimeline = gsap.timeline();

    overlayTimeline.to(".logo-line-1", {
      backgroundPosition: "0% 0%",
      color: "#fff",
      duration: 1,
      ease: "none",
      delay: 0.5,
      onComplete: () => {
        gsap.to(".logo-line-2", {
          backgroundPosition: "0% 0%",
          color: "#fff",
          duration: 1,
          ease: "none",
        });
      },
    });

    overlayTimeline.to([".projects-header", ".project-item"], {
      opacity: 1,
      duration: 0.15,
      stagger: 0.075,
      delay: 1,
    });

    overlayTimeline.to(
      [".locations-header", ".location-item"],
      {
        opacity: 1,
        duration: 0.15,
        stagger: 0.075,
      },
      "<"
    );

    overlayTimeline.to(".project-item", {
      color: "#fff",
      duration: 0.15,
      stagger: 0.075,
    });

    overlayTimeline.to(
      ".location-item",
      {
        color: "#fff",
        duration: 0.15,
        stagger: 0.075,
      },
      "<"
    );

    overlayTimeline.to([".projects-header", ".project-item"], {
      opacity: 1,
      duration: 0.15,
      stagger: 0.075,
    });

    overlayTimeline.to(
      [".locations-header", ".location-item"],
      {
        opacity: 1,
        duration: 0.15,
        stagger: 0.075,
      },
      "<"
    );
  }

  useEffect(() => {
    // initializeDynamicContent();
    setupInitStates();
    createAnimationTimelines();
  }, []);

  return (
    <div className="overlay">
      {/* <div className=""> */}
      <div className="projects">
        <div className="projects-header">
          <p>Cities</p>
          <p>Cities</p>
        </div>
        {regions.map((region) => (
          <div className="project-item">
            <p>{region.name}</p>
            <p>{region.neighborhood}</p>
          </div>
        ))}
      </div>
      <div
        className="loader hover:cursor-pointer"
        onMouseLeave={() => setTitle("welivehere")}
        onMouseEnter={() => setTitle("get started")}
        onClick={() => navigate("/auth/login")}
      >
        <h1 className="logo-line-1">{title}</h1>
        <h1 className="logo-line-2">{title}</h1>
      </div>
      <div className="locations">
        <div className="locations-header">
          <p>Regions</p>

          {regions.map((region) => (
            <div className="location-item">
              <p>{region.location}</p>
            </div>
          ))}
        </div>
      </div>
      {/* </div> */}

      {/* <div className="image-grid">
        <div className="grid-row">
          <div className="img">
            <img src={images[0]} alt="" />
          </div>
          <div className="img">
            <img src={images[0]} alt="" />
          </div>
          <div className="img">
            <img src={images[0]} alt="" />
          </div>
        </div>
        <div className="grid-row">
          <div className="img">
            <img src={images[0]} alt="" />
          </div>
          <div className="img hero-img">
            <img src={images[0]} alt="" />
          </div>
          <div className="img">
            <img src={images[0]} alt="" />
          </div>
        </div>
        <div className="grid-row">
          <div className="img">
            <img src={images[0]} alt="" />
          </div>
          <div className="img">
            <img src={images[0]} alt="" />
          </div>
          <div className="img">
            <img src={images[0]} alt="" />
          </div>
        </div>
      </div> */}

      {/* <nav>
        <div className="links"></div>
        <div className="nav-logo"></div>
        <div className="links"></div>
      </nav> */}
      {/* 
      <div className="banner-img banner-img-1">
        <img src={images[0]} alt="" />
      </div>
      <div className="banner-img banner-img-2">
        <img src={images[0]} alt="" />
      </div> */}

      {/* <div className="intro-copy">
        <h3>Creative Solutions</h3>
        <h3>Creative Solutions</h3>
      </div> */}

      {/* <div className="title">
        <h1>Improving Communities</h1>
      </div> */}
    </div>
  );
}
