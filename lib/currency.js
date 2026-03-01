export const CURRENCY_SYMBOL = 'Rs';
export const CURRENCY_CODE = 'LKR';

export const formatCurrency = (amount, decimals = 2) => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return `${CURRENCY_SYMBOL} 0.00`;
  return `${CURRENCY_SYMBOL} ${numAmount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
};

export const formatAmount = (amount, decimals = 2) => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return '0.00';
  return numAmount.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
