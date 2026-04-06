/** First token of a decorator text, lowercased: `@Get()` -> `get`. */
export const decoratorNameFromText = (str: string): string => {
  if (!str) return "unknown";
  if (!str.startsWith("@")) return "unknown";

  let component = "";
  for (let i = 1; i < str.length; i++) {
    if (str[i] === "(") break;
    component += str[i];
  }

  return component.toLowerCase();
}
