import { BrowserRouter, Routes, Route } from "react-router";
import TheMostHonestRandomRoulette from "../TheMostHonestRandomRoulette";
import Header from "../Header";
import FieldOfMiracles from "../FieldOfMiracles";
import Quiz from "../Quiz";

const renderMultiRoutes = ({
  paths,
  element,
}: {
  paths: string[];
  element: React.ReactNode;
}) => {
  return paths.map((path) => (
    <Route key={path} path={path} element={element} />
  ));
};

const RouterComponent = () => {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        {renderMultiRoutes({
          paths: ["/", "/roulette"],
          element: <TheMostHonestRandomRoulette />,
        })}
        <Route path="/field-of-miracles" element={<FieldOfMiracles />} />
        <Route path="/quiz" element={<Quiz />} />
      </Routes>
    </BrowserRouter>
  );
};

export default RouterComponent;
