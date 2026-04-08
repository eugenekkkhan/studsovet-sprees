import React from "react";
import { Link } from "react-router";
import "./Header.css";
const Header = () => {
  return (
    <div className="header">
      <div className="header-container">
        <Link to="/roulette" className="header-title">
          Колесо удачи
        </Link>
        <Link to="/field-of-miracles" className="header-link">
          Поле чудес
        </Link>
      </div>
    </div>
  );
};

export default Header;
