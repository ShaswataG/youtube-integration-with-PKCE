// frontend/src/Home.jsx
import { useState } from "react";

function dec2hex(dec) {
  return dec.toString(16).padStart(2, "0");
}
function genVerifier() {
  const arr = new Uint8Array(56);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join("");
}
async function sha256base64url(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  const bytes = new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export default function Home() {
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    const verifier = genVerifier();
    const challenge = await sha256base64url(verifier);
    const state = Math.random().toString(36).substr(2);

    localStorage.setItem("pkce_verifier", verifier);
    localStorage.setItem("pkce_state", state);

    const params = new URLSearchParams({ state, code_challenge: challenge, platform: 'kick' });
    
    try {
      const response = await fetch(`http://localhost:3000/api/platform/connect/auth-url?${params}`, {
        headers: {
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTg2LCJ0eXBlIjoiSU5URVJOQUwiLCJlbWFpbCI6ImJhcnJ5YWxsZW4xMjE1MjEyNEBnbWFpbC5jb20iLCJpc192ZXJpZmllZCI6MSwiaWF0IjoxNzUzOTc4MDYwLCJleHAiOjE3NTQwNjQ0NjB9.hO1CF4bAUW8BOcIwBkrGL5r2rsuGyNbDMA458ZkLc9Y`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch auth URL");
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // redirect manually
      } else {
        throw new Error("No URL in response");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Something went wrong during login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <button onClick={login} disabled={loading}>
        {loading ? "Redirecting..." : "Continue with YouTube"}
      </button>
    </div>
  );
}
