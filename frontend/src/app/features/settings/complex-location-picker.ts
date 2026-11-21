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
