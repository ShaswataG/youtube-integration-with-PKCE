// frontend/src/Callback.jsx
import { useEffect } from "react";

export default function Callback() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const code = q.get("code");
    const state = q.get("state");
    const saved = localStorage.getItem("pkce_state");
    
    if (!code || state !== saved) {
        console.log('code:', code);
        console.log('saved:', saved);
        console.log('state:', state);
        alert("State mismatch or missing code!");
      return;
    }
    console.log('test');
    const verifier = localStorage.getItem("pkce_verifier") || "";

    fetch(`http://localhost:3000/api/youtube/callback?${new URLSearchParams({
      code,
      state,
      code_verifier: verifier
    })}`, { credentials: "include" })
      .then(res => res.text())
      .then(() => alert("Logged in!"))
      .catch(() => alert("Login failed"));

    window.history.replaceState({}, "", "/");
  }, []);

  return <p>Completing login…</p>;
}
