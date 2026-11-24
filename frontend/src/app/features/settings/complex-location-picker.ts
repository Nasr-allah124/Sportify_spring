import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';

import type { CircleMarker, LatLngTuple } from 'leaflet';

export interface ComplexPoint {
  latitude: number;
  longitude: number;
}

@Component({
  selector: 'app-complex-location-picker',
  standalone: true,
  host: {
    class: 'block w-full min-w-0'
  },
  template: `
    <div>
      <p class="font-medium">Localisation du complexe</p>

      <p id="map-help" class="mt-1 text-sm text-muted">
        Zoomez sur votre quartier puis cliquez sur l’entrée du complexe.
        Cliquez ailleurs pour déplacer le repère.
      </p>

      <div
        #mapHost
        aria-label="Carte de sélection de l’entrée du complexe"
        aria-describedby="map-help"
        class="relative z-0 mt-3 h-72 w-full overflow-hidden rounded-xl border border-line"
      ></div>

      @if (mapError()) {
        <p role="alert" class="mt-2 text-sm text-error">
          {{ mapError() }}
        </p>
      }
    </div>
  `
})
export class ComplexLocationPicker {
  readonly cityCenter = input.required<ComplexPoint>();
  readonly initialPoint = input<ComplexPoint | null>(null);
  readonly pointSelected = output<ComplexPoint>();
  readonly mapError = signal('');

  private readonly host =
    viewChild.required<ElementRef<HTMLDivElement>>('mapHost');

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => void this.openMap());
  }

  private async openMap(): Promise<void> {
    try {
      const L = await import('leaflet');
      if (this.destroyRef.destroyed) return;

      const initial = this.initialPoint();
      const center = initial ?? this.cityCenter();
      const position: LatLngTuple = [center.latitude, center.longitude];

      const container = this.host().nativeElement;
      const map = L.map(container).setView(position, initial ? 17 : 13);

      const resizeObserver = new ResizeObserver(() => {
        map.invalidateSize({ pan: false, debounceMoveend: true });
      });

      this.destroyRef.onDestroy(() => {
        resizeObserver.disconnect();
        map.remove();
      });

      resizeObserver.observe(container);

      const tiles = L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
      );

      tiles.on('loading', () => this.mapError.set(''));

      tiles.on('tileerror', () => {
        this.mapError.set(
          'Une partie de la carte n’a pas pu être chargée. Vérifiez votre connexion.'
        );
      });

      tiles.addTo(map);

      let marker: CircleMarker | undefined;

      const placeMarker = (coordinates: LatLngTuple): void => {
        if (marker) {
          marker.setLatLng(coordinates);
          return;
        }

        marker = L.circleMarker(coordinates, {
          radius: 9,
          color: '#173522',
          weight: 3,
          fillColor: '#c4ef69',
          fillOpacity: 1,
          interactive: false
        }).addTo(map);
      };

      if (initial) {
        placeMarker(position);
      }

      map.on('click', event => {
        const location = map.wrapLatLng(event.latlng);
        const latitude = Number(location.lat.toFixed(6));
        const longitude = Number(location.lng.toFixed(6));

        placeMarker([latitude, longitude]);
        this.pointSelected.emit({ latitude, longitude });
      });
    } catch (error) {
      if (this.destroyRef.destroyed) return;

      console.error('[Sportify] Chargement de la carte impossible', error);
      this.mapError.set('Impossible d’ouvrir la carte. Rechargez la page.');
    }
  }
}
@Component({
  selector: 'app-complex-location-map',
  standalone: true,
  host: { class: 'block min-w-0' },
  template: `
    <div
      #mapHost
      class="relative z-0 w-full overflow-hidden rounded-2xl border border-line"
      style="height: 285px"
      [attr.aria-label]="'Carte du complexe ' + name()"
    ></div>

    @if (error()) {
      <p role="status" class="mt-2 text-sm text-muted">{{ error() }}</p>
    }

    <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-muted">Le repère indique l’entrée du complexe.</p>

      <a
        class="text-sm font-semibold underline"
        [href]="'https://www.google.com/maps/search/?api=1&query='
          + latitude() + ',' + longitude()"
        target="_blank"
        rel="noopener noreferrer"
      >
        Ouvrir dans Google Maps ↗
      </a>
    </div>
  `
})
export class ComplexLocationMap {
  readonly latitude = input.required<number>();
  readonly longitude = input.required<number>();
  readonly name = input.required<string>();
  readonly error = signal('');

  private readonly mapHost =
    viewChild.required<ElementRef<HTMLDivElement>>('mapHost');

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => void this.openMap());
  }

  private async openMap(): Promise<void> {
    try {
      const L = await import('leaflet');
      if (this.destroyRef.destroyed) return;

      const host = this.mapHost().nativeElement;
      const position: LatLngTuple = [this.latitude(), this.longitude()];

      const map = L.map(host, {
        scrollWheelZoom: false,
        zoomControl: true
      }).setView(position, 16);

      const observer = new ResizeObserver(() => {
        map.invalidateSize({ pan: false });
      });

      this.destroyRef.onDestroy(() => {
        observer.disconnect();
        map.remove();
      });

      observer.observe(host);

      const tiles = L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }
      );

      tiles.on('tileerror', () => {
        this.error.set('Certaines zones de la carte n’ont pas pu être chargées.');
      });

      tiles.addTo(map);

      const label = document.createElement('span');
      label.textContent = this.name();

      L.circleMarker(position, {
        radius: 9,
        color: '#183927',
        weight: 3,
        fillColor: '#c4ef69',
        fillOpacity: 1
      })
        .addTo(map)
        .bindTooltip(label, { direction: 'top', offset: [0, -8] });
    } catch {
      if (!this.destroyRef.destroyed) {
        this.error.set('La carte est indisponible. Vous pouvez ouvrir Google Maps.');
      }
    }
  }
}
