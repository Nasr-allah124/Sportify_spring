import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AuthSession } from './auth-session';

export interface OwnerApplicationRequest {
  complexName: string;
  city: string;
  address: string;
  phone: string;
  description: string;
  latitude: number;
  longitude: number;
}

export interface OwnerApplicationResponse {
  id: number;
  complexName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  rejectionReason: string | null;
  latitude: number | null;
  longitude: number | null;
}

@Injectable({ providedIn: 'root' })
export class OwnerApplicationApi {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AuthSession);
  private readonly url = '/api/v1/owner-applications';

  private headers(): Record<string, string> {
    const token = this.session.token();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  latest() {
    return this.http.get<OwnerApplicationResponse | null>(
      `${this.url}/me/latest`,
      { headers: this.headers() }
    );
  }

  submit(request: OwnerApplicationRequest) {
    return this.http.post<OwnerApplicationResponse>(this.url, request, {
      headers: this.headers()
    });
  }
}
