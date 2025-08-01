// frontend/src/Callback.jsx
import { useEffect } from "react";

export default function Callback() {
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const code = q.get("code");
    const state = q.get("state");
    const saved = localStorage.getItem("pkce_state");
    
    if (!code) {
        console.log('code:', code);
        console.log('saved:', saved);
        console.log('state:', state);
        alert("State mismatch or missing code!");
      return;
    }
    console.log('test');
    const verifier = localStorage.getItem("pkce_verifier") || "";

    const params = new URLSearchParams({
      code,
      code_verifier: verifier,
      platform: 'kick'
    })

    fetch(`http://localhost:3000/api/platform/connect/callback?${params}`, {
        headers: {
          Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTg2LCJ0eXBlIjoiSU5URVJOQUwiLCJlbWFpbCI6ImJhcnJ5YWxsZW4xMjE1MjEyNEBnbWFpbC5jb20iLCJpc192ZXJpZmllZCI6MSwiaWF0IjoxNzUzOTc4MDYwLCJleHAiOjE3NTQwNjQ0NjB9.hO1CF4bAUW8BOcIwBkrGL5r2rsuGyNbDMA458ZkLc9Y`,
        },
    })
      .then(res => { 
        console.log('res.text():', res.text());  
        res.text()
      })
      .then(() => alert("Logged in!"))
      .catch(() => alert("Login failed"));

    window.history.replaceState({}, "", "/");
  }, []);

  return <p>Completing login…</p>;
}
