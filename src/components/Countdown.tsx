import { useEffect, useState } from "react";

export function useCountdown(endTime: string | null): string | null {
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!endTime) {
      setTimeRemaining(null);
      return;
    }

    const calculateTimeRemaining = () => {
      const now = Date.now();
      const end = new Date(endTime).getTime();
      const difference = end - now;

      if (difference <= 0) {
        setTimeRemaining(null);
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor(
        (difference % (1000 * 60 * 60)) / (1000 * 60),
      );
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      const formatted = `${hours}h ${minutes}min ${seconds}sec`;
      setTimeRemaining(formatted);
    };

    // Calculate immediately
    calculateTimeRemaining();

    // Update every second
    const interval = setInterval(calculateTimeRemaining, 1000);

    // Handle tab visibility - recalculate when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        calculateTimeRemaining();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [endTime]);

  return timeRemaining;
}

