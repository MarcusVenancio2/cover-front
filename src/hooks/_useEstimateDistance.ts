import { useState, useRef, useEffect, useCallback } from "react";

function useEstimateDistance() {
  const [distance, setDistance] = useState(0);
  const [isMediaPipeLoaded, setIsMediaPipeLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const spinnerRef = useRef<HTMLDivElement>(null);
  const holisticRef = useRef<any>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  //   useEffect(() => {
  //     const loadMediaPipe = async () => {
  //       try {
  //         const script = document.createElement("script");
  //         script.src =
  //           "https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1635989137/holistic.js";
  //         script.async = true;
  //         script.onload = () => setIsMediaPipeLoaded(true);
  //         document.body.appendChild(script);
  //       } catch (error) {
  //         console.error("Erro ao carregar MediaPipe:", error);
  //       }
  //     };

  //     loadMediaPipe();
  //   }, []);

  function removeElements(
    landmarks: mpHolistic.NormalizedLandmarkList,
    elements: number[]
  ) {
    for (const element of elements) {
      delete landmarks[element];
    }
  }

  function removeLandmarks(results: mpHolistic.Results) {
    if (results.poseLandmarks) {
      removeElements(
        results.poseLandmarks,
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19, 20, 21, 22]
      );
    }
  }

  function connect(
    ctx: CanvasRenderingContext2D,
    connectors: Array<[any, any]>
  ): void {
    const canvas = ctx.canvas;
    for (const connector of connectors) {
      const from = connector[0];
      const to = connector[1];
      if (from && to) {
        if (
          from.visibility &&
          to.visibility &&
          (from.visibility < 0.1 || to.visibility < 0.1)
        ) {
          continue;
        }
        ctx.beginPath();
        ctx.moveTo(from.x * canvas.width, from.y * canvas.height);
        ctx.lineTo(to.x * canvas.width, to.y * canvas.height);
        ctx.stroke();
      }
    }
  }

  let activeEffect = "mask";
  function onResults(results: any): void {
    console.log({ results });
    // Hide the spinner.
    document.body.classList.add("loaded");

    // Remove landmarks we don't want to draw.
    removeLandmarks(results);

    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const canvasCtx = canvasElement.getContext("2d");
    if (!canvasCtx) return;

    // Draw the overlays.
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.segmentationMask) {
      canvasCtx.drawImage(
        results.segmentationMask,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );

      // Only overwrite existing pixels.
      if (activeEffect === "mask" || activeEffect === "both") {
        canvasCtx.globalCompositeOperation = "source-in";
        // This can be a color or a texture or whatever...
        canvasCtx.fillStyle = "#00FF007F";
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
      } else {
        canvasCtx.globalCompositeOperation = "source-out";
        canvasCtx.fillStyle = "#0000FF7F";
        canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
      }

      // Only overwrite missing pixels.
      canvasCtx.globalCompositeOperation = "destination-atop";
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );

      canvasCtx.globalCompositeOperation = "source-over";
    } else {
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );
    }

    // Connect elbows to hands. Do this first so that the other graphics will draw
    // on top of these marks.
    canvasCtx.lineWidth = 5;
    if (results.poseLandmarks) {
      if (results.rightHandLandmarks) {
        canvasCtx.strokeStyle = "white";
        connect(canvasCtx, [
          [
            results.poseLandmarks[mpHolistic.POSE_LANDMARKS.RIGHT_ELBOW],
            results.rightHandLandmarks[0],
          ],
        ]);
      }
      if (results.leftHandLandmarks) {
        canvasCtx.strokeStyle = "white";
        connect(canvasCtx, [
          [
            results.poseLandmarks[mpHolistic.POSE_LANDMARKS.LEFT_ELBOW],
            results.leftHandLandmarks[0],
          ],
        ]);
      }
    }

    // Pose...
    window.drawingUtils.drawConnectors(
      canvasCtx,
      results.poseLandmarks,
      mpHolistic.POSE_CONNECTIONS,
      { color: "white" }
    );

    // Adicionar verificação para evitar erro quando poseLandmarks for undefined
    if (results.poseLandmarks) {
      window.drawingUtils.drawLandmarks(
        canvasCtx,
        Object.values(mpHolistic.POSE_LANDMARKS_LEFT).map(
          (index) => results.poseLandmarks![index]
        ),
        { visibilityMin: 0.65, color: "white", fillColor: "rgb(255,138,0)" }
      );
      window.drawingUtils.drawLandmarks(
        canvasCtx,
        Object.values(mpHolistic.POSE_LANDMARKS_RIGHT).map(
          (index) => results.poseLandmarks![index]
        ),
        { visibilityMin: 0.65, color: "white", fillColor: "rgb(0,217,231)" }
      );
    }

    // Hands...
    window.drawingUtils.drawConnectors(
      canvasCtx,
      results.rightHandLandmarks,
      mpHolistic.HAND_CONNECTIONS,
      { color: "white" }
    );
    window.drawingUtils.drawLandmarks(canvasCtx, results.rightHandLandmarks, {
      color: "white",
      fillColor: "rgb(0,217,231)",
      lineWidth: 2,
      radius: (data: any) => {
        return window.drawingUtils.lerp(data.from?.z, -0.15, 0.1, 10, 1);
      },
    });
    window.drawingUtils.drawConnectors(
      canvasCtx,
      results.leftHandLandmarks,
      mpHolistic.HAND_CONNECTIONS,
      { color: "white" }
    );
    window.drawingUtils.drawLandmarks(canvasCtx, results.leftHandLandmarks, {
      color: "white",
      fillColor: "rgb(255,138,0)",
      lineWidth: 2,
      radius: (data: any) => {
        return window.drawingUtils.lerp(data.from?.z, -0.15, 0.1, 10, 1);
      },
    });

    // Face...
    window.drawingUtils.drawConnectors(
      canvasCtx,
      results.faceLandmarks,
      mpHolistic.FACEMESH_TESSELATION,
      { color: "#C0C0C070", lineWidth: 1 }
    );
    window.drawingUtils.drawConnectors(
      canvasCtx,
      results.faceLandmarks,
      mpHolistic.FACEMESH_RIGHT_EYE,
      { color: "rgb(0,217,231)" }
    );
    window.drawingUtils.drawConnectors(
      canvasCtx,
      results.faceLandmarks,
      mpHolistic.FACEMESH_RIGHT_EYEBROW,
      { color: "rgb(0,217,231)" }
    );
    window.drawingUtils.drawConnectors(
      canvasCtx,
      results.faceLandmarks,
      mpHolistic.FACEMESH_LEFT_EYE,
      { color: "rgb(255,138,0)" }
    );
    window.drawingUtils.drawConnectors(
      canvasCtx,
      results.faceLandmarks,
      mpHolistic.FACEMESH_LEFT_EYEBROW,
      { color: "rgb(255,138,0)" }
    );
    window.drawingUtils.drawConnectors(
      canvasCtx,
      results.faceLandmarks,
      mpHolistic.FACEMESH_FACE_OVAL,
      { color: "#E0E0E0", lineWidth: 5 }
    );
    window.drawingUtils.drawConnectors(
      canvasCtx,
      results.faceLandmarks,
      mpHolistic.FACEMESH_LIPS,
      { color: "#E0E0E0", lineWidth: 5 }
    );

    canvasCtx.restore();
  }

  async function estimateDistance(imageSource: any) {
    // if (!faceMeshRef.current || !holisticRef.current) return;

    try {
      //   await faceMeshRef.current.send({ image: imageSource });
      await holisticRef.current.send({ image: imageSource });
    } catch (err) {
      console.error("Estimation error:", err);
      //   setError('Failed to process image');
    }
  }

  async function initializeCamera() {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      });
      // console.log("Camera stream obtained:", mediaStream);
      setStream(mediaStream);

      // Criar elemento de vídeo para teste
      if (!videoRef.current) {
        const video = document.createElement("video");
        video.srcObject = mediaStream;
        video.autoplay = true;
        video.playsInline = true;
        videoRef.current = video;
        await video.play();
        console.log("Test video element created and playing");
      }

      // Criar elemento de canvas
      if (!canvasRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        document.getElementById("canvas")?.appendChild(canvas);
        canvasRef.current = canvas;
      }

      setIsVideoReady(true);
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  }

  useEffect(() => {
    if (spinnerRef.current) {
      spinnerRef.current.ontransitionend = () => {
        if (spinnerRef.current) {
          spinnerRef.current.style.display = "none";
        }
      };
    }
  }, []);

  useEffect(() => {
    function initializeHolistic() {
      if (!videoRef.current || typeof window.Holistic === "undefined") {
        console.error("Video ou MediaPipe não carregados");
        return;
      }

      try {
        // Inicializa o Holistic
        holisticRef.current = new window.Holistic({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1635989137/${file}`;
          },
        });

        // Configura o callback de resultados
        holisticRef.current.onResults(onResults);
        holisticRef.current.setOptions({
          modelComplexity: 1,
          refineFaceLandmarks: true,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
          minHandDetectionConfidence: 0.3,
          minHandTrackingConfidence: 0.3,
        });
      } catch (error) {
        console.error("Erro ao inicializar:", error);
      }
    }

    if (isVideoReady) {
      initializeHolistic();
    }
  }, [isVideoReady]);

  return {
    distance,
    videoRef,
    canvasRef,
    controlsRef,
    spinnerRef,
    estimateDistance,
    initializeCamera,
  };
}

export default useEstimateDistance;
