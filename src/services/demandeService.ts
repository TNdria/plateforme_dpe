import { api } from "@/services/demandeApi";

export const demandeService = {
  async list() {
    return api.get("/ouverture/demandes/");
  },

  async detail(id: number | string) {
    return api.get(`/ouverture/demandes/${id}/`);
  },

  async detailComplet(id: number | string) {
    return api.get(`/ouverture/demandes/${id}/`);
  },

  async create(payload: Record<string, unknown>) {
    return api.post("/ouverture/demandes/", payload);
  },

  async update(id: number | string, payload: Record<string, unknown>) {
    return api.put(`/ouverture/demandes/${id}/`, payload);
  },

  async remove(id: number | string) {
    return api.delete(`/ouverture/demandes/${id}/`);
  },
};

export const pieceFournieService = {
  async create(formData: FormData) {
    return fetch("/ouverture/pieces/", {
      method: "POST",
      body: formData,
      credentials: "include",
    });
  },
};

export const etablissementService = {
  async get(code: string | number, _niveau?: string, _opts?: Record<string, unknown>) {
    return api.get(`/ouverture/etablissements/${code}/`);
  },

  async getProximite(code: string | number, _niveau?: string, _opts?: Record<string, unknown>) {
    return api.get(`/ouverture/etablissements/${code}/proximite/`);
  },

  async getEvolution(code: string | number, _niveau?: string, _opts?: Record<string, unknown>) {
    return api.get(`/ouverture/etablissements/${code}/evolution/`);
  },
};

export default demandeService;
