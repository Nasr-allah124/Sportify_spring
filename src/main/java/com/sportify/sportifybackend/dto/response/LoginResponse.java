package com.sportify.sportifybackend.dto.response;

import java.time.Instant;

public record LoginResponse(String accessToken, Instant expiresAt) {}