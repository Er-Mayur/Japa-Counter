import { useEffect, useState } from "react";

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 500); // Wait for fade out animation
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) {
    return (
      <div className="fixed inset-0 bg-gradient-primary flex flex-col items-center justify-center z-50 transition-opacity duration-500 opacity-0 pointer-events-none">
        {/* Fade out animation */}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-primary flex flex-col items-center justify-center z-50 animate-fade-in">
      {/* Animated Om Symbol */}
      <div className="text-white mb-8 animate-pulse-spiritual">
        <div className="om-symbol text-8xl animate-om-glow">ॐ</div>
      </div>
      
      {/* App Title */}
      <div className="text-center text-white mb-12">
        <h1 className="text-3xl font-bold mb-2">धार्मिक जप काउंटर</h1>
        <h2 className="text-xl font-light mb-4">Dharmik Japa Counter</h2>
        <p className="text-sm opacity-90 max-w-xs mx-auto leading-relaxed">
          "Quiet the mind, one bead at a time"
        </p>
      </div>
      
      {/* Subtle loading animation */}
      <div className="flex space-x-2">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
        <div className="w-2 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></div>
      </div>
    </div>
  );
};