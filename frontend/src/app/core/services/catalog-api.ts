import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface SportComplex {
  id: number;
  name: string;
  city: string;
  address: string;
}

export interface Field {
  id: number;
  name: string;
  sportType: string;
  hourlyPrice: number;
  complex: SportComplex;
}
export interface AvailableSlot {
  startAt: string;
  endAt: string;
}
export interface ReservationResponse {
  id: number;
  fieldId: number;
  startAt: string;
  endAt: string;
  totalPrice: number;
  status: string;
}
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/fields';

  getFields(city = '', sport = '') {
    let params = new HttpParams();

    if (city.trim()) {
      params = params.set('city', city.trim());
    }

    if (sport) {
      params = params.set('sport', sport);
    }

    return this.http.get<Field[]>(this.baseUrl, { params });
  }

  getField(id: number) {
    return this.http.get<Field>(`${this.baseUrl}/${id}`);
  }
  getAvailability(fieldId: number, date: string, token: string) {
  const params = new HttpParams().set('date', date);

  return this.http.get<AvailableSlot[]>(
    `${this.baseUrl}/${fieldId}/availability`,
    {
      params,
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
}
createReservation(fieldId: number, startAt: string, token: string) {
  return this.http.post<ReservationResponse>(
    '/api/v1/reservations',
    {
      fieldId,
      startAt
    },
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
}
}