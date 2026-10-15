/** 中文相对时间：当天按"刚刚／N 分钟前／N 小时前"；昨天单独标注，一周内"N 天前"，更早显示日期。 */
export function relativeTime(iso: string, now = Date.now()): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return iso;
  const date = new Date(time);
  const current = new Date(now);
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(current) - startOfDay(date)) / 86_400_000);
  if (days <= 0) {
    const minutes = Math.floor(Math.max(0, now - time) / 60_000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    return `${Math.floor(minutes / 60)} 小时前`;
  }
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  const text = `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  return date.getFullYear() === current.getFullYear() ? text : `${date.getFullYear()} 年 ${text}`;
}
