/**
 * 格式化日期，显示为相对时间
 * @param timestamp 时间戳（毫秒）
 * @returns 格式化后的相对时间字符串
 */
export const formatRelativeTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffTime / 1000);
  const diffMinutes = Math.floor(diffTime / (1000 * 60));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffSeconds < 60) {
    return "刚刚";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours}小时前`;
  } else if (diffDays === 1) {
    return "昨天";
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else if (diffDays < 30) {
    return `${Math.floor(diffDays / 7)}周前`;
  } else {
    return date.toLocaleDateString();
  }
};
