import { useEffect, useRef, useState } from "react";
// Removed 'gsap' import to resolve the dependency error. 
// The animation functionality is lost until 'gsap' is properly installed.
import { useParams, useNavigate } from "react-router-dom";
// Updated path to explicitly include the .ts extension to resolve local module import
import { useUserStore } from "../stores/userStore.ts"; 

export default function AuthPage() {
  let { type } = useParams();
  const [isLogin, setIsLogin] = useState(type === "login");
  const navigate = useNavigate();
  // Destructure both login and register functions from the store
  const { login, register } = useUserStore(); 
  
  // Changed username state to email for semantic clarity
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(""); // State for registration form
  const [errorMessage, setErrorMessage] = useState(""); // State for displaying error

  const formRef = useRef(null);

  useEffect(() => {
    // We update the local state whenever the route parameter changes
    setIsLogin(type === "login");
    console.log("postId", type);
  }, [type]);

  useEffect(() => {
    setErrorMessage(""); // Clear error when switching between login/register
    
    // GSAP animation code block removed to ensure successful compilation:
    // if (formRef.current) {
    //   gsap.fromTo(
    //     formRef.current,
    //     { opacity: 0, y: -20 },
    //     { opacity: 1, y: 0, duration: 0.5 }
    //   );
    // }
  }, [isLogin]);
  
  // Combined submission handler with the conditional logic fix
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(""); // Clear previous errors

    try {
      if (isLogin) {
        // --- LOGIN LOGIC ---
        await login(email, password);
        console.log(`Successfully logged in as: ${email}`);
      } else {
        // --- REGISTER LOGIC ---
        // Ensure that we have a full name for registration
        if (!fullName.trim()) {
           setErrorMessage("Please enter your full name to register.");
           return;
        }
        await register(fullName, email, password);
        console.log(`Successfully registered user: ${email}`);
      }
      
      // Navigate on success for both login and register
      navigate("/map"); 

    } catch (err: any) {
      // Catch the error thrown by the store functions and display a user-friendly message
      let message = "An unexpected error occurred.";
      if (err.message) {
         // Use the error message from the store/API if available
         message = err.message;
      } else if (isLogin) {
         message = "Login failed. Please check your email and password.";
      } else {
         message = "Registration failed. This email may already be in use.";
      }
      setErrorMessage(message);
      console.error(err);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center">
          {isLogin ? "Login" : "Register"}
        </h2>

        {errorMessage && (
          <p className="text-red-600 text-sm mb-4 bg-red-100 p-3 rounded-md border border-red-300">
            {errorMessage}
          </p>
        )}

        <form
          onSubmit={handleSubmit} // Using the consolidated handler
          ref={formRef}
          className="space-y-4"
        >
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium">Full Name</label>
              <input
                type="text"
                placeholder="John Doe"
                className="mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-600"
                value={fullName} // Bind state
                onChange={(e) => setFullName(e.target.value)} // Bind handler
                required // Full name is required for registration
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              placeholder="example@mail.com"
              className="mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-600"
              value={email} 
              onChange={(e) => setEmail(e.target.value.trim())}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              placeholder="********"
              className="mt-1 block w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-gray-600"
              value={password}
              onChange={(e) => setPassword(e.target.value.trim())}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-gray-500 text-white py-2 rounded-md hover:bg-gray-600 transition"
          >
            {isLogin ? "Login" : "Register"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            className="text-black font-semibold hover:underline"
            onClick={() => {
              // Clear inputs and error message when switching view
              setErrorMessage("");
              setEmail("");
              setPassword("");
              setFullName("");

              const newIsLogin = !isLogin;
              setIsLogin(newIsLogin);
              navigate(newIsLogin ? "/auth/login" : "/auth/register");
            }}
          >
            {isLogin ? "Register" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}