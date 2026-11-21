import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface OwnerApplication {
  id: number;
  applicantName: string;
  applicantEmail: string;
  complexName: string;
  city: string;
  address: string;
  phone: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  submittedAt: string;
}

@Injectable({ providedIn: 'root' })
export class AdminOwnerApi {
  private readonly http = inject(HttpClient);

  getPending(token: string) {
    return this.http.get<OwnerApplication[]>(
      '/api/v1/admin/owner-applications',
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
  }
}