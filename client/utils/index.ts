// Utility functions for the CaughtWiki platform

// Encrypt/decrypt functions for admin-only ID system
export const encryptId = (id: string, key: string): string => {
  // In a real implementation, this would use proper encryption
  // For now, we'll use a simple obfuscation method
  return btoa(id + key.substring(0, 5));
};

export const decryptId = (encryptedId: string, key: string): string => {
  // In a real implementation, this would use proper decryption
  // For now, we'll reverse the simple obfuscation
  try {
    const decoded = atob(encryptedId);
    return decoded.substring(0, decoded.length - 5);
  } catch {
    return encryptedId;
  }
};

// Format currency for UK pricing
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(amount);
};

// Validate email format
export const validateEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

// Validate username format
export const validateUsername = (username: string): boolean => {
  const re = /^[a-zA-Z0-9_]{3,20}$/;
  return re.test(username);
};

// Check if user is staff
export const isStaff = (user: any): boolean => {
  return user?.staff || user?.username === 'ceosolace';
};

// Get user account type
export const getAccountType = (user: any): string => {
  return user?.accountType || 'temporary';
};

// Format timestamp for messages
export const formatTimestamp = (timestamp: string): string => {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Generate server invite code
export const generateInviteCode = (): string => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Check if server is boosted enough for custom invite
export const canHaveCustomInvite = (boosts: number): boolean => {
  return boosts >= 6;
};

// Check if server has bot API access
export const hasBotApiAccess = (boosts: number): boolean => {
  return boosts >= 11;
};

// Calculate server boost level
export const getBoostLevel = (boosts: number): string => {
  if (boosts >= 16) return 'Premium+';
  if (boosts >= 11) return 'Premium';
  if (boosts >= 6) return 'Enhanced';
  if (boosts >= 1) return 'Basic';
  return 'None';
};

// Get boost features based on level
export const getBoostFeatures = (boosts: number): string[] => {
  const features = [];
  
  if (boosts >= 1) features.push('Custom emojis');
  if (boosts >= 1) features.push('Increased file size (8MB)');
  if (boosts >= 6) features.push('Custom invite links');
  if (boosts >= 6) features.push('Server banner');
  if (boosts >= 11) features.push('Server bot API access');
  if (boosts >= 11) features.push('Priority support');
  if (boosts >= 16) features.push('Server analytics');
  if (boosts >= 16) features.push('Custom stickers');
  
  return features;
};

// Check if user has premium features
export const hasPremiumFeatures = (user: any): boolean => {
  return user?.premium || user?.accountType === 'permanent';
};

// Format file size for display
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' bytes';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / 1048576).toFixed(1) + ' MB';
};

// Validate message content
export const validateMessage = (content: string): boolean => {
  return content.trim().length > 0 && content.length <= 2000;
};

// Sanitize message content
export const sanitizeMessage = (content: string): string => {
  // Remove potentially harmful content
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+="[^"]*"/gi, '');
};

// Get user IP address (client-side)
export const getUserIP = async (): Promise<string> => {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error('Error getting IP address:', error);
    return 'unknown';
  }
};

// Check if user is accessing from restricted region
export const isRestrictedRegion = (countryCode: string): boolean => {
  // List of restricted countries (example)
  const restrictedCountries = ['CN', 'RU', 'KP'];
  return restrictedCountries.includes(countryCode.toUpperCase());
};

// Generate API key for bot access
export const generateApiKey = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'cw_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Validate API key format
export const isValidApiKey = (key: string): boolean => {
  return /^cw_[A-Za-z0-9]{32}$/.test(key);
};

// Calculate time until next message clear
export const getTimeUntilClear = (): number => {
  const now = new Date();
  const nextClear = new Date(now);
  nextClear.setMinutes(now.getMinutes() + 30 - (now.getMinutes() % 30));
  nextClear.setSeconds(0);
  nextClear.setMilliseconds(0);
  
  return Math.max(0, nextClear.getTime() - now.getTime());
};

// Format duration in milliseconds to human readable format
export const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

// Debounce function for performance optimization
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle function for rate limiting
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};
