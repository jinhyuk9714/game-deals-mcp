export function formatKoreanPriceSummary(
  title: string,
  price: number,
  currency: string,
  suffix?: string
): string {
  return suffix
    ? `${title} 현재가 ${formatPrice(price, currency)} (${suffix})`
    : `${title} 현재가 ${formatPrice(price, currency)}`;
}

export function formatPrice(amount: number, currency: string): string {
  if (currency === "KRW") {
    return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
  }

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2
  }).format(amount)} ${currency}`;
}
