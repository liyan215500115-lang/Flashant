export type JsonMessage =
  | string
  | number
  | boolean
  | null
  | JsonMessage[]
  | { [key: string]: JsonMessage };

export function translate(messages: JsonMessage, key: string): string {
  let val: JsonMessage = messages;
  for (const part of key.split(".")) {
    if (val && typeof val === "object" && !Array.isArray(val) && part in val) {
      val = val[part];
    } else {
      return key;
    }
  }
  return typeof val === "string" ? val : key;
}
