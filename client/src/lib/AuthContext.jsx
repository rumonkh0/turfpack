import React, { createContext, useState, useContext, useEffect } from "react";
import { apiClient } from "@/api/client";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }
  const isDesktop =
    typeof navigator !== "undefined" && /Electron/.test(navigator.userAgent);

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    setIsLoadingPublicSettings(true);
    setAuthError(null);

    // Local mode: no hosted app settings fetch required.
    setAppPublicSettings({ local: true });
    await checkUserAuth();
    setIsLoadingPublicSettings(false);
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await apiClient.auth.me();

      // Desktop must always use the trusted admin account.
      // If an older non-admin token exists, replace it immediately.
      if (isDesktop && currentUser?.role !== "admin") {
        await apiClient.auth.logout();
        const desktopUser = await apiClient.auth.desktopAutoLogin();
        setUser(desktopUser);
        setIsAuthenticated(true);
        setAuthError(null);
        setIsLoadingAuth(false);
        return;
      }

      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error("User auth check failed:", error);
      setIsAuthenticated(false);

      // Desktop trusted mode: attempt silent auto-login before falling back to /Login
      if (error.status === 401 || error.status === 403) {
        try {
          const desktopUser = await apiClient.auth.desktopAutoLogin();
          setUser(desktopUser);
          setIsAuthenticated(true);
          setAuthError(null);
          setIsLoadingAuth(false);
          return;
        } catch {
          // Ignore and continue with normal login behavior (web mode or non-desktop)
        }
      }

      setIsLoadingAuth(false);

      // If user auth fails and we are not on the login page, set auth error
      if (
        (error.status === 401 || error.status === 403) &&
        window.location.pathname !== "/Login"
      ) {
        setAuthError({
          type: "auth_required",
          message: "Authentication required",
        });
      }
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    apiClient.auth.logout();

    if (shouldRedirect) {
      window.location.href = "/Login";
      return;
    }
  };

  const navigateToLogin = () => {
    window.location.href = "/Login";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
