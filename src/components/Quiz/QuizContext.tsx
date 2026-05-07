import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState } from './types';

const BACKEND_URL = 'http://localhost:3000';

const DEFAULT_STATE: GameState = {
  rounds: [],
  activeRoundId: null,
  activeQuestion: null,
  teams: [],
  phase: 'lobby',
};

interface QuizContextValue {
  state: GameState;
  connected: boolean;
  joinAsCaptain: (teamId: string) => Promise<{ success: boolean; error?: string }>;
  buzz: () => void;
}

const QuizContext = createContext<QuizContextValue>({
  state: DEFAULT_STATE,
  connected: false,
  joinAsCaptain: async () => ({ success: false }),
  buzz: () => {},
});

export const useQuiz = () => useContext(QuizContext);

export const QuizProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const captainTeamIdRef = useRef<string | null>(
    localStorage.getItem('quizCaptainTeamId'),
  );

  useEffect(() => {
    const socket = io(`${BACKEND_URL}/quiz`);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('get:state');
      // Re-register captain on reconnect
      const teamId = captainTeamIdRef.current;
      if (teamId) {
        socket.emit('captain:join', { teamId });
      }
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('state:update', (newState: GameState) => {
      setState(newState);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinAsCaptain = (teamId: string): Promise<{ success: boolean; error?: string }> =>
    new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket) return resolve({ success: false, error: 'Not connected' });

      const onJoined = (result: { success: boolean; error?: string }) => {
        if (result.success) {
          captainTeamIdRef.current = teamId;
          localStorage.setItem('quizCaptainTeamId', teamId);
        }
        resolve(result);
      };

      socket.once('captain:joined', onJoined);
      socket.emit('captain:join', { teamId });
    });

  const buzz = () => {
    socketRef.current?.emit('captain:buzz');
  };

  return (
    <QuizContext.Provider value={{ state, connected, joinAsCaptain, buzz }}>
      {children}
    </QuizContext.Provider>
  );
};
