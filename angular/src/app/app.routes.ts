import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'datasets',
    pathMatch: 'full',
  },
  {
    path: 'datasets',
    loadComponent: () =>
      import('./features/datasets/dataset-list/dataset-list.component').then(
        (m) => m.DatasetListComponent
      ),
  },
  {
    path: 'datasets/:id/query',
    loadComponent: () =>
      import('./features/query/query-builder/query-builder.component').then(
        (m) => m.QueryBuilderComponent
      ),
  },
  {
    path: '**',
    redirectTo: 'datasets',
  },
];
