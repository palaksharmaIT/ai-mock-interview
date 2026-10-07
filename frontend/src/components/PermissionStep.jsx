import { useCallback, useEffect, useRef, useState } from "react";

function explain(err) {
  switch (err?.name) {
    case "NotAllowedError":
      return "Access was blocked. Click the camera icon in the address bar, allow camera and microphone for this site, then try again.";
    case "NotFoundError":
      return "No camera or microphone was found. Plug one in and try again.";
    case "NotReadableError":
      return "Another app (Zoom, Meet, Teams) may be using your camera or mic. Close it and try again.";
    default:
      return "Camera and microphone access isn't available in this browser. Use a recent Chrome, Edge or Safari on https or localhost.";
  }
}

export default function PermissionStep({ setup, onGranted, onBack }) {
  const [status, setStatus] = useState("asking"); // asking | granted | failed
  const [message, setMessage] = useState("");
  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const handedOff = useRef(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const request = useCallback(async (isCancelled = () => false) => {
    setStatus("asking");
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (isCancelled()) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setStatus("granted");
    } catch (err) {
      if (isCancelled()) return;
      setMessage(explain(err));
      setStatus("failed");
    }
  }, []);

  // Ask as soon as this screen opens
  useEffect(() => {
    let cancelled = false;
    request(() => cancelled);
    return () => {
      cancelled = true;
      if (!handedOff.current) stopStream(); // release camera if user leaves
    };
  }, [request]);

  // Attach the stream once the <video> exists
  useEffect(() => {
    if (status === "granted" && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [status]);

  const proceed = () => {
    handedOff.current = true;
    onGranted(streamRef.current);
  };

  return (
    <div className="perm">
      <p className="eyebrow">{setup.techStack} · {setup.experience} years</p>

      {status === "asking" && (
        <>
          <h1>Allow camera and microphone</h1>
          <p className="lede">
            Your browser is asking for access. Choose “Allow” — you'll answer out loud, and you'll see yourself while you do.
          </p>
        </>
      )}

      {status === "granted" && (
        <>
          <h1>Looking good.</h1>
          <p className="lede">Check that you're in frame and your mic is picking you up, then start.</p>
          <video ref={videoRef} autoPlay muted playsInline className="preview" />
          <div className="btn-row left">
            <button className="btn-ghost" onClick={onBack}>Back</button>
            <button className="cta" onClick={proceed}>Begin interview</button>
          </div>
        </>
      )}

      {status === "failed" && (
        <>
          <h1>We couldn't reach your camera</h1>
          <p className="error" role="alert">{message}</p>
          <div className="btn-row left">
            <button className="btn-ghost" onClick={onBack}>Back</button>
            <button className="cta" onClick={() => request()}>Try again</button>
          </div>
        </>
      )}
    </div>
  );
}