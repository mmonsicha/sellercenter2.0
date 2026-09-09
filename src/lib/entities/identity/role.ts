export interface Role {
  permissions: string[];
  role_ref: RoleRef;
}

export interface RoleRef {
  code: string;
  namespace: Namespace;
}

export interface Namespace {
  kind: RoleKind;
  id: string;
}

export enum RoleKind {
  System = "patona.system",
  Provider = "patona.provider",
  Company = "patona.company",
  Store = "patona.store",
}
