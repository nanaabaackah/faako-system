declare module "animejs" {
  export function animate(
    target: HTMLElement | HTMLElement[] | NodeListOf<HTMLElement>,
    parameters: Record<string, unknown>,
  ): unknown;
}
