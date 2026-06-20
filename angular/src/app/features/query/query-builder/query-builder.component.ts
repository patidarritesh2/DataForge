import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DatasetService, ColumnDef, Filter, Aggregation, QueryResult } from '../../../core/services/dataset.service';
@Component({
  selector: 'app-query-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './query-builder.component.html',
  styleUrls: ['./query-builder.component.css'
  ]
})

export class QueryBuilderComponent implements OnInit {
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private datasetSvc = inject(DatasetService);

  datasetId = '';
  datasetName = signal('');
  rowCount = signal(0);
  columns = signal<ColumnDef[]>([]);
  numericColumns = signal<ColumnDef[]>([]);

  filters = signal<Filter[]>([]);
  groupBys = signal<string[]>([]);
  aggregations = signal<Aggregation[]>([]);
  orderBys = signal<{ field: string; direction: 'ASC' | 'DESC' }[]>([]);
  limit = '1000';
  currentOffset = signal(0);

  result = signal<QueryResult | null>(null);
  resultColumns = signal<string[]>([]);
  running = signal(false);
  queryError = signal<string | null>(null);
  sortCol = signal<string | null>(null);
  sortDir = signal<'ASC' | 'DESC'>('ASC');

  quickExamples = [
    { label: 'Count all rows', filters: [], groupBy: [], aggs: [{ field: '*', function: 'count', alias: 'total_rows' }] },
    { label: 'Show first 100', filters: [], groupBy: [], aggs: [] },
  ];

  ngOnInit(): void {
    this.datasetId = this.route.snapshot.paramMap.get('id') || '';
    this.datasetSvc.getSchema(this.datasetId).subscribe({
      next: (res) => {
        this.columns.set(res.columns);
        this.numericColumns.set(res.columns.filter(c => c.isNumeric));
        this.rowCount.set(res.rowCount);
      },
    });
    this.datasetSvc.getDataset(this.datasetId).subscribe({
      next: (res) => this.datasetName.set(res.dataset.name),
    });
  }

  addFilter(): void {
    this.filters.update(f => [...f, { field: '', operator: '=', value: '' }]);
  }
  removeFilter(i: number): void {
    this.filters.update(f => f.filter((_, idx) => idx !== i));
  }

  addGroupBy(): void {
    this.groupBys.update(g => [...g, '']);
  }
  updateGroupBy(i: number, val: string): void {
    this.groupBys.update(g => g.map((v, idx) => idx === i ? val : v));
  }
  removeGroupBy(i: number): void {
    this.groupBys.update(g => g.filter((_, idx) => idx !== i));
  }

  addAggregation(): void {
    this.aggregations.update(a => [...a, { field: '*', function: 'count', alias: 'count' }]);
  }
  removeAggregation(i: number): void {
    this.aggregations.update(a => a.filter((_, idx) => idx !== i));
  }

  addOrderBy(): void {
    this.orderBys.update(o => [...o, { field: '', direction: 'ASC' }]);
  }
  removeOrderBy(i: number): void {
    this.orderBys.update(o => o.filter((_, idx) => idx !== i));
  }

  sortByCol(col: string): void {
    if (this.sortCol() === col) {
      this.sortDir.update(d => d === 'ASC' ? 'DESC' : 'ASC');
    } else {
      this.sortCol.set(col);
      this.sortDir.set('ASC');
    }
    this.orderBys.set([{ field: col, direction: this.sortDir() }]);
    this.runQuery();
  }

  runQuery(offset = 0): void {
    this.running.set(true);
    this.queryError.set(null);
    this.currentOffset.set(offset);

    const validFilters = this.filters().filter(f => f.field && f.value !== '');
    const validGroupBys = this.groupBys().filter(g => g);
    const validAggs = this.aggregations().filter(a => a.function);
    const validOrderBys = this.orderBys().filter(o => o.field);

    this.datasetSvc.query(this.datasetId, {
      filters: validFilters,
      groupBy: validGroupBys,
      aggregations: validAggs,
      orderBy: validOrderBys,
      limit: +this.limit,
      offset,
    }).subscribe({
      next: (res) => {
        this.result.set(res);
        if (res.data.length > 0) {
          this.resultColumns.set(Object.keys(res.data[0]));
        } else {
          this.resultColumns.set([]);
        }
        this.running.set(false);
      },
      error: (err) => {
        this.queryError.set(err.error?.message || 'Query failed. Check your parameters.');
        this.running.set(false);
      },
    });
  }

  prevPage(): void {
    const newOffset = Math.max(0, this.currentOffset() - +this.limit);
    this.runQuery(newOffset);
  }

  nextPage(): void {
    this.runQuery(this.currentOffset() + +this.limit);
  }

  resetAll(): void {
    this.filters.set([]);
    this.groupBys.set([]);
    this.aggregations.set([]);
    this.orderBys.set([]);
    this.limit = '1000';
    this.result.set(null);
    this.queryError.set(null);
    this.currentOffset.set(0);
    this.sortCol.set(null);
  }

  applyExample(ex: { label: string; filters: Filter[]; groupBy: string[]; aggs: Aggregation[] }): void {
    this.filters.set([...ex.filters]);
    this.groupBys.set([...ex.groupBy]);
    this.aggregations.set([...ex.aggs]);
    this.runQuery();
  }

  stringify(val: unknown): string {
    if (val === null || val === undefined) return '';
    return String(val);
  }

  exportCsv(): void {
    const data = this.result()?.data;
    if (!data || data.length === 0) return;
    const cols = this.resultColumns();
    const header = cols.join(',');
    const rows = data.map(row =>
      cols.map(c => {
        const v = this.stringify(row[c]);
        return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.datasetName() || 'query-result'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
