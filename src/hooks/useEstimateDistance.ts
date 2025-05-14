import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    Holistic: any;
    Camera: any;
    FaceMesh: any;
  }
}

const DISTANCE = 0.5;
const MINIMUM_ACUITY: number = 51;
const MAXIMUM_REPEATED_ERRORS: number = 2;
const OPTOTYPE_ROTATIONS: Array<string> = [
  "cima",
  "direita",
  "baixo",
  "esquerda",
];
const TIME_SNAPSHOT_RE_VALIDATION = 2000;
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 480;
const DISTANCE_TARGET_IN_CENTIMETER = 35;
const DISTANCE_TOLERANCE_IN_CENTIMETER = 2;

export type EstimateDistanceDto = {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  onResult?: (payload: any) => void;
};

export function useEstimateDistance() {
  const [estimateDistanceStarted, setEstimateDistanceStarted] =
    useState<boolean>(false);
  const [hasCameraPermission, setHasCameraPermission] =
    useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const intervalRef = useRef<any | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const holisticRef = useRef<any | null>(null);
  const faceMeshRef = useRef<any | null>(null);
  const videoPermissionRef = useRef<PermissionStatus | null>(null);
  async function startDistanceEstimation(
    inicialTimeIntervalToSendSnapshot?: number
  ) {
    try {
      console.log("[startDistanceEstimation]: called");
      await videoConfig();
      console.log("[startDistanceEstimation]/[setInterval]: called");
      if (!intervalRef.current) {
        const timeIntervalToSendSnapshot =
          inicialTimeIntervalToSendSnapshot || TIME_SNAPSHOT_RE_VALIDATION;
        intervalRef.current = setInterval(
          dispatchImage,
          timeIntervalToSendSnapshot
        );
        console.log(
          `DistanceEstimation interval started (interval: ${timeIntervalToSendSnapshot})`,
          intervalRef.current
        );
      }
      setEstimateDistanceStarted(true);
    } catch (error) {
      console.error(
        "[startDistanceEstimation] Erro ao iniciar estimativa de distância:",
        error
      );
      setHasCameraPermission(false);
    }
  }

  const getImageFromVideoAndCanvas = (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement
  ): any => {
    const context = canvas.getContext("2d");
    if (!context) return "";
    const domMatriz = context.getTransform();
    if (domMatriz.a === 1) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas?.toDataURL("image/jpeg").split(",")[1];
    // console.log('Imagem que está sendo enviada para o socket', image);
    // console.log('Tamanho da imagem que está sendo enviada para o socket', canvas.width, canvas.height);
    context.restore();

    return canvas;
    return image;
  };

  function stopDistanceEstimation() {
    // if (!intervalRef.current) return
    console.log("[stopDistanceEstimation]: called");
    clearInterval(intervalRef.current);
    console.log("DistanceEstimation stopped", intervalRef.current);
    intervalRef.current = null;
    stopVideo();
  }

  function changeSnapshotTimeInterval(timeIntervalToSendSnapshot: number) {
    if (intervalRef.current) stopDistanceEstimation();
    startDistanceEstimation(timeIntervalToSendSnapshot);
  }

  function videoConfig() {
    return new Promise<void>((resolve, reject) => {
      if (!videoRef.current) {
        videoRef.current = document.createElement("video");
        videoRef.current.width = VIDEO_WIDTH;
        videoRef.current.height = VIDEO_HEIGHT;
        // @ts-ignore
        videoRef.current.autoPlay = true;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;

        // Durante a depuração, você pode tornar o vídeo visível
        // videoRef.current.style.display = 'none';

        // Adicionar o vídeo ao DOM para depuração
        document.body.appendChild(videoRef.current);
      }

      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
        canvasRef.current.width = VIDEO_WIDTH;
        canvasRef.current.height = VIDEO_HEIGHT;
        // canvasRef.current.style.display = 'none';
      }

      if (navigator && navigator.mediaDevices) {
        navigator.mediaDevices
          .getUserMedia({
            audio: false,
            video: {
              facingMode: "user",
              width: { exact: VIDEO_WIDTH },
              height: { exact: VIDEO_HEIGHT },
            },
          })
          .then((stream: MediaStream) => {
            setHasCameraPermission(true);
            setStream(stream);
            const video = videoRef.current as HTMLVideoElement;
            video.srcObject = stream;
            video.onloadedmetadata = async function (e) {
              await video.play().catch((err) => {
                console.log("Erro ao dar play no vídeo.");
                console.log({ err });
              });
            };
            resolve();
          })
          .catch((err) => {
            console.log("Error on videoConfig");
            console.log({ err });
            reject();
          });
      } else {
        reject();
        console.log("camera API is not supported by your browser");
      }
    });
  }

  function stopVideo() {
    stream?.getTracks().forEach(function (track) {
      track.stop();
    });
  }

  async function dispatchImage() {
    const event: EstimateDistanceDto = {
      video: videoRef.current!,
      canvas: canvasRef.current!,
    };

    const canvas = getImageFromVideoAndCanvas(event.video, event.canvas);

    // console.log("image", image);

    await holisticRef.current.send({ image: canvas });
    await faceMeshRef.current.send({ image: canvas });

    // emitEstimateDistanceEvent(event);
  }

  function getSnapshot() {
    const event: EstimateDistanceDto = {
      video: videoRef.current!,
      canvas: canvasRef.current!,
    };

    return getImageFromVideoAndCanvas(event.video, event.canvas);
  }

  let activeEffect = "mask";

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

  function onHolisticResults(results: any): void {
    console.log("onHolisticResults", results.faceLandmarks);
    return;
  }

  function onFaceMeshResults(results: any): void {
    console.log("onFaceMeshResults", results.multiFaceLandmarks);
    return;
  }

  useEffect(() => {
    async function videoPermissionListener() {
      try {
        setHasCameraPermission(false);
        videoPermissionRef.current = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });

        // Verificar o estado inicial da permissão
        if (videoPermissionRef.current.state === "granted") {
          console.log("Permissao da camera concedida");
          setHasCameraPermission(true);
        } else if (videoPermissionRef.current.state === "denied") {
          console.log("Permissao da camera negada");
          stopDistanceEstimation();
          setHasCameraPermission(false);
          alert(
            "Para usar este teste, você precisa permitir o acesso à câmera. Por favor, redefina as permissões nas configurações do seu navegador."
          );
        } else {
          console.log("Permissao da camera sera mostrada");
        }
      } catch (error) {
        console.error("Erro ao verificar permissões da câmera:", error);
      }
    }

    videoPermissionListener();

    // return () => videoPermissionRef?.current?.removeEventListener('change', videoPermissionHandler);
  }, []);

  useEffect(() => {
    function initializeHolisticAndFaceMesh() {
      if (!videoRef.current || typeof window.Holistic === "undefined") {
        console.error("Video ou MediaPipe não carregados");
        return;
      }

      try {
        // Inicializa o Holistic
        holisticRef.current = new window.Holistic({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
          },
        });

        faceMeshRef.current = new window.FaceMesh({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
          },
        });

        // Configura o callback de resultados
        holisticRef.current.onResults(onHolisticResults);
        faceMeshRef.current.onResults(onFaceMeshResults);

        holisticRef.current.setOptions({
          modelComplexity: 1,
          refineFaceLandmarks: true,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
          minHandDetectionConfidence: 0.3,
          minHandTrackingConfidence: 0.3,
        });

        faceMeshRef.current.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
        });
      } catch (error) {
        console.error("Erro ao inicializar:", error);
      }
    }

    if (hasCameraPermission) {
      initializeHolisticAndFaceMesh();
    }
  }, [hasCameraPermission]);

  return {
    startDistanceEstimation,
    stopDistanceEstimation,
    changeSnapshotTimeInterval,
    getSnapshot,
    videoRef,
    canvasRef,
    videoPermissionRef,
    stream,
    intervalRef,
    estimateDistanceStarted,
  };
}
