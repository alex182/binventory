export interface Location {
  id: number;
  name: string;
  kind: "site" | "zone" | "stack" | "slot";
  parent_id: number | null;
  grid_row: number | null;
  grid_col: number | null;
}

export interface LocationTreeNode extends Location {
  children: LocationTreeNode[];
}

export type Fullness = "empty" | "room" | "full";

export interface Bin {
  id: number;
  code: string;
  label: string;
  status: "blank" | "active";
  location_id: number | null;
  stack_position: number | null;
  fullness: Fullness;
  location_note: string;
  notes: string;
  created_at: string;
  is_buried: boolean;
  bins_on_top: number;
}

export type BinWithBuried = Bin;

export interface BinInput {
  label: string;
  location_id: number | null;
  stack_position: number | null;
  fullness: Fullness;
  location_note: string;
  notes: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`/api${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed: ${resp.status}`);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json();
}

export function listLocations(): Promise<Location[]> {
  return request<Location[]>("/locations");
}

export function getLocationTree(): Promise<LocationTreeNode[]> {
  return request<LocationTreeNode[]>("/locations/tree");
}

export function listBins(params?: {
  location_id?: number;
  include_blank?: boolean;
}): Promise<Bin[]> {
  const qs = new URLSearchParams();
  if (params?.location_id != null) qs.set("location_id", String(params.location_id));
  if (params?.include_blank) qs.set("include_blank", "true");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<Bin[]>(`/bins${suffix}`);
}

export function getBin(id: number): Promise<Bin> {
  return request<Bin>(`/bins/${id}`);
}

export function getLocationBins(locationId: number): Promise<BinWithBuried[]> {
  return request<BinWithBuried[]>(`/locations/${locationId}/bins`);
}

export async function getBinByCode(code: string): Promise<Bin | null> {
  const resp = await fetch(`/api/bins/by-code/${encodeURIComponent(code)}`);
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Request failed: ${resp.status}`);
  return resp.json();
}

export function createBin(data: BinInput): Promise<Bin> {
  return request<Bin>("/bins", { method: "POST", body: JSON.stringify(data) });
}

export function updateBin(id: number, data: BinInput): Promise<Bin> {
  return request<Bin>(`/bins/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteBin(id: number): Promise<void> {
  return request<void>(`/bins/${id}`, { method: "DELETE" });
}

export function batchCreateBins(count: number): Promise<Bin[]> {
  return request<Bin[]>("/bins/batch", {
    method: "POST",
    body: JSON.stringify({ count }),
  });
}

export function listBlankBins(): Promise<Bin[]> {
  return request<Bin[]>("/bins/blank");
}

export function claimBin(id: number, data: BinInput): Promise<Bin> {
  return request<Bin>(`/bins/${id}/claim`, { method: "POST", body: JSON.stringify(data) });
}

export function moveBin(
  id: number,
  toLocationId: number,
  toPosition?: number | null,
): Promise<Bin> {
  return request<Bin>(`/bins/${id}/move`, {
    method: "POST",
    body: JSON.stringify({ to_location_id: toLocationId, to_position: toPosition ?? null }),
  });
}

export function moveStack(stackId: number, toLocationId: number): Promise<Bin[]> {
  return request<Bin[]>(`/locations/${stackId}/move`, {
    method: "POST",
    body: JSON.stringify({ to_location_id: toLocationId }),
  });
}

export interface Item {
  id: number;
  bin_id: number;
  name: string;
  qty: number;
  notes: string;
  loaned_to: string | null;
  loaned_at: string | null;
}

export interface ItemInput {
  name: string;
  qty: number;
  notes: string;
}

export function listItems(binId: number): Promise<Item[]> {
  return request<Item[]>(`/bins/${binId}/items`);
}

export function createItem(binId: number, data: ItemInput): Promise<Item> {
  return request<Item>(`/bins/${binId}/items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateItem(id: number, data: Partial<ItemInput>): Promise<Item> {
  return request<Item>(`/items/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteItem(id: number): Promise<void> {
  return request<void>(`/items/${id}`, { method: "DELETE" });
}

export function loanItem(id: number, loanedTo: string): Promise<Item> {
  return request<Item>(`/items/${id}/loan`, {
    method: "POST",
    body: JSON.stringify({ loaned_to: loanedTo }),
  });
}

export function returnItem(id: number): Promise<Item> {
  return request<Item>(`/items/${id}/return`, { method: "POST" });
}

export interface LoanRecord {
  item_id: number;
  item_name: string;
  bin_id: number;
  bin_label: string | null;
  bin_code: string | null;
  loaned_to: string;
  loaned_at: string;
}

export function listLoans(): Promise<LoanRecord[]> {
  return request<LoanRecord[]>("/loans");
}

export interface SearchResult {
  bin_id: number;
  label: string;
  code: string;
  location_path: string;
  matched_field: string;
}

export function search(q: string): Promise<SearchResult[]> {
  return request<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`);
}

export interface GridCell {
  stack_id: number;
  grid_row: number;
  grid_col: number;
  bin_count: number;
  top_bin: Bin | null;
}

export interface Grid {
  rows: number;
  cols: number;
  cells: GridCell[];
}

export function createGrid(siteId: number, rows: number, cols: number): Promise<Location[]> {
  return request<Location[]>(`/locations/${siteId}/grid`, {
    method: "POST",
    body: JSON.stringify({ rows, cols }),
  });
}

export function getGrid(siteId: number): Promise<Grid> {
  return request<Grid>(`/locations/${siteId}/grid`);
}

function locationLabel(loc: Location): string {
  if (loc.kind === "stack" && loc.grid_row != null && loc.grid_col != null) {
    return `R${loc.grid_row}C${loc.grid_col}`;
  }
  return loc.name;
}

export function locationPath(locations: Location[], locationId: number | null): string {
  if (locationId == null) return "";
  const byId = new Map(locations.map((l) => [l.id, l]));
  const parts: string[] = [];
  let current = byId.get(locationId);
  while (current) {
    parts.unshift(locationLabel(current));
    current = current.parent_id != null ? byId.get(current.parent_id) : undefined;
  }
  return parts.join(" · ");
}

export function binAddress(locations: Location[], bin: Bin): string {
  const path = locationPath(locations, bin.location_id);
  const withPosition =
    path && bin.stack_position != null ? `${path} · tote ${bin.stack_position}` : path;
  if (withPosition && bin.location_note) return `${withPosition} · ${bin.location_note}`;
  if (withPosition) return withPosition;
  return bin.location_note || "—";
}
