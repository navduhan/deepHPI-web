import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "./components/AppShell";
import {
  AboutPage,
  CovidPage,
  DatasetsPage,
  HelpPage,
  HomePage,
  NetworkPage,
  NotFoundPage,
  ResultsPage,
  SubmitPage,
} from "./pages";

function normalizePath(pathname) {
  if (!pathname) {
    return "/";
  }

  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  return normalized || "/";
}

function matchRoute(pathname) {
  const path = normalizePath(pathname);

  if (path === "/") {
    return { page: "home", params: {} };
  }

  if (path === "/submit") {
    return { page: "submit", params: {} };
  }

  if (path === "/about") {
    return { page: "about", params: {} };
  }

  if (path === "/datasets") {
    return { page: "datasets", params: {} };
  }

  if (path === "/help") {
    return { page: "help", params: {} };
  }

  if (path === "/human-covid-ppi") {
    return { page: "covid", params: {} };
  }

  const covidNetworkMatch = path.match(/^\/human-covid-ppi\/([^/]+)$/);
  if (covidNetworkMatch) {
    return { page: "covid-network", params: { protein: decodeURIComponent(covidNetworkMatch[1]) } };
  }

  const resultsMatch = path.match(/^\/results\/([^/]+)$/);
  if (resultsMatch) {
    return { page: "results", params: { jobId: resultsMatch[1] } };
  }

  const networkMatch = path.match(/^\/network\/([^/]+)$/);
  if (networkMatch) {
    return { page: "network", params: { jobId: networkMatch[1] } };
  }

  return { page: "not-found", params: {} };
}

export default function App() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const currentBrowserPath = useCallback(() => {
    const path = window.location.pathname;
    return normalizePath(basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path);
  }, [basePath]);
  const [pathname, setPathname] = useState("/");

  useEffect(() => {
    setPathname(currentBrowserPath());
    const onPopState = () => setPathname(currentBrowserPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [currentBrowserPath]);

  const navigate = (target) => {
    const nextPath = normalizePath(target);
    if (nextPath === pathname) {
      return;
    }

    window.history.pushState({}, "", `${basePath}${nextPath}`);
    setPathname(nextPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const route = useMemo(() => matchRoute(pathname), [pathname]);

  let page = <NotFoundPage navigate={navigate} />;

  if (route.page === "home") {
    page = <HomePage navigate={navigate} />;
  } else if (route.page === "submit") {
    page = <SubmitPage navigate={navigate} />;
  } else if (route.page === "about") {
    page = <AboutPage />;
  } else if (route.page === "datasets") {
    page = <DatasetsPage />;
  } else if (route.page === "help") {
    page = <HelpPage navigate={navigate} />;
  } else if (route.page === "covid") {
    page = <CovidPage navigate={navigate} />;
  } else if (route.page === "covid-network") {
    page = <CovidPage protein={route.params.protein} navigate={navigate} />;
  } else if (route.page === "results") {
    page = <ResultsPage jobId={route.params.jobId} navigate={navigate} />;
  } else if (route.page === "network") {
    page = <NetworkPage jobId={route.params.jobId} navigate={navigate} />;
  }

  return <AppShell currentPath={pathname} navigate={navigate}>{page}</AppShell>;
}
