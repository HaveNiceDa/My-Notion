declare module "twrnc" {
  type TailwindFn = {
    (strings: TemplateStringsArray, ...values: unknown[]): any;
    style: (...values: unknown[]) => any;
  };

  export const style: (...values: unknown[]) => any;

  const tw: TailwindFn;
  export default tw;
}
