import type {
  IdGenerator, 
  Clock 
} from "./interfaces.js";

export class RealIdGen implements IdGenerator {
  generate() { return Bun.randomUUIDv7(); }
}

export class RealClock implements Clock {
  now() { return new Date(); }
}
