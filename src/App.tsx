import { ToastWrapper } from "./components/organisms";
import AppRouter from "./routes/AppRouter";

const App = () => (
  <>
    <AppRouter />
    <ToastWrapper />
  </>
);

export default App;
