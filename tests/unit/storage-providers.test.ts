import { describe, expect, it } from "vitest";
import { storageRoleFor, STORAGE_ROLES } from "@/lib/forja/storage-providers";

describe("Contrato de almacenamiento", () => {
  it("asigna a Drive el rol de conocimiento y referencias", () => {
    expect(storageRoleFor("google-drive")).toContain("knowledge");
    expect(storageRoleFor("google-drive")).toContain("references");
  });

  it("asigna a MEGA el rol de código y repositorios", () => {
    expect(storageRoleFor("mega")).toContain("code");
    expect(storageRoleFor("mega")).toContain("repositories");
  });

  it("no mezcla roles entre providers", () => {
    expect(STORAGE_ROLES["google-drive"]).not.toContain("code");
    expect(STORAGE_ROLES.mega).not.toContain("knowledge");
  });

  it("MEGA es solo código: los datasets y referencias viven en Drive", () => {
    expect(STORAGE_ROLES.mega).not.toContain("datasets");
    expect(STORAGE_ROLES["google-drive"]).toContain("datasets");
  });
});
