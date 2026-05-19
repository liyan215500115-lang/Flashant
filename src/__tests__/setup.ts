import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// server-only throws when imported in client context (jsdom). Mock it out.
vi.mock("server-only", () => ({}));
