/** «1 conversación», «2 conversaciones». Un texto con «archivo(s)» se lee como
 * un formulario; con el número delante, la forma correcta cuesta lo mismo. */
export function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}
