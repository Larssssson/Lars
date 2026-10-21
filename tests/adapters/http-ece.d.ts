/** http_ece kommt mit web-push; im Test entschlüsselt es die Nutzlast wie ein Gerät. */
declare module "http_ece" {
  export function decrypt(buffer: Buffer, params: { version: string; privateKey: import("node:crypto").ECDH; authSecret: string }): Buffer;
}
