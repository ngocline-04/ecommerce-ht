export const formatCurrency = (num: number | string | undefined | null) => {
  if (!num) {
    return 0;
  }

  if (typeof num === 'string') {
    return num.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
  }

  if (typeof num === 'number') {
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
  }
  return '';
};