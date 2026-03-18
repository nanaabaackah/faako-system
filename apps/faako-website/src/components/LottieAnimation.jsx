import { Player } from "@lottiefiles/react-lottie-player";

export default function LottieAnimation({ src, className, speed = 1, ...props }) {
  return (
    <div className={className}>
      <Player
        src={src}
        loop
        autoplay
        speed={speed}
        keepLastFrame
        style={{ width: "100%", height: "100%" }}
        {...props}
      />
    </div>
  );
}
