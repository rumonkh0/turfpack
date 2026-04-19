const createMemoryStore = () => ({
  Product: [],
  Order: [],
  Booking: [],
  Turf: [],
  Tournament: [],
  Payment: []
});

const store = createMemoryStore();

const makeId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const sortRows = (rows, sortBy) => {
  if (!sortBy || typeof sortBy !== "string") {
    return [...rows];
  }
  const isDesc = sortBy.startsWith("-");
  const field = isDesc ? sortBy.slice(1) : sortBy;
  return [...rows].sort((a, b) => {
    const av = a?.[field];
    const bv = b?.[field];
    if (av === bv) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av > bv) return isDesc ? -1 : 1;
    return isDesc ? 1 : -1;
  });
};

const entityApi = (entityName) => ({
  list: async (sortBy, limit) => {
    const rows = sortRows(store[entityName] ?? [], sortBy);
    if (typeof limit === "number") {
      return rows.slice(0, limit);
    }
    return rows;
  },
  create: async (payload = {}) => {
    const record = {
      id: makeId(),
      created_date: new Date().toISOString(),
      ...payload
    };
    store[entityName].unshift(record);
    return record;
  },
  update: async (id, updates = {}) => {
    const idx = store[entityName].findIndex((r) => r.id === id);
    if (idx === -1) {
      throw new Error(`${entityName} with id ${id} not found`);
    }
    const updated = { ...store[entityName][idx], ...updates };
    store[entityName][idx] = updated;
    return updated;
  },
  delete: async (id) => {
    const idx = store[entityName].findIndex((r) => r.id === id);
    if (idx !== -1) {
      store[entityName].splice(idx, 1);
    }
    return { success: true };
  }
});

const getDefaultUser = () => ({
  id: "local-user",
  full_name: "Local Admin",
  email: "local@turfslot.dev",
  role: "admin"
});

const auth = {
  me: async () => getDefaultUser(),
  logout: () => {
    return Promise.resolve();
  },
  redirectToLogin: () => {
    return Promise.resolve();
  }
};

const integrations = {
  Core: {
    UploadFile: async ({ file }) => {
      return {
        file_url: file ? URL.createObjectURL(file) : ""
      };
    }
  }
};

export const base44 = {
  auth,
  integrations,
  entities: {
    Product: entityApi("Product"),
    Order: entityApi("Order"),
    Booking: entityApi("Booking"),
    Turf: entityApi("Turf"),
    Tournament: entityApi("Tournament"),
    Payment: entityApi("Payment")
  }
};
