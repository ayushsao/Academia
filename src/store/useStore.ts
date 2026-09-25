import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Order {
  id: string;
  orderId?: string;
  service: string;
  subject: string;
  pages: number;
  deadline: string;
  topicTitle: string;
  topic_title?: string;
  instructions: string;
  totalAmount: number;
  currency?: string;
  total_amount?: number;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  createdAt: string;
  created_at?: string;
  files?: string[];
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
      login: (email, name, token, id, role) => set({ user: { email, name, id, role }, token: token || null }),
      logout: () => set({ user: null, token: null, orders: [] }),
      addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
      updateOrderStatus: (id, status) => set((state) => ({
        orders: state.orders.map(o => o.id === id ? { ...o, status } : o)
      })),
      setOrders: (orders) => set({ orders }),
    }),
    { name: 'academiapro-storage' }
  )
);
