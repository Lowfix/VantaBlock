import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastProvider } from "./components/ui/Toast";
import { UserProvider } from "./context/UserContext";
import { RequireAuth } from "./components/layout/RequireAuth";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ServerPanelPage } from "./pages/ServerPanelPage";
import { AccountSettingsPage } from "./pages/AccountSettingsPage";
import { AccountsPage } from "./pages/AccountsPage";
import { OwnerServersPage } from "./pages/owner/OwnerServersPage";
import { OwnerActivityPage } from "./pages/owner/OwnerActivityPage";
import { OwnerInfrastructurePage } from "./pages/owner/OwnerInfrastructurePage";
import { OwnerSettingsPage } from "./pages/owner/OwnerSettingsPage";
import { OwnerSupportPage } from "./pages/owner/OwnerSupportPage";
import { OwnerBillingPage } from "./pages/owner/OwnerBillingPage";
import { CreationRequestsPage } from "./pages/CreationRequestsPage";
import { SupportPage } from "./pages/SupportPage";

function App() {
  return (
    <UserProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/servers/:serverId"
              element={
                <RequireAuth>
                  <ServerPanelPage />
                </RequireAuth>
              }
            />
            <Route
              path="/account"
              element={
                <RequireAuth>
                  <AccountSettingsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/accounts"
              element={
                <RequireAuth>
                  <AccountsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/owner/servers"
              element={
                <RequireAuth>
                  <OwnerServersPage />
                </RequireAuth>
              }
            />
            <Route
              path="/owner/activity"
              element={
                <RequireAuth>
                  <OwnerActivityPage />
                </RequireAuth>
              }
            />
            <Route
              path="/owner/infrastructure"
              element={
                <RequireAuth>
                  <OwnerInfrastructurePage />
                </RequireAuth>
              }
            />
            <Route
              path="/owner/settings"
              element={
                <RequireAuth>
                  <OwnerSettingsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/owner/billing"
              element={
                <RequireAuth>
                  <OwnerBillingPage />
                </RequireAuth>
              }
            />
            <Route
              path="/requests"
              element={
                <RequireAuth>
                  <CreationRequestsPage />
                </RequireAuth>
              }
            />
            <Route
              path="/support"
              element={
                <RequireAuth>
                  <SupportPage />
                </RequireAuth>
              }
            />
            <Route
              path="/owner/support"
              element={
                <RequireAuth>
                  <OwnerSupportPage />
                </RequireAuth>
              }
            />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </UserProvider>
  );
}

export default App;
