import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';

const sameId = (left, right) => String(left || '') === String(right || '');

const sortReminders = (reminders = []) =>
    [...reminders].sort((a, b) => {
        if ((a.status === 'triggered') !== (b.status === 'triggered')) {
            return a.status === 'triggered' ? -1 : 1;
        }

        const leftDate = new Date(a.status === 'triggered' ? (a.triggeredAt || a.remindAt) : a.remindAt);
        const rightDate = new Date(b.status === 'triggered' ? (b.triggeredAt || b.remindAt) : b.remindAt);
        return leftDate - rightDate;
    });

const useReminderStore = create((set, get) => ({
    reminders: [],
    isLoadingReminders: false,

    fetchReminders: async () => {
        set({ isLoadingReminders: true });
        try {
            const { data } = await api.get('/reminders');
            const reminders = sortReminders(data.reminders || []);
            set({ reminders, isLoadingReminders: false });
            return reminders;
        } catch (error) {
            set({ isLoadingReminders: false });
            toast.error(error.response?.data?.error || 'Failed to load reminders');
            throw error;
        }
    },

    createReminder: async ({ messageId, remindAt }) => {
        try {
            const { data } = await api.post('/reminders', { messageId, remindAt });
            set((state) => ({
                reminders: sortReminders([
                    data.reminder,
                    ...state.reminders.filter((reminder) => !sameId(reminder._id, data.reminder?._id)),
                ]),
            }));
            toast.success('Reminder created');
            return data.reminder;
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to create reminder');
            throw error;
        }
    },

    deleteReminder: async (reminderId) => {
        try {
            await api.delete(`/reminders/${reminderId}`);
            set((state) => ({
                reminders: state.reminders.filter((reminder) => !sameId(reminder._id, reminderId)),
            }));
            toast.success('Reminder removed');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to remove reminder');
            throw error;
        }
    },

    upsertReminder: (reminder) => {
        if (!reminder?._id) return;
        set((state) => ({
            reminders: sortReminders([
                reminder,
                ...state.reminders.filter((entry) => !sameId(entry._id, reminder._id)),
            ]),
        }));
    },
}));

export default useReminderStore;
