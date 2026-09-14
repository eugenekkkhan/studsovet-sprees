import { lazy, Suspense, useEffect, useRef } from "react";
import { BrowserRouter, Outlet, Route, Routes, useNavigate } from "react-router";
import { telegramStartParam } from "../api/telegram";
import { LoadingSpinner } from "../components/atoms";
import { AuthGate, Header } from "../components/organisms";
import AuthProvider from "../context/AuthProvider";
import { routeForStartParam } from "../utils/startParam";

const RoulettePage = lazy(() => import("../pages/Roulette/RoulettePage"));
const EventsPage = lazy(() => import("../pages/Events/EventsPage"));
const RatingPage = lazy(() => import("../pages/Rating/RatingPage"));
const ParticipantsPage = lazy(() => import("../pages/Participants/ParticipantsPage"));
const ParticipantProfilePage = lazy(() => import("../pages/Participants/ParticipantProfilePage"));
const AdminPage = lazy(() => import("../pages/Admin/AdminPage"));
const FieldOfMiraclesPage = lazy(
  () => import("../pages/FieldOfMiracles/FieldOfMiraclesPage"),
);
const FieldOfMiraclesPlayerPage = lazy(
  () => import("../pages/FieldOfMiracles/FieldOfMiraclesPlayerPage"),
);
const FieldOfMiraclesRemoteHostPage = lazy(
  () => import("../pages/FieldOfMiracles/FieldOfMiraclesRemoteHostPage"),
);
const FieldOfMiraclesBoardPage = lazy(
  () => import("../pages/FieldOfMiracles/FieldOfMiraclesBoardPage"),
);
const QuizHostPage = lazy(() => import("../pages/Quiz/QuizHostPage"));
const SharedDeckAccessPage = lazy(() => import("../pages/Quiz/SharedDeckAccessPage"));
const QuizPlayerPage = lazy(() => import("../pages/Quiz/QuizPlayerPage"));
const QuizBoardPage = lazy(() => import("../pages/Quiz/QuizBoardPage"));
const QuizRemoteHostPage = lazy(
  () => import("../pages/Quiz/QuizRemoteHostPage"),
);

const RouteFallback = () => (
  <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-surface">
    <LoadingSpinner size="lg" label="Загружаем экран" />
  </div>
);

/** Ссылка из чата ведёт сразу в комнату — разбираем её один раз при запуске. */
const StartParamRoute = () => {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    const route = routeForStartParam(telegramStartParam());
    if (route && route !== window.location.pathname) {
      void navigate(route, { replace: true });
    }
  }, [navigate]);

  return null;
};

/** Экраны, куда входят по ключу комнаты: их открывают участники и проектор. */
const openRoutes = (
  <>
    <Route path="/quiz/play" element={<QuizPlayerPage />} />
    <Route path="/quiz/board" element={<QuizBoardPage />} />
    <Route path="/quiz/host" element={<QuizRemoteHostPage />} />
    <Route
      path="/field-of-miracles/play"
      element={<FieldOfMiraclesPlayerPage />}
    />
    <Route
      path="/field-of-miracles/host"
      element={<FieldOfMiraclesRemoteHostPage />}
    />
    <Route
      path="/field-of-miracles/board"
      element={<FieldOfMiraclesBoardPage />}
    />
  </>
);

const Protected = () => (
  <AuthGate>
    <Outlet />
  </AuthGate>
);

const AppRouter = () => (
  <BrowserRouter>
    <AuthProvider>
      <Header />
      <StartParamRoute />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {openRoutes}
          <Route element={<Protected />}>
            <Route path="/" element={<EventsPage />} />
            <Route path="/rating" element={<RatingPage />} />
            <Route path="/participants" element={<ParticipantsPage />} />
            <Route path="/participants/:id" element={<ParticipantProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/roulette" element={<RoulettePage />} />
            <Route path="/field-of-miracles" element={<FieldOfMiraclesPage />} />
            <Route path="/quiz" element={<QuizHostPage />} />
            <Route path="/quiz/decks/access/:code" element={<SharedDeckAccessPage />} />
          </Route>
        </Routes>
      </Suspense>
    </AuthProvider>
  </BrowserRouter>
);

export default AppRouter;
