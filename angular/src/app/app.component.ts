import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">

      <!-- HEADER -->
      <header class="app-header">
        <div class="header-inner">

          <a routerLink="/datasets" class="logo">
            <span class="logo-icon">⬡</span>
            <span class="logo-text">DataForge</span>
          </a>

          <nav class="main-nav">
            <a routerLink="/datasets"
               routerLinkActive="active"
               class="nav-link">
              Datasets
            </a>
          </nav>

        </div>
      </header>

      <!-- MAIN -->
      <main class="app-main">
        <router-outlet />
      </main>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    }

    /* ===== LIGHT APP BACKGROUND ===== */
    .app-shell {
      min-height: 100vh;
      background: #f6f8fc;
      color: #111827;
    }

    /* ===== HEADER ===== */
    .app-header {
      background: #ffffff;
      border-bottom: 1px solid #e5e7eb;
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(10px);
    }

    .header-inner {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 2rem;
      height: 64px;
      display: flex;
      align-items: center;
    }

    /* ===== LOGO ===== */
    .logo {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      text-decoration: none;
      color: inherit;
      font-weight: 600;
    }

    .logo-icon {
      font-size: 1.3rem;
      color: #726ddd;
    }

    .logo-text {
      font-size: 1.1rem;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.01em;
    }

    /* ===== NAV ===== */
    .main-nav {
      margin-left: auto;
      display: flex;
      gap: 0.5rem;
    }

    .nav-link {
      padding: 0.45rem 0.9rem;
      border-radius: 10px;
      text-decoration: none;
      font-size: 0.9rem;
      color: #6b7280;
      transition: all 0.2s ease;
    }

    .nav-link:hover {
      background: #f3f4f6;
      color: #111827;
    }

    .nav-link.active {
      background: #eef2ff;
      color: #8c87db;
      font-weight: 500;
    }

    .app-main {
      max-width: 1280px;
      margin: 0 auto;
      padding: 2rem;
    }

    @media (max-width: 768px) {
      .header-inner {
        padding: 0 1rem;
      }

      .app-main {
        padding: 1rem;
      }
    }
  `]
})
export class AppComponent { }