declare global {
  namespace Express {
    interface Locals {
      userId: number;
    }
  }
}

export {};
