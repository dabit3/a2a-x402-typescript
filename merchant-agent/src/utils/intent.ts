export function getMessageText(message: any): string {
  if (!message?.parts || !Array.isArray(message.parts)) {
    return '';
  }

  return message.parts
    .map((part: any) => {
      if (typeof part === 'string') {
        return part;
      }
      if (part?.text && typeof part.text === 'string') {
        return part.text;
      }
      return '';
    })
    .join(' ')
    .trim();
}

const KEYWORDS = ['buy', 'purchase', 'pay', 'checkout', 'order', 'get', 'acquire'];
const AFFIRMATIVE = ['yes', 'y', 'yeah', 'yep', 'sure', 'ok', 'okay', 'confirm', 'please do', 'do it'];

/**
 * Detects if the user's message expresses intent to buy the ebook.
 */
export function isPurchaseIntent(message: any): boolean {
  const text = getMessageText(message).toLowerCase();
  if (!text) {
    return false;
  }

  if (AFFIRMATIVE.includes(text)) {
    return true;
  }

  return KEYWORDS.some(keyword => text.includes(keyword));
}
