import { toast } from 'sonner';
import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const createToastId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const notify = (type: ToastType, message: string, duration?: number) => {
  const options = duration ? { duration } : undefined;

  switch (type) {
    case 'success':
      toast.success(message, options);
      break;
    case 'error':
      toast.error(message, options);
      break;
    case 'warning':
      toast.warning(message, options);
      break;
    case 'info':
    default:
      toast(message, options);
      break;
  }
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (type, message, duration) => {
    const id = createToastId();
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }));
    notify(type, message, duration);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toastItem) => toastItem.id !== id),
    })),
  success: (message) => notify('success', message),
  error: (message) => notify('error', message),
  info: (message) => notify('info', message),
  warning: (message) => notify('warning', message),
}));
