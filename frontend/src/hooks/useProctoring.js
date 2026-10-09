import { useEffect, useRef, useState } from "react";
import {
  FaceLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

// --------------------------------------------------
// MediaPipe model
// --------------------------------------------------

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// --------------------------------------------------
// Proctoring configuration
// --------------------------------------------------

const CHECK_EVERY_MS = 250;

// How long a condition must persist before it counts as a violation.
const SUSTAIN_MS = {
  no_face: 3000,
  multiple_faces: 1500,
  looking_away: 4000,
  camera_blocked: 2000,
};

// End the interview after this many confirmed violations.
const MAX_VIOLATIONS = 3;

// Face orientation heuristics; these are approximate, not definitive.
const YAW_MIN = 0.3;
const YAW_MAX = 0.7;
const PITCH_MIN = 0.3;
const PITCH_MAX = 0.75;

const DARK_LEVEL = 18;

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

  if (!nose || !top || !bottom || !left || !right) {
    return false;
  }

  const width = right.x - left.x;
  const height = bottom.y - top.y;

  if (width <= 0 || height <= 0) {
    return false;
  }

  const yaw = (nose.x - left.x) / width;
  const pitch = (nose.y - top.y) / height;

  return (
    yaw < YAW_MIN ||
    yaw > YAW_MAX ||
    pitch < PITCH_MIN ||
    pitch > PITCH_MAX
  );
}

function averageBrightness(video, canvas) {
  const context = canvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!context) return 255;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const { data } = context.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  let total = 0;

  for (let i = 0; i < data.length; i += 4) {
    total +=
      0.299 * data[i] +
      0.587 * data[i + 1] +
      0.114 * data[i + 2];
  }

  return data.length ? total / (data.length / 4) : 255;
}

// --------------------------------------------------
// Hook
//
// useProctoring({
//   videoRef,
//   stream,
//   enabled,
//   onFlag,
//   onTerminate,
// })
//
// onFlag receives a confirmed violation event.
// onTerminate receives the final violation event when the limit is reached.
//
// Returns:
// status, current, violations, shouldTerminate
// --------------------------------------------------

export default function useProctoring({
  videoRef,
  stream,
  enabled = true,
  onFlag,
  onTerminate,
}) {
  const [status, setStatus] = useState("loading");
  const [current, setCurrent] = useState(null);
  const [violations, setViolations] = useState([]);
  const [shouldTerminate, setShouldTerminate] = useState(false);

  const onFlagRef = useRef(onFlag);
  const onTerminateRef = useRef(onTerminate);
  const terminatedRef = useRef(false);
  const violationCountRef = useRef(0);

  useEffect(() => {
    onFlagRef.current = onFlag;
  }, [onFlag]);

  useEffect(() => {
    onTerminateRef.current = onTerminate;
  }, [onTerminate]);

  useEffect(() => {
    if (!enabled || !stream) {
      setStatus("loading");
      setCurrent(null);
      return undefined;
    }

    let cancelled = false;
    let landmarker = null;
    let timer = null;

    const startedAt = Date.now();
    const canvas = document.createElement("canvas");

    canvas.width = 16;
    canvas.height = 16;

    const tracker = {};

    Object.keys(SUSTAIN_MS).forEach((type) => {
      tracker[type] = {
        since: null,
        reported: false,
      };
    });

    // Reset violation state for each newly enabled interview.
    terminatedRef.current = false;
    violationCountRef.current = 0;

    setViolations([]);
    setShouldTerminate(false);
    setCurrent(null);
    setStatus("loading");

    const check = () => {
      if (cancelled || terminatedRef.current) return;

      const video = videoRef.current;

      if (!video || !landmarker || video.readyState < 2) {
        return;
      }

      const now = Date.now();
      const track = stream.getVideoTracks()[0];
      const active = new Set();

      const trackDead =
        !track ||
        track.readyState !== "live" ||
        track.muted;

      let dark = false;

      try {
        dark = averageBrightness(video, canvas) < DARK_LEVEL;
      } catch {
        // A temporary frame-read error should not itself trigger a violation.
      }

      if (trackDead || dark) {
        active.add("camera_blocked");
      } else {
        try {
          const result = landmarker.detectForVideo(
            video,
            performance.now()
          );

          const faces = result?.faceLandmarks || [];

          if (faces.length === 0) {
            active.add("no_face");
          } else if (faces.length > 1) {
            active.add("multiple_faces");
          } else if (isLookingAway(faces[0])) {
            active.add("looking_away");
          }
        } catch (error) {
          console.warn("Face detection frame skipped:", error);
          return;
        }
      }

      // Track each condition independently.
      for (const type of Object.keys(SUSTAIN_MS)) {
        const item = tracker[type];

        if (!active.has(type)) {
          item.since = null;
          item.reported = false;
          continue;
        }

        if (item.since === null) {
          item.since = now;
        }

        const duration = now - item.since;

        // Report only once for each continuous incident.
        if (
          duration >= SUSTAIN_MS[type] &&
          !item.reported
        ) {
          item.reported = true;

          const event = {
            type,
            at: new Date(now).toISOString(),
            elapsedSec: Math.round((now - startedAt) / 1000),
            durationSec: Math.round(duration / 1000),
            violationNumber: violationCountRef.current + 1,
          };

          violationCountRef.current += 1;

          setViolations((previous) => [...previous, event]);

          onFlagRef.current?.(event);

          if (
            violationCountRef.current >= MAX_VIOLATIONS
          ) {
            terminatedRef.current = true;
            setShouldTerminate(true);

            onTerminateRef.current?.({
              ...event,
              reason: "Maximum violation limit reached",
              totalViolations: violationCountRef.current,
            });

            break;
          }
        }
      }

      const shown = active.values().next().value || null;
      setCurrent(shown);
    };

    (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks(
          WASM_URL
        );

        const instance = await FaceLandmarker.createFromOptions(
          fileset,
          {
            baseOptions: {
              modelAssetPath: MODEL_URL,
            },
            runningMode: "VIDEO",
            numFaces: 2,
          }
        );

        if (cancelled) {
          instance.close();
          return;
        }

        landmarker = instance;
        setStatus("ready");
        timer = setInterval(check, CHECK_EVERY_MS);
      } catch (error) {
        console.error("Proctoring could not start:", error);

        if (!cancelled) {
          setStatus("error");
        }
      }
    })();

    return () => {
      cancelled = true;

      if (timer) {
        clearInterval(timer);
      }

      try {
        landmarker?.close();
      } catch {
        // The model may already be closed.
      }
    };
  }, [enabled, stream, videoRef]);

  return {
    status,
    current,
    violations,
    shouldTerminate,
  };
}
