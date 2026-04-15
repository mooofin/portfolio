import { MatrixCodeRain } from "./MatrixCodeRain";
import { InteractiveTerminal } from "./InteractiveTerminal";

export default function MatrixPage() {
  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <MatrixCodeRain
        fullScreen
        color="#ff66b2" 
        fontSize={14}
        fps={20}
        opacity={0.05}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "1rem",
        }}
      >
        <InteractiveTerminal
          steps={[
            "Baking the sponge...",
            "Whipping the strawberry frosting...",
            "Adding chocolate chips...",
            "Placing the candles...",
          ]}
          finalMessage={
            "≈ MUFFIN BAKED UwU ≈\n\nYour mooofin is ready cutie :D \n- Fluffy vanilla sponge\n- Strawberry buttercream\n- Chocolate chips\n\nEnjoy and have a wonderful day >_<"
          }
          stepDelay={900}
        />
      </div>
    </div>
  );
}