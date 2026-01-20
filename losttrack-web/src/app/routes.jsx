import { createBrowserRouter } from "react-router-dom";
import Layout from "../components/Layout.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import NewItem from "../pages/NewItem.jsx";
import Search from "../pages/Search.jsx";
import Settings from "../pages/Settings.jsx";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "neu", element: <NewItem /> },
      { path: "suche", element: <Search /> },
      { path: "einstellungen", element: <Settings /> },
    ],
  },
]);
