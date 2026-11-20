import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface RegisterResponse {
  userId: number;
  emailVerificationRequired: boolean;
}
export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
}

export interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/auth';

  register(request: RegisterRequest) {
    return this.http.post<RegisterResponse>(
      `${this.baseUrl}/register`,
      request
    );
  }

  verifyEmail(userId: number, code: string) {
    return this.http.post<void>(
      `${this.baseUrl}/verify-email`,
      { userId, code }
    );
  }
  resendCode(userId: number) {
    return this.http.post<void>(`${this.baseUrl}/resend-code`, { userId });
  }
  login(email: string, password: string) {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, {
      email,
      password
    });
  }
  loginWithGoogle(credential: string) {
    return this.http.post<LoginResponse>(`${this.baseUrl}/google`, { credential });
  }

  getMyProfile(token: string) {
    return this.http.get<UserProfile>('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}
