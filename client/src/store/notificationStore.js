import { create } from 'zustand';

const MOCK_NOTIFICATIONS = [
  {
    id: 1,
    type: 'info',
    title: 'New user created',
    message: 'Ahmad Karimi was added as a Technician.',
    time: '5 minutes ago',
    read: false,
  },
  {
    id: 2,
    type: 'warning',
    title: 'Low stock alert',
    message: 'Item "Cable UTP Cat6 (500m)" is below minimum threshold.',
    time: '1 hour ago',
    read: false,
  },
  {
    id: 3,
    type: 'success',
    title: 'Project completed',
    message: 'Project "Fiber Installation – Site A" has been marked as complete.',
    time: '3 hours ago',
    read: false,
  },
  {
    id: 4,
    type: 'info',
    title: 'Payment received',
    message: 'Invoice #INV-0042 payment of $3,200 was confirmed.',
    time: 'Yesterday',
    read: true,
  },
  {
    id: 5,
    type: 'warning',
    title: 'Pending approval',
    message: 'Quotation #QT-0018 is awaiting your approval.',
    time: 'Yesterday',
    read: true,
  },
];

export const useNotificationStore = create((set, get) => ({
  notifications: MOCK_NOTIFICATIONS,

  unreadCount: () => get().notifications.filter((n) => !n.read).length,

  markAsRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),

  markAllAsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  addNotification: (notification) =>
    set((s) => ({
      notifications: [{ ...notification, id: Date.now(), read: false }, ...s.notifications],
    })),
}));
