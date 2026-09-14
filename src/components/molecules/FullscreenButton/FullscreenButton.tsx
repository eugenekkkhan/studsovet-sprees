import { useEffect, useState } from "react";
import { IoContractOutline, IoExpandOutline } from "react-icons/io5";
import { Button } from "../../atoms";

/** Safari до сих пор живёт на префиксах. */
interface VendorDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void>;
}

interface VendorElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

const vendorDocument = () => document as VendorDocument;

const isFullscreenNow = () =>
  Boolean(document.fullscreenElement ?? vendorDocument().webkitFullscreenElement);

const fullscreenSupported = () =>
  Boolean(document.fullscreenEnabled ?? vendorDocument().webkitFullscreenEnabled);

interface FullscreenButtonProps {
  /** Что разворачивать; по умолчанию — вся страница. */
  target?: HTMLElement | null;
  label?: string;
}

/** Разворачивает табло во весь экран — то же, что F11, но кнопкой. */
const FullscreenButton = ({
  target,
  label = "На весь экран",
}: FullscreenButtonProps) => {
  const [active, setActive] = useState(isFullscreenNow);
  const [supported] = useState(fullscreenSupported);

  useEffect(() => {
    const sync = () => setActive(isFullscreenNow());
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  if (!supported) return null;

  const toggle = async () => {
    const element = (target ?? document.documentElement) as VendorElement;
    try {
      if (isFullscreenNow()) {
        await (document.exitFullscreen?.() ?? vendorDocument().webkitExitFullscreen?.());
      } else {
        await (element.requestFullscreen?.() ?? element.webkitRequestFullscreen?.());
      }
    } catch {
      // Браузер может отказать без явного жеста пользователя — молча остаёмся как есть.
    }
  };

  return (
    <Button size="sm" variant="ghost" onClick={() => void toggle()}>
      {active ? <IoContractOutline aria-hidden /> : <IoExpandOutline aria-hidden />}
      {active ? "Свернуть" : label}
    </Button>
  );
};

export type { FullscreenButtonProps };
export default FullscreenButton;
