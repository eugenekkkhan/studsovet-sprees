import { Link, useLocation } from "react-router";
import "./Header.css";

interface LinkItem {
  text: string;
  path: string;
}

const renderLinks = ({
  currentPath,
  links,
}: {
  currentPath: string;
  links: LinkItem[];
}) => {
  return links.map((link) => (
    <Link
      key={link.path}
      to={link.path}
      className={`header-link ${currentPath === link.path ? "active" : ""}`}
    >
      {link.text}
    </Link>
  ));
};

const Header = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const links = [
    { text: "Колесо удачи", path: "/roulette" },
    { text: "Поле чудес", path: "/field-of-miracles" },
  ];

  return (
    <div className="header">
      <div className="header-container">
        {renderLinks({ currentPath, links })}
      </div>
    </div>
  );
};

export default Header;
