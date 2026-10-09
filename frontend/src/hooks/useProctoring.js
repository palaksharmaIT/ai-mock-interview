import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// --------------------------------------------------
// Where the model files are loaded from
// --------------------------------------------------

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// --------------------------------------------------
// Tuning values (change these if it feels too strict / too loose)
// --------------------------------------------------

const CHECK_EVERY_MS = 250; // about 4 checks per second

// A problem must last this long before it is reported
const SUSTAIN_MS = {
  no_face: 3000,
  multiple_faces: 2000,
  looking_away: 4000,
  camera_blocked: 2000,
};

// After a flag, the same problem is not reported again for this long
const COOLDOWN_MS = 12000;

// Head turn left/right. 0.5 = facing the screen straight on.
const YAW_MIN = 0.3;
const YAW_MAX = 0.7;

// Head tilt up/down. About 0.5 to 0.6 is normal when looking at the screen.
const PITCH_MIN = 0.3;
const PITCH_MAX = 0.75;

// Average brightness (0-255) below this means camera is covered / dark
const DARK_LEVEL = 18;

// --------------------------------------------------
// Face landmark numbers used (MediaPipe face mesh)
// --------------------------------------------------

const NOSE_TIP = 1;
const FOREHEAD = 10;
const CHIN = 152;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

function isLookingAway(landmarks) {
  const nose = landmarks[NOSE_TIP];
  const top = landmarks[FOREHEAD];
  const bottom = landmarks[CHIN];
  const left = landmarks[LEFT_CHEEK];
  const right = landmarks[RIGHT_CHEEK];

  if (!nose || !top || !bottom || !left || !right) return false;

  const width = right.x - left.x;
  const height = bottom.y - top.y;
  if (width <= 0 || height <= 0) return false;

  const yaw = (nose.x - left.x) / width;
  const pitch = (nose.y - top.y) / height;

  return yaw < YAW_MIN || yaw > YAW_MAX || pitch < PITCH_MIN || pitch > PITCH_MAX;
}

function averageBrightness(video, canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return total / (data.length / 4);
}

// --------------------------------------------------
// Hook
//
// useProctoring({ videoRef, stream, enabled, onFlag })
//
// - videoRef : ref of the <video> that shows the camera
// - stream   : the MediaStream from getUserMedia
// - enabled  : turn checking on / off
// - onFlag   : called with an event when a problem is confirmed
//
// onFlag receives:
//   { type, at, elapsedSec, durationSec }
//   type = "no_face" | "multiple_faces" | "looking_away" | "camera_blocked"
//
// Returns:
//   status  = "loading" | "ready" | "error"
//   current = the problem happening right now, or null
// --------------------------------------------------

export default function useProctoring({
  videoRef,
  stream,
  enabled = true,
  onFlag,
}) {
  const [status, setStatus] = useState("loading");
  const [current, setCurrent] = useState(null);

  // Keep the latest onFlag without restarting the checker
  const onFlagRef = useRef(onFlag);
  useEffect(() => {
    onFlagRef.current = onFlag;
  }, [onFlag]);

  useEffect(() => {
    if (!enabled || !stream) return undefined;

    let cancelled = false;
    let landmarker = null;
    let timer = null;

    const startedAt = Date.now();
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;

    // Per problem: when it began, and when we last reported it
    const tracker = {};
    Object.keys(SUSTAIN_MS).forEach((type) => {
      tracker[type] = { since: null, lastFired: 0 };
    });

    let lastShown = null;

    const check = () => {
      const video = videoRef.current;
      if (!video || !landmarker || video.readyState < 2) return;

      const now = Date.now();
      const track = stream.getVideoTracks()[0];

      // ---- Work out what is wrong right now ----
      const active = new Set();

      const trackDead = !track || track.readyState !== "live" || track.muted;
      let dark;
      try {
        dark = averageBrightness(video, canvas) < DARK_LEVEL;
      } catch {
        dark = false;
      }

      if (trackDead || dark) {
        active.add("camera_blocked");
      } else {
        let result;
        try {
          result = landmarker.detectForVideo(video, performance.now());
        } catch {
          return; // skip this frame
        }

        const faces = result?.faceLandmarks || [];

        if (faces.length === 0) {
          active.add("no_face");
        } else if (faces.length > 1) {
          active.add("multiple_faces");
        } else if (isLookingAway(faces[0])) {
          active.add("looking_away");
        }
      }

      // ---- Decide if a problem has lasted long enough to report ----
      Object.keys(SUSTAIN_MS).forEach((type) => {
        const t = tracker[type];

        if (!active.has(type)) {
          t.since = null;
          return;
        }

        if (t.since === null) t.since = now;

        const lasted = now - t.since;
        const cooledDown = now - t.lastFired >= COOLDOWN_MS;

        if (lasted >= SUSTAIN_MS[type] && cooledDown) {
          t.lastFired = now;
          onFlagRef.current?.({
            type,
            at: new Date(now).toISOString(),
            elapsedSec: Math.round((now - startedAt) / 1000),
            durationSec: Math.round(lasted / 1000),
          });
        }
      });

      // ---- Tell the UI what is happening right now ----
      const shown = active.values().next().value || null;
      if (shown !== lastShown) {
        lastShown = shown;
        setCurrent(shown);
      }
    };

    (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL);

        const instance = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: "VIDEO",
          numFaces: 2,
        });

        if (cancelled) {
          instance.close();
          return;
        }

        landmarker = instance;
        setStatus("ready");
        timer = setInterval(check, CHECK_EVERY_MS);
      } catch (error) {
        // Model could not load (offline etc). The interview still works.
        console.error("Proctoring could not start:", error);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      try {
        landmarker?.close();
      } catch {
        // already closed
      }
    };
  }, [enabled, stream, videoRef]);

  return { status, current };
}