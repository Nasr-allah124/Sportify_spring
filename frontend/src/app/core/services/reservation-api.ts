import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface MyReservation {
  id: number;
  fieldId: number;
  fieldName: string;
  complexName: string;
  city: string;
  startAt: string;
  endAt: string;
  totalPrice: number;
  status: 'CONFIRMED' | 'CANCELLED';
}

@Injectable({ providedIn: 'root' })
export class ReservationApi {
  private readonly http = inject(HttpClient);

  getMine(token: string) {
    return this.http.get<MyReservation[]>(
      '/api/v1/reservations/me',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  }
  cancel(reservationId: number, token: string) {
  return this.http.patch<MyReservation>(
    `/api/v1/reservations/${reservationId}/cancel`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
}
}