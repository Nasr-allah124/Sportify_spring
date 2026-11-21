import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthSession } from './auth-session';

export interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone: string | null;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileApi {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AuthSession);
  private readonly url = '/api/v1/users/me';

  private authHeaders(): Record<string, string> {
    const token = this.session.token();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  getMe() {
    return this.http.get<UserProfile>(this.url, {
      headers: this.authHeaders()
    });
  }

  updateMe(changes: UpdateProfileRequest) {
    return this.http.patch<UserProfile>(this.url, changes, {
      headers: this.authHeaders()
    });
  }
}
