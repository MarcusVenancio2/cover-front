declare namespace mpHolistic {
  interface NormalizedLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
  }

  type NormalizedLandmarkList = NormalizedLandmark[];

  interface Results {
    poseLandmarks?: NormalizedLandmarkList;
    faceLandmarks?: NormalizedLandmarkList;
    leftHandLandmarks?: NormalizedLandmarkList;
    rightHandLandmarks?: NormalizedLandmarkList;
    segmentationMask?: CanvasImageSource;
    image: CanvasImageSource;
  }

  interface HolisticConfig {
    locateFile: (file: string) => string;
  }

  class Holistic {
    constructor(config: HolisticConfig);
    onResults(callback: (results: Results) => void): void;
  }

  const VERSION: string;

  const POSE_LANDMARKS: {
    LEFT_ELBOW: number;
    RIGHT_ELBOW: number;
    // Adicione outros landmarks conforme necessário
  };

  const POSE_LANDMARKS_LEFT: Record<string, number>;
  const POSE_LANDMARKS_RIGHT: Record<string, number>;
  const POSE_CONNECTIONS: Array<[number, number]>;
  const HAND_CONNECTIONS: Array<[number, number]>;
  const FACEMESH_TESSELATION: Array<[number, number]>;
  const FACEMESH_RIGHT_EYE: Array<[number, number]>;
  const FACEMESH_RIGHT_EYEBROW: Array<[number, number]>;
  const FACEMESH_LEFT_EYE: Array<[number, number]>;
  const FACEMESH_LEFT_EYEBROW: Array<[number, number]>;
  const FACEMESH_FACE_OVAL: Array<[number, number]>;
  const FACEMESH_LIPS: Array<[number, number]>;
}

declare namespace drawingUtils {
  interface Data {
    from?: mpHolistic.NormalizedLandmark;
    to?: mpHolistic.NormalizedLandmark;
  }

  function drawConnectors(
    ctx: CanvasRenderingContext2D,
    landmarks: mpHolistic.NormalizedLandmarkList | undefined,
    connections: Array<[number, number]>,
    options?: {
      color?: string;
      lineWidth?: number;
    }
  ): void;

  function drawLandmarks(
    ctx: CanvasRenderingContext2D,
    landmarks: mpHolistic.NormalizedLandmarkList | undefined,
    options?: {
      color?: string;
      fillColor?: string;
      lineWidth?: number;
      radius?: number | ((data: Data) => number);
      visibilityMin?: number;
    }
  ): void;

  function lerp(
    value: number,
    min: number,
    max: number,
    a: number,
    b: number
  ): number;
}

// Estender o tipo Window para incluir as propriedades do MediaPipe
interface Window {
  mpHolistic: typeof mpHolistic;
  drawingUtils: typeof drawingUtils;
}
