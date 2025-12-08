const WORKMASTER_CART_KEY = 'bnote-workmaster-cart';

export const readWorkMasterCartEntries = () => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = window.localStorage.getItem(WORKMASTER_CART_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch (error) {
    console.error('Failed to read WorkMaster cart entries', error);
    return [];
  }
};

export const persistWorkMasterCartEntries = (entries) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WORKMASTER_CART_KEY, JSON.stringify(entries));
    notifyWorkMasterCartChange();
  } catch (error) {
    console.error('Failed to persist WorkMaster cart entries', error);
  }
};

export const formatCartTimestamp = (isoValue) => {
  if (!isoValue) return '—';
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

export function notifyWorkMasterCartChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('workmaster-cart-changed'));
};
