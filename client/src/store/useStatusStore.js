import { create } from 'zustand';
import api from '../api/axios';

const useStatusStore = create((set, get) => ({
    myStatuses: null,
    statuses: [],
    isLoading: false,
    error: null,

    fetchStatuses: async () => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await api.get('/status');
            set({
                myStatuses: data.myStatuses || null,
                statuses: data.statuses || [],
                isLoading: false,
            });
        } catch (error) {
            set({
                error: error.response?.data?.error || 'Failed to load statuses',
                isLoading: false,
            });
        }
    },

    createStatus: async (payload) => {
        try {
            await api.post('/status', payload, {
                headers: payload instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined,
            });
            await get().fetchStatuses();
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to create status');
        }
    },

    markViewed: async (statusId) => {
        try {
            await api.patch(`/status/${statusId}/view`);
            set((state) => ({
                statuses: state.statuses.map((group) => ({
                    ...group,
                    items: group.items.map((item) => (
                        item._id === statusId ? { ...item, isViewed: true } : item
                    )),
                    hasUnviewed: group.items.some((item) =>
                        item._id === statusId ? false : !item.isViewed
                    ),
                })),
            }));
        } catch (error) {
            console.error('Failed to mark status as viewed', error);
        }
    },

    deleteStatus: async (statusId) => {
        try {
            await api.delete(`/status/${statusId}`);
            await get().fetchStatuses();
        } catch (error) {
            throw new Error(error.response?.data?.error || 'Failed to delete status');
        }
    },

    applySeenUpdate: ({ statusId, viewer, viewersCount }) => {
        set((state) => ({
            myStatuses: state.myStatuses ? {
                ...state.myStatuses,
                items: state.myStatuses.items.map((item) => {
                    if (item._id !== statusId) return item;
                    const existingViewers = Array.isArray(item.viewers) ? item.viewers : [];
                    const alreadyExists = existingViewers.some((entry) => String(entry.userId) === String(viewer.userId));
                    return {
                        ...item,
                        viewersCount,
                        viewers: alreadyExists ? existingViewers : [...existingViewers, viewer],
                    };
                }),
            } : state.myStatuses,
        }));
    },

    clearError: () => set({ error: null }),
}));

export default useStatusStore;
