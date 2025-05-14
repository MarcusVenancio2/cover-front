import { useEffect, useState } from "react";
import "./App.css";
import { useEstimateDistance } from "./hooks/useEstimateDistance";

function App() {
  const [count, setCount] = useState(0);
  const {
    videoRef,
    canvasRef,
    startDistanceEstimation,
    stopDistanceEstimation,
  } = useEstimateDistance();

  useEffect(() => {
    // Iniciar a estimativa de distância quando o componente for montado
    startDistanceEstimation();

    // Limpar quando o componente for desmontado
    return () => {
      stopDistanceEstimation();
    };
  }, []);

  return (
    <div>
      <video ref={videoRef} className="input_video"></video>
      <canvas ref={canvasRef} className="output_canvas"></canvas>
    </div>
  );
}

export default App;
