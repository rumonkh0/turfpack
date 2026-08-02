const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    const errorMsg = (data && data.error) || response.statusText;
    const error = new Error(errorMsg);
    error.status = response.status;
    throw error;
  }
  return data.data;
};

const entityApi = (endpoint) => ({
  list: async (sort, limit) => {
    let url = `${API_URL}/${endpoint}`;
    const params = new URLSearchParams();
    if (sort) params.append("sort", sort);
    if (limit) params.append("limit", limit);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url, { headers: getAuthHeader() });
    return handleResponse(res);
  },
  get: async (id) => {
    const res = await fetch(`${API_URL}/${endpoint}/${id}`, {
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },
  create: async (payload) => {
    const res = await fetch(`${API_URL}/${endpoint}`, {
      method: "POST",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },
  update: async (id, payload) => {
    const res = await fetch(`${API_URL}/${endpoint}/${id}`, {
      method: "PUT",
      headers: { ...getAuthHeader(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },
  delete: async (id) => {
    const res = await fetch(`${API_URL}/${endpoint}/${id}`, {
      method: "DELETE",
      headers: getAuthHeader(),
    });
    return handleResponse(res);
  },
});

export const apiClient = {
  auth: {
    me: async () => {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: getAuthHeader(),
      });
      return handleResponse(res);
    },
    login: async (email, password) => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      localStorage.setItem("token", data.token);
      return data.user;
    },
    desktopAutoLogin: async () => {
      const res = await fetch(`${API_URL}/auth/desktop-auto-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        const error = new Error(data.error || "Desktop auto-login failed");
        error.status = res.status;
        throw error;
      }

      if (data?.token) {
        localStorage.setItem("token", data.token);
      }

      return data.user;
    },
    logout: () => {
      localStorage.removeItem("token");
      window.location.href = "/";
    },
  },
  entities: {
    Product: entityApi("products"),
    Order: entityApi("orders"),
    Booking: entityApi("bookings"),
    Turf: entityApi("turfs"),
    Tournament: entityApi("tournaments"),
    Payment: entityApi("payments"),
    User: entityApi("users"),
    Account: entityApi("accounts"),
    Expense: entityApi("expenses"),
    Income: entityApi("incomes"),
    Partner: {
      ...entityApi("partners"),
      reallocate: async (payload) => {
        const res = await fetch(`${API_URL}/partners/reallocate`, {
          method: "POST",
          headers: { ...getAuthHeader(), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        return handleResponse(res);
      },
      sharesHistory: async (limit = 20) => {
        const res = await fetch(`${API_URL}/partners/shares/history?limit=${limit}`, { headers: getAuthHeader() });
        return handleResponse(res);
      },
      payouts: {
        list: async (params = {}) => {
          const query = new URLSearchParams(params).toString();
          const res = await fetch(`${API_URL}/partners/payouts${query ? `?${query}` : ''}`, { headers: getAuthHeader() });
          return handleResponse(res);
        },
        create: async (payload) => {
          const res = await fetch(`${API_URL}/partners/payouts`, {
            method: "POST",
            headers: { ...getAuthHeader(), "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          return handleResponse(res);
        }
      }
    },
    Ledger: {
      ...entityApi("ledger")
    },
    Report: {
      profitLoss: async (params = {}) => {
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_URL}/reports/profit-loss${query ? `?${query}` : ''}`, { headers: getAuthHeader() });
        return handleResponse(res);
      }
    }
  },
  integrations: {
    Core: {
      UploadFile: async ({ file }) => {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`${API_URL}/upload`, {
          method: "POST",
          headers: getAuthHeader(),
          body: formData,
        });
        return handleResponse(res);
      },
    },
  },
  license: {
    status: async () => {
      try {
        const res = await fetch(`${API_URL}/license/status`);
        if (res.status === 404) return null; // Web mode – no license endpoint
        const data = await res.json();
        if (!data.success) return null;
        return data.data;
      } catch {
        return null; // Web mode or network error
      }
    },
    activate: async (licenseKey) => {
      const res = await fetch(`${API_URL}/license/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Activation failed");
      return data.data;
    },
  },
};
