import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DatasetService, Dataset } from '../../../core/services/dataset.service';

@Component({
  selector: 'app-dataset-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dataset-list.component.html',
  styleUrls: ['./dataset-list.component.css']
})

export class DatasetListComponent implements OnInit {
  private datasetSvc = inject(DatasetService);
  private router = inject(Router);

  datasets = signal<Dataset[]>([]);
  loading = signal(true);
  uploading = signal(false);
  deleting = signal<string | null>(null);
  uploadError = signal<string | null>(null);
  uploadSuccess = signal<string | null>(null);

  showUpload = false;
  isDragging = false;
  selectedFile: File | null = null;
  datasetName = '';

  ngOnInit(): void {
    this.loadDatasets();
    // Poll for processing datasets
    setInterval(() => {
      if (this.datasets().some(d => d.status === 'processing')) {
        this.loadDatasets();
      }
    }, 3000);
  }

  loadDatasets(): void {
    this.datasetSvc.listDatasets().subscribe({
      next: (res) => {
        this.datasets.set(res.datasets);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = true;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) this.selectedFile = file;
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.files?.[0]) this.selectedFile = input.files[0];
  }

  upload(): void {
    if (!this.selectedFile) return;
    this.uploading.set(true);
    this.uploadError.set(null);
    this.uploadSuccess.set(null);

    this.datasetSvc.uploadDataset(this.selectedFile, this.datasetName || undefined).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.uploadSuccess.set(`"${res.dataset.name}" uploaded and processing started!`);
        this.selectedFile = null;
        this.datasetName = '';
        this.loadDatasets();
        setTimeout(() => { this.showUpload = false; this.uploadSuccess.set(null); }, 2000);
      },
      error: (err) => {
        this.uploading.set(false);
        this.uploadError.set(err.error?.message || 'Upload failed. Please try again.');
      },
    });
  }

  deleteDataset(id: string): void {
    if (!confirm('Delete this dataset? This cannot be undone.')) return;
    this.deleting.set(id);
    this.datasetSvc.deleteDataset(id).subscribe({
      next: () => {
        this.deleting.set(null);
        this.datasets.update(ds => ds.filter(d => d.id !== id));
      },
      error: () => this.deleting.set(null),
    });
  }

  openQuery(id: string): void {
    this.router.navigate(['/datasets', id, 'query']);
  }

  columnCount(ds: Dataset): number {
    return ds.schema ? Object.keys(ds.schema).length : 0;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  trackById(index: number, item: Dataset): string {
    return item.id;
  }
}
