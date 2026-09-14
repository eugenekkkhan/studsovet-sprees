import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { cn } from "cn";
import { fetchAdminConfig, type AdminConfig, type FeatureKey } from "../../../api/adminApi";
import { insideTelegram } from "../../../api/telegram";
import { useAuth } from "../../../hooks/useAuth";

interface LinkItem {
  text: string;
  path: string;
  /** Extra routes that should light this tab up — "/" renders the roulette. */
  aliases?: string[];
  feature: FeatureKey;
}

const links: LinkItem[] = [
  { text: "Мероприятия", path: "/", feature: "events" },
  { text: "Рейтинг", path: "/rating", feature: "rating" },
  { text: "Участники", path: "/participants", feature: "participants" },
  { text: "Колесо удачи", path: "/roulette", feature: "roulette" },
  { text: "Поле чудес", path: "/field-of-miracles", feature: "fieldOfMiracles" },
  { text: "Своя игра", path: "/quiz", feature: "quiz" },
];

const Header = () => {
  const { pathname } = useLocation();
  const { status, signOut } = useAuth();
  const [adminConfig, setAdminConfig] = useState<AdminConfig | null>(null);
  const refreshConfig = useCallback(() => {
    if (status === "authorized") void fetchAdminConfig().then(setAdminConfig).catch(() => undefined);
  }, [status]);

  useEffect(() => {
    refreshConfig();
    window.addEventListener("sprees:features-changed", refreshConfig);
    return () => window.removeEventListener("sprees:features-changed", refreshConfig);
  }, [refreshConfig]);

  // Пока вход не состоялся, шапка ведёт в никуда: каждая её ссылка упирается
  // в ту же форму входа, которую она собой и накрывает.
  if (status !== "authorized") {
    return null;
  }

  // Экраны игроков и проектора живут во весь экран — шапка им не нужна.
  const bare = [
    "/field-of-miracles/play",
    "/field-of-miracles/host",
    "/field-of-miracles/board",
    "/quiz/play",
    "/quiz/host",
    "/quiz/board",
  ];
  if (bare.includes(pathname)) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 z-[1000] box-border flex h-[var(--header-height)] w-full items-center justify-between bg-[linear-gradient(180deg,var(--color-surface),transparent)]">
      <div className="flex w-full items-center justify-start gap-sm overflow-x-auto px-xs py-md sm:p-md sm:justify-center">
        {links.filter((link) => adminConfig?.features[link.feature] === true).map((link) => {
          const active =
            pathname === link.path || Boolean(link.aliases?.includes(pathname));

          return (
            <Link
              key={link.path}
              to={link.path}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-(--control-height-md) flex-[1_0_auto] items-center justify-center rounded-pill border px-lg text-sm leading-[1.2] font-medium whitespace-nowrap no-underline transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground hover:opacity-90"
                  : "border-border bg-surface text-neutral hover:border-border-strong hover:bg-surface-muted hover:text-text",
              )}
            >
              {link.text}
            </Link>
          );
        })}
        {adminConfig?.isAdmin && (
          <Link
            to="/admin"
            aria-current={pathname === "/admin" ? "page" : undefined}
            className={cn(
              "inline-flex h-(--control-height-md) flex-[1_0_auto] items-center justify-center rounded-pill border px-lg text-sm leading-[1.2] font-medium whitespace-nowrap no-underline transition-colors",
              pathname === "/admin"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-neutral hover:bg-surface-muted hover:text-text",
            )}
          >
            Админка
          </Link>
        )}
        {!insideTelegram() && (
          <button
            type="button"
            onClick={signOut}
            className="inline-flex h-(--control-height-md) flex-[1_0_auto] items-center justify-center rounded-pill border border-danger/35 bg-surface px-lg text-sm leading-[1.2] font-medium whitespace-nowrap text-danger-strong transition-colors hover:bg-danger-tint"
          >
            Выйти
          </button>
        )}
      </div>
    </div>
  );
};

export default Header;
