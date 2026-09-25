import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API } from '../lib/api';

// Sessions live in an httpOnly cookie that page scripts can't read. `token` is
// only an in-memory fallback for browsers that block even partitioned cookies;
// it is never written to localStorage (see `partialize` below).
const probeCookieSession = () =>
  fetch(`${API}/auth/me`, { credentials: 'include', headers: { 'X-No-Bearer': '1' } })
    .then(r => r.ok)
    .catch(() => false);

export interface OrderDeliveryFile {
  _id: string;
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedBy?: string;
  uploadedAt?: string;
  version: number;
}

export interface OrderFeedback {
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Order {
  id: string;
  orderId?: string;
  service: string;
  subject: string;
  pages: number;
  wordCount?: number;
  deadline: string;
  topicTitle: string;
  topic_title?: string;
  description?: string;
  instructions: string;
  totalAmount: number;
  currency?: string;
  total_amount?: number;
  status: string;
  paymentStatus?: string;
  createdAt: string;
  created_at?: string;
  files?: string[];
  deliveryFiles?: OrderDeliveryFile[];
  submittedAt?: string;
  completedAt?: string;
  feedback?: OrderFeedback;
  writerId?: string;
}

interface AppState {
  user: { name: string; email: string; id?: number | string; role?: string } | null;
  token: string | null;
  orders: Order[];
  login: (email: string, name: string, token?: string, id?: number | string, role?: string) => void;
  logout: () => void;
  addOrder: (order: Order) => void;
  updateOrderStatus: (id: string, status: Order['status']) => void;
  setOrders: (orders: Order[]) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      orders: [],
      // A new sign-in never shows the previous account's orders: the list is
      // cleared and reloaded from the server for the account that just signed in.
      login: (email, name, token, id, role) => {
        set({ user: { email, name, id, role }, token: token || null, orders: [] });
        // Cookie session works → drop the in-memory token entirely.
        if (token) probeCookieSession().then(ok => { if (ok && useStore.getState().token === token) set({ token: null }); });
      },
      logout: () => {
        fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
        set({ user: null, token: null, orders: [] });
      },
      addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
      updateOrderStatus: (id, status) => set((state) => ({
        orders: state.orders.map(o => o.id === id ? { ...o, status } : o)
      })),
      setOrders: (orders) => set({ orders }),
    }),
    {
      name: 'academiapro-storage',
      // Never persist the session token: only the profile shown in the UI.
      partialize: (state) => ({ user: state.user, orders: state.orders }) as any,
    }
  )
);
