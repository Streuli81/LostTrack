// src/app/routes.jsx
import { createBrowserRouter, Navigate } from "react-router-dom";

import Layout from "../components/Layout.jsx";
import Dashboard from "../pages/Dashboard.jsx";
import NewItem from "../pages/NewItem.jsx";
import Search from "../pages/Search.jsx";
import Settings from "../pages/Settings.jsx";
import SettingsHome from "../pages/SettingsHome.jsx";
import ItemDetail from "../pages/ItemDetail.jsx";
import Users from "../pages/Users.jsx";

import RequirePermission from "../components/RequirePermission.jsx";
import RequireAuth from "../components/RequireAuth.jsx";
import Login from "../pages/Login.jsx";

export const router = createBrowserRouter([
  // ✅ öffentlich
  { path: "/login", element: <Login /> },

  // ✅ geschützt
  {
    path: "/",
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },

      {
        path: "neu",
        element: (
          <RequirePermission action="ITEM_CREATE">
            <NewItem />
          </RequirePermission>
        ),
      },

      {
        path: "items/:id/bearbeiten",
        element: (
          <RequirePermission action="ITEM_EDIT">
            <NewItem />
          </RequirePermission>
        ),
      },

      { path: "suche", element: <Search /> },
      { path: "items/:id", element: <ItemDetail /> },

      {
        path: "einstellungen",
        element: <Settings />,
        children: [
          { index: true, element: <SettingsHome /> },
          {
            path: "benutzer",
            element: (
              <RequirePermission action="USER_MANAGE">
                <Users />
              </RequirePermission>
            ),
          },
        ],
      },

      { path: "benutzer", element: <Navigate to="/einstellungen/benutzer" replace /> },
    ],
  },
]);
