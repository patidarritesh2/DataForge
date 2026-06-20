import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Dataset {
  id: string;
  name: string;
  originalFilename: string;
  fileType: 'csv' | 'json';
  rowCount: number;
  status: 'processing' | 'ready' | 'error';
  schema: Record<string, { originalName: string; sqlType: string }> | null;
  createdAt: string;
  errorMessage?: string;
}

export interface ColumnDef {
  name: string;
  originalName: string;
  type: string;
  isNumeric: boolean;
}

export interface Filter {
  field: string;
  operator: string;
  value: string | string[];
}

export interface Aggregation {
  field: string;
  function: string;
  alias: string;
}

export interface QueryParams {
  filters?: Filter[];
  groupBy?: string[];
  aggregations?: Aggregation[];
  orderBy?: { field: string; direction: 'ASC' | 'DESC' }[];
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  success: boolean;
  data: Record<string, unknown>[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}

const API_BASE = 'http://localhost:3000/api';

@Injectable({ providedIn: 'root' })
export class DatasetService {
  private http = inject(HttpClient);

  uploadDataset(file: File, name?: string): Observable<{ success: boolean; dataset: Partial<Dataset> }> {
    const form = new FormData();
    form.append('file', file);
    if (name) form.append('name', name);
    return this.http.post<{ success: boolean; dataset: Partial<Dataset> }>(`${API_BASE}/datasets/upload`, form);
  }

  listDatasets(): Observable<{ success: boolean; datasets: Dataset[] }> {
    return this.http.get<{ success: boolean; datasets: Dataset[] }>(`${API_BASE}/datasets`);
  }

  getDataset(id: string): Observable<{ success: boolean; dataset: Dataset }> {
    return this.http.get<{ success: boolean; dataset: Dataset }>(`${API_BASE}/datasets/${id}`);
  }

  deleteDataset(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${API_BASE}/datasets/${id}`);
  }

  getSchema(id: string): Observable<{ success: boolean; columns: ColumnDef[]; rowCount: number }> {
    return this.http.get<{ success: boolean; columns: ColumnDef[]; rowCount: number }>(`${API_BASE}/datasets/${id}/schema`);
  }

  getDistinctValues(id: string, field: string): Observable<{ success: boolean; values: unknown[] }> {
    return this.http.get<{ success: boolean; values: unknown[] }>(`${API_BASE}/datasets/${id}/distinct`, {
      params: new HttpParams().set('field', field),
    });
  }

  getStats(id: string): Observable<{ success: boolean; stats: Record<string, unknown> }> {
    return this.http.get<{ success: boolean; stats: Record<string, unknown> }>(`${API_BASE}/datasets/${id}/stats`);
  }

  query(id: string, params: QueryParams): Observable<QueryResult> {
    return this.http.post<QueryResult>(`${API_BASE}/datasets/${id}/query`, params);
  }
}
